import { useTranslation } from 'react-i18next';
import { Compass } from 'lucide-react';
import { Card, CardContent } from '@/components/ui';
import { EmptyState } from '@/components/ui';

export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <Card>
      <CardContent>
        <EmptyState
          icon={<Compass className="h-7 w-7" />}
          title="404"
          description={t('errors.notFound')}
          action={{ label: t('common.back'), onClick: () => (window.location.href = '/') }}
        />
      </CardContent>
    </Card>
  );
}