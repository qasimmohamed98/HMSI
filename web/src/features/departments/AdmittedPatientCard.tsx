import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';
import type { Patient } from '@hmsi/shared';
import { Card, CardContent, Avatar } from '@/components/ui';
import { localName } from '@/lib/format';

export function AdmittedPatientCard({ patient, children }: { patient: Patient; children?: ReactNode }) {
  const { t } = useTranslation();
  const admission = patient.activeAdmission ?? null;
  const href = `/patients/${patient.id}`;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-ink/8 bg-surface-muted/50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
        <Avatar name={localName(patient, 'full_name')} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-ink">{localName(patient, 'full_name')}</p>
          <p className="text-xs text-ink/50">
            {patient.file_number}
            {admission && (
              <>
                <span className="mx-1.5 text-ink/25">·</span>
                {t('dept.wardBed', { ward: localName(admission, 'ward_name'), bed: admission.bed_no })}
              </>
            )}
          </p>
        </div>
        <Link
          to={href}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-brand-700 transition-colors hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-900/40"
        >
          <FileText className="h-3.5 w-3.5" />
          {t('dept.openChart')}
        </Link>
      </div>
      {children && <CardContent className="p-4">{children}</CardContent>}
    </Card>
  );
}