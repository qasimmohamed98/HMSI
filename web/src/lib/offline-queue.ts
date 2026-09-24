import { useEffect, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { API, type AdministrationInput, type FluidInput, type NewVitalsInput } from './api';

/**
 * طابور العمل دون اتصال (Outbox) لإدخالات التمريض السريعة: العلامات الحيوية، السوائل، إعطاء الجرعات.
 *
 * - كل إدخال يحمل معرّفاً يولّده المتصفح (clientId) ووقت القياس الفعلي، فإعادة الإرسال لا تُنشئ نسخة مكررة
 *   (الخادم يعيد السجل الموجود) — لذلك التعايش آمن مع Background Sync في Service Worker.
 * - يُحفظ في localStorage لكل مستخدم على حدة، ويُرسل تلقائياً عند عودة الشبكة أو عند الدخول مجدداً.
 * - الخادم يقبل الإدخالات المؤجلة حتى 48 ساعة فقط.
 */

export type OutboxJob =
  | { kind: 'vitals'; id: string; patientId: string; label: string; createdAt: string; payload: NewVitalsInput }
  | { kind: 'fluid'; id: string; patientId: string; label: string; createdAt: string; payload: FluidInput }
  | { kind: 'administration'; id: string; patientId: string; label: string; createdAt: string; payload: AdministrationInput & { admissionId: string; medicationId: string } };

export interface FailedJob {
  job: OutboxJob;
  message: string;
}

interface State {
  jobs: OutboxJob[];
  failed: FailedJob[];
  online: boolean;
  syncing: boolean;
}

let userId: string | null = null;
let state: State = { jobs: [], failed: [], online: typeof navigator === 'undefined' ? true : navigator.onLine, syncing: false };
const listeners = new Set<() => void>();

const key = () => (userId ? `hmsi.outbox.${userId}` : null);

function load(): void {
  const k = key();
  let jobs: OutboxJob[] = [];
  let failed: FailedJob[] = [];
  if (k) {
    try {
      const raw = JSON.parse(localStorage.getItem(k) ?? '{}') as { jobs?: OutboxJob[]; failed?: FailedJob[] };
      jobs = Array.isArray(raw.jobs) ? raw.jobs : [];
      failed = Array.isArray(raw.failed) ? raw.failed : [];
    } catch {
      /* تخزين غير متاح أو تالف — نبدأ بطابور فارغ */
    }
  }
  set({ jobs, failed });
}

function persist(): void {
  const k = key();
  if (!k) return;
  try {
    if (state.jobs.length === 0 && state.failed.length === 0) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify({ jobs: state.jobs, failed: state.failed }));
  } catch {
    /* التخزين ممتلئ أو محظور — يبقى الطابور في الذاكرة لهذه الجلسة */
  }
}

function set(patch: Partial<State>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function newClientId(): string {
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `c_${rnd.toLowerCase()}`;
}

const isNetworkError = (err: unknown) => (err as { status?: number })?.status === 0 || err instanceof TypeError;

function send(job: OutboxJob): Promise<unknown> {
  switch (job.kind) {
    case 'vitals':
      return API.addVitals(job.payload);
    case 'fluid':
      return API.addFluid(job.payload);
    case 'administration': {
      const { admissionId, medicationId, ...input } = job.payload;
      return API.administerMedication(admissionId, medicationId, input);
    }
  }
}

/**
 * يرسل الإدخال فوراً إن أمكن، وإلا يضعه في الطابور.
 * @returns queued=true إن حُفظ للإرسال لاحقاً
 */
export async function submitOrQueue(job: Omit<OutboxJob, 'id' | 'createdAt'>): Promise<{ queued: boolean }> {
  const full = { ...job, id: (job.payload as { clientId?: string }).clientId ?? newClientId(), createdAt: new Date().toISOString() } as OutboxJob;
  if (!navigator.onLine && API.mode === 'live') {
    enqueue(full);
    return { queued: true };
  }
  try {
    await send(full);
    return { queued: false };
  } catch (err) {
    if (API.mode === 'live' && isNetworkError(err)) {
      enqueue(full);
      return { queued: true };
    }
    throw err;
  }
}

function enqueue(job: OutboxJob): void {
  if (state.jobs.some((j) => j.id === job.id)) return;
  set({ jobs: [...state.jobs, job] });
  persist();
}

/** يرسل ما في الطابور بالترتيب. يتوقف عند انقطاع الشبكة أو انتهاء الجلسة. */
export async function flushOutbox(): Promise<number> {
  if (state.syncing || state.jobs.length === 0 || !navigator.onLine) return 0;
  set({ syncing: true });
  let sent = 0;
  try {
    for (const job of [...state.jobs]) {
      try {
        await send(job);
        sent++;
        set({ jobs: state.jobs.filter((j) => j.id !== job.id) });
      } catch (err) {
        const status = (err as { status?: number })?.status;
        if (isNetworkError(err) || status === 401) break;
        // رفض نهائي (مثلاً: خرج المريض، أو تجاوز 48 ساعة) — يُعرض للمستخدم ولا يُعاد تلقائياً
        set({ jobs: state.jobs.filter((j) => j.id !== job.id), failed: [...state.failed, { job, message: (err as Error)?.message ?? '' }] });
      }
      persist();
    }
  } finally {
    set({ syncing: false });
  }
  return sent;
}

export function dismissFailed(): void {
  set({ failed: [] });
  persist();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useOutbox(): State {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/** يُركَّب مرة واحدة داخل الواجهة المسجّلة: يربط الطابور بالمستخدم ويرسله عند عودة الشبكة */
export function useOutboxSync(currentUserId: string | null | undefined): void {
  const qc = useQueryClient();
  useEffect(() => {
    userId = currentUserId ?? null;
    load();
    const run = async () => {
      const sent = await flushOutbox();
      if (sent > 0) {
        void qc.invalidateQueries({ queryKey: ['chart'] });
        void qc.invalidateQueries({ queryKey: ['dashboard'] });
      }
    };
    const onOnline = () => {
      set({ online: true });
      void run();
    };
    const onOffline = () => set({ online: false });
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const timer = window.setInterval(() => {
      if (state.jobs.length > 0) void run();
    }, 20_000);
    void run();
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.clearInterval(timer);
    };
  }, [currentUserId, qc]);
}
