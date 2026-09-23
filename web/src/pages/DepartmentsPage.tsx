import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Network, Plus, Pencil, Trash2, Building2 } from 'lucide-react';
import { Card, CardContent, Skeleton, EmptyState, Badge, Button, Dialog, Input, ConfirmDialog } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { API, type DepartmentInput } from '@/lib/api';
import { useToast } from '@/components/ui';
import { useNavigate } from 'react-router-dom';
import type { Department } from '@hmsi/shared';

export default function DepartmentsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();

  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['departments'], queryFn: API.listDepartments });
  const [dialog, setDialog] = useState<{ dept: Department | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['departments'] });
    void qc.invalidateQueries({ queryKey: ['wards'] });
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const onError = (e: unknown) => toast.error((e as Error).message || t('errors.generic'));

  const createMut = useMutation({ mutationFn: API.createDepartment, onSuccess: () => { invalidate(); setDialog(null); toast.success(t('common.done')); }, onError });
  const updateMut = useMutation({ mutationFn: (a: { id: string; input: Partial<DepartmentInput> }) => API.updateDepartment(a.id, a.input), onSuccess: () => { invalidate(); setDialog(null); toast.success(t('common.done')); }, onError });
  const deleteMut = useMutation({ mutationFn: (id: string) => API.deleteDepartment(id), onSuccess: () => { invalidate(); setDeleteTarget(null); toast.success(t('common.done')); }, onError });

  return (
    <div>
      <PageHeader
        title={t('nav.departments')}
        subtitle={t('departments.subtitle')}
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setDialog({ dept: null })}>
            {t('departments.add')}
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : error || !data ? (
        <Card>
          <CardContent>
            <EmptyState title={t('errors.generic')} action={{ label: t('common.retry'), onClick: () => void refetch() }} />
          </CardContent>
        </Card>
      ) : data.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState title={t('departments.empty')} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((d) => (
            <Card key={d.id} className="flex flex-col">
              <CardContent className="flex flex-1 items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-info-50 text-info-600 dark:bg-info-900/40 dark:text-info-300">
                    <Network className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-ink">{d.name_ar}</p>
                    <p className="truncate text-xs text-ink/50">{d.name_en}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    <Building2 className="me-1 h-3 w-3" />
                    {t('departments.wardCount', { count: d.ward_count ?? 0 })}
                  </Badge>
                  <Button size="icon-sm" variant="ghost" aria-label={t('common.edit')} onClick={() => setDialog({ dept: d })}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label={t('common.delete')} className="text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/30" onClick={() => setDeleteTarget(d)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {dialog && (
        <DepartmentDialog open onClose={() => setDialog(null)} dept={dialog.dept} onSubmit={(input) => dialog.dept ? updateMut.mutate({ id: dialog.dept.id, input }) : createMut.mutate(input)} busy={createMut.isPending || updateMut.isPending} />
      )}
      {deleteTarget && (
        <ConfirmDialog
          open
          onClose={() => setDeleteTarget(null)}
          title={t('departments.delete')}
          message={t('departments.deleteConfirm', { name: deleteTarget.name_ar })}
          busy={deleteMut.isPending}
          onConfirm={() => deleteMut.mutate(deleteTarget.id)}
        />
      )}

      <div className="mt-4">
        <Button variant="ghost" size="sm" className="text-ink/50" onClick={() => navigate('/wards')}>
          ← {t('nav.wards')}
        </Button>
      </div>
    </div>
  );
}

function DepartmentDialog({
  open,
  onClose,
  dept,
  onSubmit,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  dept: Department | null;
  onSubmit: (i: DepartmentInput) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [nameAr, setNameAr] = useState(dept?.name_ar ?? '');
  const [nameEn, setNameEn] = useState(dept?.name_en ?? '');
  const [error, setError] = useState('');

  const submit = () => {
    if (nameAr.trim().length < 2) { setError(t('errors.required')); return; }
    onSubmit({ nameAr, nameEn: nameEn || null });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={dept ? t('departments.edit') : t('departments.add')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={submit} loading={busy}>{t('common.save')}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <p className="text-sm font-semibold text-danger-600">{error}</p>}
        <Input label={t('departments.nameAr')} value={nameAr} onChange={(e) => setNameAr(e.target.value)} autoFocus placeholder="قسم الباطنية" />
        <Input label={t('departments.nameEn')} value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="Internal Medicine" dir="ltr" />
      </div>
    </Dialog>
  );
}