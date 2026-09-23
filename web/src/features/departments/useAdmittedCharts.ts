import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Patient, ChartData } from '@hmsi/shared';
import { API } from '@/lib/api';

export interface AdmittedEntry {
  patient: Patient;
  chart: ChartData;
}

export const DEPT_KEY = ['dept', 'admitted'] as const;

export function useAdmittedCharts() {
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: DEPT_KEY,
    queryFn: async (): Promise<AdmittedEntry[]> => {
      const patients = await API.listPatients({ admitted: true });
      const charts = await Promise.all(patients.map((p) => API.getChart(p.id)));
      return patients.map((p, i) => ({ patient: p, chart: charts[i] }));
    },
  });

  const refetchAll = () => {
    void qc.invalidateQueries({ queryKey: ['dept', 'admitted'] });
    void qc.invalidateQueries({ queryKey: ['chart'] });
  };

  return { data, isLoading, error, refetch, refetchAll };
}