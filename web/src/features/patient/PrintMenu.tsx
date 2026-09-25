import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, FileText, FlaskConical, LogOut, Printer, ScanLine, SquareStack } from 'lucide-react';
import { Button } from '@/components/ui';
import type { ChartData } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { printDischargeSummary, printFullChart, printLabReport, printRadiologyReport } from './printChart';

/** قائمة الطباعة في ملف المريض: الملف كاملاً، التحاليل، الأشعة، ملخص الخروج، أو القسم المعروض */
export function PrintMenu({ chart }: { chart: ChartData }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const items = [
    { key: 'fullChart', icon: FileText, run: () => printFullChart(chart, t, user), show: true },
    { key: 'labReport', icon: FlaskConical, run: () => printLabReport(chart, t, user), show: chart.labs.some((l) => l.result) },
    { key: 'radReport', icon: ScanLine, run: () => printRadiologyReport(chart, t, user), show: chart.radiology.some((r) => r.report) },
    { key: 'discharge', icon: LogOut, run: () => printDischargeSummary(chart, t, user), show: chart.patient.admission?.status === 'discharged' },
    { key: 'currentSection', icon: SquareStack, run: () => window.print(), show: true },
  ].filter((i) => i.show);

  return (
    <div className="relative" ref={ref}>
      <Button size="sm" variant="outline" icon={<Printer className="h-4 w-4" />} onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        {t('print.menu')}
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      {open && (
        <div role="menu" className="absolute end-0 top-full z-30 mt-1.5 w-56 overflow-hidden rounded-xl border border-ink/10 bg-surface-raised shadow-float dark:border-white/10">
          {items.map((i) => (
            <button
              key={i.key}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                i.run();
              }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-start text-sm font-semibold text-ink/80 hover:bg-surface-muted dark:hover:bg-white/5"
            >
              <i.icon className="h-4 w-4 text-brand-600" />
              {t(`print.${i.key}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
