import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Eye, Globe, Heart, Mail, MapPin, MessageCircle, Phone, Target } from 'lucide-react';
import { Card, CardContent, Skeleton } from '@/components/ui';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { API } from '@/lib/api';
import { currentLang } from '@/i18n';

/** صفحة «من نحن» — محتواها يعدّله المدير العام من الإعدادات */
export default function AboutPage() {
  const { t } = useTranslation();
  const { data: raw, isLoading } = useQuery({ queryKey: ['about'], queryFn: API.getAbout });
  // الواجهة الإنجليزية: الحقول الإنجليزية إن كُتبت، وإلا العربية
  const a = raw && currentLang() === 'en'
    ? { ...raw, ...Object.fromEntries((['name', 'tagline', 'intro', 'mission', 'vision', 'values', 'address'] as const).filter((k) => raw[`${k}_en`]).map((k) => [k, raw[`${k}_en`]!])) }
    : raw;

  return (
    <PublicLayout>
      {isLoading || !a ? (
        <Skeleton className="h-64 w-full rounded-3xl" />
      ) : (
        <div className="space-y-6">
          <section className="rounded-3xl bg-[var(--q-ink)] px-6 py-10 text-white sm:px-10">
            <p className="text-sm font-bold text-white/70">{t('nav.about')}</p>
            <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">{a.name}</h1>
            {a.tagline && <p className="mt-3 text-lg text-white/85">{a.tagline}</p>}
          </section>

          {a.intro && (
            <Card>
              <CardContent>
                <p className="whitespace-pre-wrap text-base leading-loose text-ink/80">{a.intro}</p>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: Target, title: t('aboutPage.mission'), body: a.mission },
              { icon: Eye, title: t('aboutPage.vision'), body: a.vision },
              { icon: Heart, title: t('aboutPage.values'), body: a.values },
            ]
              .filter((x) => x.body)
              .map((x) => (
                <Card key={x.title}>
                  <CardContent className="space-y-2">
                    <x.icon className="h-6 w-6 text-brand-600" />
                    <p className="text-lg font-extrabold text-ink">{x.title}</p>
                    {x.title === t('aboutPage.values') ? (
                      <ul className="list-inside list-disc space-y-1 text-sm text-ink/70">
                        {x.body.split('\n').filter(Boolean).map((v) => (
                          <li key={v}>{v}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/70">{x.body}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
          </div>

          {(a.phone || a.email || a.address || a.website) && (
            <Card>
              <CardContent className="space-y-3">
                <p className="text-lg font-extrabold text-ink">{t('aboutPage.contact')}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {a.phone && (
                    <a href={`tel:${a.phone}`} className="flex items-center gap-2 rounded-xl bg-surface-muted/70 p-3 font-bold text-ink hover:bg-surface-muted dark:bg-white/5">
                      <Phone className="h-4 w-4 text-brand-600" />
                      <bdi dir="ltr">{a.phone}</bdi>
                    </a>
                  )}
                  {a.phone && (
                    <a href={`https://wa.me/${a.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl bg-surface-muted/70 p-3 font-bold text-ink hover:bg-surface-muted dark:bg-white/5">
                      <MessageCircle className="h-4 w-4 text-brand-600" />
                      WhatsApp
                    </a>
                  )}
                  {a.email && (
                    <a href={`mailto:${a.email}`} className="flex items-center gap-2 rounded-xl bg-surface-muted/70 p-3 font-bold text-ink hover:bg-surface-muted dark:bg-white/5">
                      <Mail className="h-4 w-4 text-brand-600" />
                      <bdi dir="ltr">{a.email}</bdi>
                    </a>
                  )}
                  {a.address && (
                    <p className="flex items-center gap-2 rounded-xl bg-surface-muted/70 p-3 font-bold text-ink dark:bg-white/5">
                      <MapPin className="h-4 w-4 text-brand-600" />
                      {a.address}
                    </p>
                  )}
                  {a.website && (
                    <a href={a.website.startsWith('http') ? a.website : `https://${a.website}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl bg-surface-muted/70 p-3 font-bold text-ink hover:bg-surface-muted dark:bg-white/5">
                      <Globe className="h-4 w-4 text-brand-600" />
                      <bdi dir="ltr">{a.website}</bdi>
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </PublicLayout>
  );
}
