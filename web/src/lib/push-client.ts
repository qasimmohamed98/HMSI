import { API, type PushLevel } from './api';
import { currentLang } from '@/i18n';

/**
 * إشعارات الدفع على هذا الجهاز + تثبيت النظام كتطبيق.
 * - أندرويد والحاسوب (Chrome/Edge/Firefox): تعمل من المتصفح مباشرة، والتثبيت يجعلها أوثق.
 * - آيفون/آيباد: Apple لا تسمح بها إلا بعد «إضافة إلى الشاشة الرئيسية» (iOS 16.4+).
 */

export const IS_LIVE = import.meta.env.VITE_API_MODE === 'live';

export function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

export function isMobile(): boolean {
  return isIOS() || /android|mobi/i.test(navigator.userAgent);
}

/** يعمل كتطبيق مثبت (من الشاشة الرئيسية أو سطح المكتب) */
export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export type PushSupport = 'ok' | 'ios-install' | 'unsupported';

export function pushSupport(): PushSupport {
  if (!IS_LIVE) return 'unsupported';
  // آيفون من Safari (غير مثبت): الدعم يظهر فقط بعد الإضافة للشاشة الرئيسية
  if (isIOS() && !isStandalone()) return 'ios-install';
  const has = 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined';
  return has ? 'ok' : 'unsupported';
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  const os = isIOS() ? 'iOS' : /android/i.test(ua) ? 'Android' : /windows/i.test(ua) ? 'Windows' : /mac os/i.test(ua) ? 'macOS' : /linux/i.test(ua) ? 'Linux' : '—';
  const br = /edg\//i.test(ua) ? 'Edge' : /samsungbrowser/i.test(ua) ? 'Samsung' : /firefox|fxios/i.test(ua) ? 'Firefox' : /chrome|crios/i.test(ua) ? 'Chrome' : /safari/i.test(ua) ? 'Safari' : '—';
  return `${os} · ${br}${isStandalone() ? ' · app' : ''}`;
}

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  if (reg) return reg;
  // أول زيارة: قد لا يكون الـ Service Worker سُجّل بعد — ننتظره قليلاً لا إلى الأبد
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 8000))]);
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== 'ok') return null;
  const reg = await registration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

function toInput(sub: PushSubscription, level: PushLevel) {
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  return { endpoint: j.endpoint, keys: j.keys, lang: currentLang(), level, device: deviceLabel() };
}

/** يطلب الإذن ويشترك. يُرجع 'denied' إن رفض المستخدم */
export async function enablePush(level: PushLevel = 'all'): Promise<'ok' | 'denied' | 'unsupported'> {
  if (pushSupport() !== 'ok') return 'unsupported';
  const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (perm !== 'granted') return 'denied';
  const reg = await registration();
  if (!reg) return 'unsupported';
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const { public_key } = await API.pushKey();
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(public_key) });
  }
  await API.pushSubscribe(toInput(sub, level));
  return 'ok';
}

export async function setPushLevel(level: PushLevel): Promise<void> {
  const sub = await currentSubscription();
  if (sub) await API.pushSubscribe(toInput(sub, level));
}

/** إيقاف الإشعارات على هذا الجهاز (عند الخروج أيضاً: الجهاز قد يستخدمه موظف آخر) */
export async function disablePush(): Promise<void> {
  const sub = await currentSubscription().catch(() => null);
  if (!sub) return;
  await API.pushUnsubscribe(sub.endpoint).catch(() => undefined);
  await sub.unsubscribe().catch(() => undefined);
}

/**
 * عند فتح النظام: إن كان الجهاز مشتركاً نجدّد ربطه بالمستخدم الحالي ولغته
 * (المتصفح قد يغيّر الاشتراك، أو دخل موظف آخر على الجهاز).
 */
export async function syncPush(): Promise<{ subscribed: boolean; level: PushLevel | null }> {
  if (pushSupport() !== 'ok' || Notification.permission !== 'granted') return { subscribed: false, level: null };
  const sub = await currentSubscription();
  if (!sub) return { subscribed: false, level: null };
  const st = await API.pushStatus(sub.endpoint);
  if (st.subscribed) {
    await API.pushSubscribe(toInput(sub, st.level ?? 'all'));
    return { subscribed: true, level: st.level };
  }
  return { subscribed: false, level: null };
}

// ---------------------------------------------------------------- التثبيت كتطبيق

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

/** يُستدعى مرة عند بدء التطبيق: المتصفح يرسل الحدث مبكراً */
export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    listeners.forEach((f) => f());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((f) => f());
  });
}

export function canPromptInstall(): boolean {
  return deferred !== null;
}

export function onInstallChange(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  await e.prompt();
  const r = await e.userChoice;
  listeners.forEach((f) => f());
  return r.outcome === 'accepted';
}
