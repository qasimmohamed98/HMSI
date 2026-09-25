import { useMemo, useState } from 'react';
import { Lightbulb, Search, X, ZoomIn } from 'lucide-react';
import { Card, CardContent } from '@/components/ui';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { GUIDE_AR, GUIDE_EN, type GuideRole, type GuideTopic } from '@/i18n/content/guide';
import { currentLang } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

/** يربط دور المستخدم المسجّل بفصله في الدليل (يُفتح الدليل على فصله تلقائياً) */
const ROLE_OF: Record<string, GuideRole> = {
  super_admin: 'super',
  admin: 'admin',
  doctor: 'doctor',
  nurse: 'nurse',
  lab: 'lab',
  radiology: 'lab',
  pharmacist: 'pharmacy',
  reception: 'reception',
};

function matches(topic: GuideTopic, q: string): boolean {
  if (!q) return true;
  const hay = [topic.title, topic.intro, ...(topic.steps ?? []), ...(topic.tips ?? []), ...(topic.images ?? []).map((i) => i.caption)].join(' ').toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}

/** الدليل التعليمي المصوَّر — عام للزوار ولكل المستخدمين */
export default function GuidePage() {
  const g = currentLang() === 'en' ? GUIDE_EN : GUIDE_AR;
  const { user } = useAuth();
  const [role, setRole] = useState<GuideRole>(() => (user ? (ROLE_OF[user.role] ?? 'all') : 'all'));
  const [q, setQ] = useState('');
  const [zoom, setZoom] = useState<{ src: string; caption: string } | null>(null);

  const chapters = useMemo(
    () =>
      g.chapters
        .filter((c) => role === 'all' || c.role === role || c.role === 'all')
        .map((c) => ({ ...c, topics: c.topics.filter((t) => matches(t, q.trim())) }))
        .filter((c) => c.topics.length > 0),
    [g, role, q],
  );
  const roles = (Object.keys(g.roles) as GuideRole[]).filter((r) => r === 'all' || g.chapters.some((c) => c.role === r));

  return (
    <PublicLayout>
      <section className="rounded-3xl bg-[var(--q-ink)] px-6 py-8 text-white sm:px-10">
        <h1 className="text-3xl font-extrabold">{g.title}</h1>
        <p className="mt-2 max-w-2xl text-white/80">{g.subtitle}</p>
        <label className="mt-5 flex max-w-xl items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-ink shadow-sm">
          <Search className="h-5 w-5 text-ink/40" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={g.searchPlaceholder} className="w-full bg-transparent text-[0.95rem] outline-none placeholder:text-ink/40" />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="clear">
              <X className="h-4 w-4 text-ink/50" />
            </button>
          )}
        </label>
      </section>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {roles.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={cn('shrink-0 rounded-full border px-4 py-2 text-sm font-bold', role === r ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink/10 bg-surface-raised text-ink/65 hover:bg-surface-muted dark:border-white/10')}
          >
            {g.roles[r]}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[15rem_1fr]">
        {/* الفهرس */}
        <nav className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100dvh-7rem)] space-y-4 overflow-y-auto pe-2 text-sm">
            {chapters.map((c) => (
              <div key={c.id}>
                <a href={`#${c.id}`} className="font-extrabold text-ink hover:text-brand-700">
                  {c.title}
                </a>
                <ul className="mt-1 space-y-1 border-s border-ink/10 ps-3 dark:border-white/10">
                  {c.topics.map((t) => (
                    <li key={t.id}>
                      <a href={`#${c.id}-${t.id}`} className="text-ink/60 hover:text-brand-700">
                        {t.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        {/* المحتوى */}
        <div className="min-w-0 space-y-10">
          {chapters.length === 0 && <p className="py-10 text-center text-ink/55">{g.noResults}</p>}
          {chapters.map((c) => (
            <section key={c.id} id={c.id} className="scroll-mt-24">
              <h2 className="text-2xl font-extrabold text-ink">{c.title}</h2>
              <p className="mb-4 text-ink/60">{c.summary}</p>
              <div className="space-y-5">
                {c.topics.map((t) => (
                  <Card key={t.id} id={`${c.id}-${t.id}`} className="scroll-mt-24">
                    <CardContent className="space-y-4">
                      <h3 className="text-lg font-extrabold text-ink">{t.title}</h3>
                      {t.intro && <p className="leading-relaxed text-ink/75">{t.intro}</p>}
                      {t.steps && (
                        <ol className="space-y-2">
                          {t.steps.map((s, i) => (
                            <li key={i} className="flex gap-3">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-extrabold text-white">{i + 1}</span>
                              <span className="leading-relaxed text-ink/80">{s}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                      {t.images && (
                        <div className={cn('grid gap-3', t.images.length > 1 && 'md:grid-cols-2')}>
                          {t.images.map((im) => (
                            <figure key={im.src} className="group">
                              <button type="button" onClick={() => setZoom(im)} className="relative block w-full overflow-hidden rounded-xl border border-ink/10 bg-surface-muted dark:border-white/10">
                                <img src={im.src} alt={im.caption} loading="lazy" className="w-full" />
                                <span className="absolute end-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100">
                                  <ZoomIn className="h-4 w-4" />
                                </span>
                              </button>
                              <figcaption className="mt-1.5 text-center text-xs text-ink/55">{im.caption}</figcaption>
                            </figure>
                          ))}
                        </div>
                      )}
                      {t.tips && (
                        <div className="space-y-1.5 rounded-xl bg-warning-50 p-3 text-sm text-warning-900 dark:bg-warning-900/20 dark:text-warning-100">
                          {t.tips.map((tip) => (
                            <p key={tip} className="flex gap-2">
                              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
                              <span>
                                <b>{g.tipLabel}: </b>
                                {tip}
                              </span>
                            </p>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}

          {!q && (
            <section id="faq" className="scroll-mt-24">
              <h2 className="mb-4 text-2xl font-extrabold text-ink">{g.faqTitle}</h2>
              <div className="space-y-2">
                {g.faq.map((f) => (
                  <details key={f.q} className="group rounded-xl border border-ink/10 bg-surface-raised p-4 dark:border-white/10">
                    <summary className="cursor-pointer list-none font-bold text-ink">
                      <span className="me-2 text-brand-600 group-open:rotate-90">›</span>
                      {f.q}
                    </summary>
                    <p className="mt-2 leading-relaxed text-ink/70">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {zoom && (
        <div role="dialog" aria-modal className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/80 p-4" onClick={() => setZoom(null)}>
          <img src={zoom.src} alt={zoom.caption} className="max-h-[85dvh] max-w-full rounded-lg shadow-2xl" />
          <p className="text-sm text-white/85">{zoom.caption}</p>
        </div>
      )}
    </PublicLayout>
  );
}
