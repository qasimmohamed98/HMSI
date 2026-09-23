import { useTranslation } from 'react-i18next';
import { Construction } from 'lucide-react';
import { Card, CardContent } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui';

export default function SoonPage({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <div>
      <PageHeader title={t(titleKey)} subtitle={t('dashboard.subtitle')} />
      <Card>
        <CardContent>
          <EmptyState
            icon={<Construction className="h-7 w-7" />}
            title={t('nav.soon')}
            description={t('errors.generic')}
          />
        </CardContent>
      </Card>
    </div>
  );
}