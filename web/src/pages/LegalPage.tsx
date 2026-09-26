import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { currentLang } from '@/i18n';
import { LEGAL_AR, LEGAL_EN, type LegalDoc } from '@/i18n/content/legal';

/** سياسة الخصوصية (/privacy) وشروط الاستخدام (/terms) — صفحتان عامتان */
export default function LegalPage({ doc }: { doc: 'privacy' | 'terms' }) {
  const { t } = useTranslation();
  const L = currentLang() === 'en' ? LEGAL_EN : LEGAL_AR;
  const d: LegalDoc = L[doc];
  const other = doc === 'privacy' ? { to: '/terms', label: L.terms.title } : { to: '/privacy', label: L.privacy.title };
  return (
    <PublicLayout>
      <article className="mx-auto max-w-3xl space-y-5">
        <header className="rounded-3xl bg-[var(--q-ink)] px-6 py-8 text-white sm:px-10">
          <p className="text-sm font-bold text-white/70">Q VIREXA</p>
          <h1 className="mt-1 text-3xl font-extrabold">{d.title}</h1>
          <p className="mt-2 text-sm text-white/70">{L.updated}</p>
        </header>
        <Card>
          <CardContent className="space-y-6">
            <p className="text-base leading-loose text-ink/80">{d.intro}</p>
            {d.sections.map((s) => (
              <section key={s.h}>
                <h2 className="text-lg font-extrabold text-ink">{s.h}</h2>
                {s.p?.map((x) => (
                  <p key={x} className="mt-2 leading-loose text-ink/75">
                    {x}
                  </p>
                ))}
                {s.list && (
                  <ul className="mt-2 list-disc space-y-1.5 ps-6 leading-relaxed text-ink/75">
                    {s.list.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </CardContent>
        </Card>
        <p className="text-center text-sm">
          <Link to={other.to} className="font-semibold text-brand-700 hover:underline dark:text-brand-300">
            {other.label}
          </Link>
          {' · '}
          <Link to="/login" className="text-ink/60 hover:underline">
            {t('legal.backToLogin')}
          </Link>
        </p>
      </article>
    </PublicLayout>
  );
}
