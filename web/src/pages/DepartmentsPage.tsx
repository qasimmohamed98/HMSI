import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Network, Plus, Pencil, Trash2, Building2, MonitorCog, UserCog } from 'lucide-react';
import { Card, CardContent, Skeleton, EmptyState, Badge, Button, Dialog, Input, ConfirmDialog, Select } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { API, type DepartmentInput } from '@/lib/api';
import { useToast } from '@/components/ui';
import { useNavigate } from 'react-router-dom';
import { DEPARTMENT_KINDS, type Department, type DepartmentKind } from '@hmsi/shared';
import { UnitsDialog } from '@/features/org/UnitsDialog';
import { localName } from '@/lib/format';

export default function DepartmentsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();

  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['departments'], queryFn: API.listDepartments });
  const [dialog, setDialog] = useState<{ dept: Department | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [unitsFor, setUnitsFor] = useState<Department | null>(null);

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
                    <p className="truncate font-bold text-ink">{localName(d, 'name')}</p>
                    <p className="truncate text-xs text-ink/50">{t(`org.kinds.${d.kind ?? 'clinical'}`)}</p>
                    <p className="truncate text-xs text-ink/45">
                      <UserCog className="me-1 inline h-3 w-3 align-text-bottom" />
                      {d.head_user_id ? localName(d, 'head_name') : t('org.headNone')}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {(d.kind ?? 'clinical') === 'clinical' || (d.ward_count ?? 0) > 0 ? (
                    <Badge variant="outline">
                      <Building2 className="me-1 h-3 w-3" />
                      {t('departments.wardCount', { count: d.ward_count ?? 0 })}
                    </Badge>
                  ) : null}
                  {/* الأجهزة والغرف مفهوم خاص بالأشعة حالياً (المفراس، الرنين…) — يظهر فقط لقسم من نوع «أشعة»، لا لكل الأقسام */}
                  {d.kind === 'radiology' && (
                    <Button size="sm" variant="outline" icon={<MonitorCog className="h-3.5 w-3.5" />} onClick={() => setUnitsFor(d)}>
                      {t('org.unitCount', { count: d.unit_count ?? 0 })}
                    </Button>
                  )}
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
      {unitsFor && <UnitsDialog dept={unitsFor} onClose={() => setUnitsFor(null)} />}
      {deleteTarget && (
        <ConfirmDialog
          open
          onClose={() => setDeleteTarget(null)}
          title={t('departments.delete')}
          message={t('departments.deleteConfirm', { name: localName(deleteTarget, 'name') })}
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
  const [kind, setKind] = useState<DepartmentKind>(dept?.kind ?? 'clinical');
  const [headUserId, setHeadUserId] = useState<string>(dept?.head_user_id ?? '');
  const [error, setError] = useState('');
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: API.listUsers });

  const submit = () => {
    if (nameAr.trim().length < 2) { setError(t('errors.required')); return; }
    onSubmit({ nameAr, nameEn: nameEn || null, kind, headUserId: headUserId || null });
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
        <Input label={t('departments.nameAr')} value={nameAr} onChange={(e) => setNameAr(e.target.value)} autoFocus placeholder={t('examples.department')} />
        <Input label={t('departments.nameEn')} value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="Internal Medicine" dir="ltr" />
        <Select label={t('org.kindLabel')} value={kind} onChange={(e) => setKind(e.target.value as DepartmentKind)} options={DEPARTMENT_KINDS.map((k) => ({ value: k, label: t(`org.kinds.${k}`) }))} />
        <div>
          <Select
            label={t('org.head')}
            value={headUserId}
            onChange={(e) => setHeadUserId(e.target.value)}
            options={[{ value: '', label: t('org.headNone') }, ...(users ?? []).filter((u) => u.is_active).map((u) => ({ value: u.id, label: `${localName(u, 'full_name') || u.username} — ${t(`user.role.${u.role}`)}` }))]}
          />
          <p className="mt-1.5 text-xs text-ink/50">{t('org.headHint')}</p>
        </div>
      </div>
    </Dialog>
  );
}