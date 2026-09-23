import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Building2, BedDouble, Plus, Pencil, Trash2, Copy, Users, Stethoscope } from 'lucide-react';
import QRCode from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle, Skeleton, EmptyState, Badge, Button, Dialog, Input, Select, ConfirmDialog } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { API, type WardInput, type BedInput } from '@/lib/api';
import { useToast } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { ROLE_PERMISSIONS } from '@hmsi/shared';
import type { Ward, Bed, Department } from '@hmsi/shared';
import { cn } from '@/lib/utils';
import { useEffect, useRef } from 'react';

export default function WardsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const perms = user ? ROLE_PERMISSIONS[user.role] : [];
  const canWard = perms.includes('wards.manage' as never);
  const canAdm = perms.includes('admissions.manage' as never);
  const canDept = perms.includes('departments.manage' as never);

  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['wards'], queryFn: API.wards });
  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: API.listDepartments, enabled: canWard });

  const [wardDialog, setWardDialog] = useState<{ ward: Ward | null } | null>(null);
  const [bedDialog, setBedDialog] = useState<{ ward: Ward; bed: Bed } | null>(null);
  const [addBedFor, setAddBedFor] = useState<Ward | null>(null);
  const [editBed, setEditBed] = useState<{ ward: Ward; bed: Bed } | null>(null);
  const [deleteWard, setDeleteWard] = useState<Ward | null>(null);
  const [deleteBed, setDeleteBed] = useState<{ ward: Ward; bed: Bed } | null>(null);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['wards'] });
    void qc.invalidateQueries({ queryKey: ['unassigned'] });
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
    void qc.invalidateQueries({ queryKey: ['departments'] });
  };

  const onError = (e: unknown) => toast.error((e as Error).message || t('errors.generic'));
  const onDone = () => toast.success(t('common.done'));

  const createWardMut = useMutation({ mutationFn: API.createWard, onSuccess: () => { invalidate(); setWardDialog(null); onDone(); }, onError });
  const updateWardMut = useMutation({ mutationFn: (a: { id: string; input: Partial<Omit<WardInput, 'departmentId'>> }) => API.updateWard(a.id, a.input), onSuccess: () => { invalidate(); setWardDialog(null); onDone(); }, onError });
  const deleteWardMut = useMutation({ mutationFn: (id: string) => API.deleteWard(id), onSuccess: () => { invalidate(); setDeleteWard(null); onDone(); }, onError });
  const createBedMut = useMutation({ mutationFn: API.createBed, onSuccess: () => { invalidate(); setAddBedFor(null); onDone(); }, onError });
  const updateBedMut = useMutation({ mutationFn: (a: { id: string; input: { room?: string; bedNo?: string } }) => API.updateBed(a.id, a.input), onSuccess: () => { invalidate(); setEditBed(null); onDone(); }, onError });
  const deleteBedMut = useMutation({ mutationFn: (id: string) => API.deleteBed(id), onSuccess: () => { invalidate(); setDeleteBed(null); if (bedDialog) setBedDialog(null); onDone(); }, onError });
  const assignMut = useMutation({ mutationFn: (a: { bedId: string; admissionId: string }) => API.assignBed(a.bedId, a.admissionId), onSuccess: () => { invalidate(); setBedDialog(null); onDone(); }, onError });
  const freeMut = useMutation({ mutationFn: (bedId: string) => API.freeBed(bedId), onSuccess: () => { invalidate(); setBedDialog(null); onDone(); }, onError });

  return (
    <div>
      <PageHeader
        title={t('nav.wards')}
        subtitle={t('dashboard.occupancyTitle')}
        actions={
          <>
            {canDept && (
              <Button variant="outline" icon={<Users className="h-4 w-4" />} onClick={() => navigate('/departments')}>
                {t('nav.departments')}
              </Button>
            )}
            {canWard && (
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setWardDialog({ ward: null })}>
                {t('wards.add')}
              </Button>
            )}
          </>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      ) : error || !data ? (
        <Card>
          <CardContent>
            <EmptyState title={t('errors.generic')} action={{ label: t('common.retry'), onClick: () => void refetch() }} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((w) => {
            const occupied = w.beds.filter((b) => b.status === 'occupied').length;
            const pct = w.beds.length === 0 ? 0 : Math.round((occupied / w.beds.length) * 100);
            return (
              <Card key={w.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                      <Building2 className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate">{w.name_ar}</CardTitle>
                      <p className="truncate text-xs text-ink/50">
                        {w.name_en}
                        {w.department_name_ar ? ` · ${w.department_name_ar}` : ''}
                      </p>
                    </div>
                    {canWard && (
                      <div className="flex items-center gap-1">
                        <Button size="icon-sm" variant="ghost" aria-label={t('common.edit')} onClick={() => setWardDialog({ ward: w })}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon-sm" variant="ghost" aria-label={t('common.delete')} className="text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/30" onClick={() => setDeleteWard(w)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="brand" dot>
                      {t('occupancy.bedsUsed', { used: occupied, total: w.beds.length })}
                    </Badge>
                    <div className="flex items-center gap-2">
                      {canWard && (
                        <Button size="icon-sm" variant="ghost" aria-label={t('wards.addBed')} onClick={() => setAddBedFor(w)}>
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <span className="text-xs font-bold text-ink/45">%{pct}</span>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-muted dark:bg-white/10">
                    <div className={cn('h-full rounded-full', pct >= 90 ? 'bg-danger-500' : pct >= 70 ? 'bg-warning-500' : 'bg-brand-500')} style={{ width: `${Math.max(pct, 4)}%` }} />
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {w.beds.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        disabled={!canWard && !canAdm}
                        onClick={() => setBedDialog({ ward: w, bed: b })}
                        title={`${w.name_ar} · ${b.room} / ${b.bed_no}`}
                        className={cn(
                          'flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-center transition-colors',
                          b.status === 'occupied'
                            ? 'border-brand-300 bg-brand-50 text-brand-800 hover:border-brand-500 dark:border-brand-800 dark:bg-brand-900/40 dark:text-brand-200'
                            : 'border-ink/8 bg-surface-raised text-ink/40 hover:border-brand-400 hover:text-ink/70 dark:border-white/10',
                          !canWard && !canAdm && 'cursor-default',
                        )}
                      >
                        <BedDouble className={cn('h-3.5 w-3.5', b.status === 'occupied' ? 'text-brand-600' : '')} />
                        <span className="text-[0.65rem] font-bold tabular">{b.bed_no}</span>
                        {b.status === 'occupied' && <span className="text-[0.55rem] font-bold text-brand-600 dark:text-brand-300">●</span>}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {wardDialog && (
        <WardDialog open onClose={() => setWardDialog(null)} ward={wardDialog.ward} departments={departments ?? []} onSubmit={(input) => wardDialog.ward ? updateWardMut.mutate({ id: wardDialog.ward.id, input }) : createWardMut.mutate(input)} busy={createWardMut.isPending || updateWardMut.isPending} />
      )}
      {bedDialog && <BedDialog open onClose={() => setBedDialog(null)} ward={bedDialog.ward} bed={bedDialog.bed} canAdm={canAdm} canWard={canWard} onAssign={(admissionId) => assignMut.mutate({ bedId: bedDialog.bed.id, admissionId })} assignBusy={assignMut.isPending} onFree={() => freeMut.mutate(bedDialog.bed.id)} freeBusy={freeMut.isPending} onEdit={() => { setEditBed(bedDialog); }} onDelete={() => setDeleteBed(bedDialog)} onViewPatient={(pid) => navigate(`/patients/${pid}`)} />}
      {addBedFor && <BedFormDialog open onClose={() => setAddBedFor(null)} ward={addBedFor} onSubmit={(input) => createBedMut.mutate(input as BedInput)} busy={createBedMut.isPending} />}
      {editBed && <BedFormDialog open onClose={() => setEditBed(null)} ward={editBed.ward} bed={editBed.bed} onSubmit={(input) => updateBedMut.mutate({ id: editBed.bed.id, input })} busy={updateBedMut.isPending} />}
      {deleteWard && (
        <ConfirmDialog open onClose={() => setDeleteWard(null)} title={t('wards.delete')} message={t('wards.deleteConfirm', { name: deleteWard.name_ar })} busy={deleteWardMut.isPending} onConfirm={() => deleteWardMut.mutate(deleteWard.id)} />
      )}
      {deleteBed && (
        <ConfirmDialog open onClose={() => setDeleteBed(null)} title={t('wards.deleteBed')} message={t('wards.deleteBedConfirm', { bed: `${deleteBed.bed.room} / ${deleteBed.bed.bed_no}` })} busy={deleteBedMut.isPending} onConfirm={() => deleteBedMut.mutate(deleteBed.bed.id)} />
      )}
    </div>
  );
}

function WardDialog({
  open,
  onClose,
  ward,
  departments,
  onSubmit,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  ward: Ward | null;
  departments: Department[];
  onSubmit: (i: WardInput) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [departmentId, setDepartmentId] = useState(ward?.department_id ?? departments[0]?.id ?? '');
  const [nameAr, setNameAr] = useState(ward?.name_ar ?? '');
  const [nameEn, setNameEn] = useState(ward?.name_en ?? '');
  const [wardType, setWardType] = useState<Ward['type']>(ward?.type ?? 'mixed');
  const [error, setError] = useState('');

  const submit = () => {
    if (!departmentId) { setError(t('errors.required')); return; }
    if (nameAr.trim().length < 2) { setError(t('errors.required')); return; }
    onSubmit({ departmentId, nameAr, nameEn: nameEn || null, wardType });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={ward ? t('wards.edit') : t('wards.add')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={submit} loading={busy}>{t('common.save')}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <p className="text-sm font-semibold text-danger-600">{error}</p>}
        <Select
          label={t('wards.department')}
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          options={departments.map((d) => ({ value: d.id, label: d.name_ar }))}
          placeholder={t('admit.selectDepartment')}
        />
        <Input label={t('wards.nameAr')} value={nameAr} onChange={(e) => setNameAr(e.target.value)} autoFocus placeholder="ردهة الباطنية الأولى" />
        <Input label={t('wards.nameEn')} value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="Internal Medicine Ward 1" dir="ltr" />
        <Select
          label={t('wards.wardType')}
          value={wardType}
          onChange={(e) => setWardType(e.target.value as Ward['type'])}
          options={(['male', 'female', 'mixed'] as const).map((k) => ({ value: k, label: t(`wards.types.${k}`) }))}
        />
      </div>
    </Dialog>
  );
}

function BedFormDialog({
  open,
  onClose,
  ward,
  bed,
  onSubmit,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  ward: Ward;
  bed?: Bed | null;
  onSubmit: (i: BedInput | { room?: string; bedNo?: string }) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [room, setRoom] = useState(bed?.room ?? '');
  const [bedNo, setBedNo] = useState(bed?.bed_no ?? '');
  const [error, setError] = useState('');

  const submit = () => {
    if (!room.trim() || !bedNo.trim()) { setError(t('errors.required')); return; }
    onSubmit(bed ? { room, bedNo } : { wardId: ward.id, room, bedNo });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={bed ? t('wards.editBed') : t('wards.addBed')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={submit} loading={busy}>{t('common.save')}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <p className="text-sm font-semibold text-danger-600">{error}</p>}
        <p className="text-sm text-ink/50">{ward.name_ar}</p>
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('wards.room')} value={room} onChange={(e) => setRoom(e.target.value)} placeholder="1" />
          <Input label={t('wards.bedNumber')} value={bedNo} onChange={(e) => setBedNo(e.target.value)} placeholder="101" />
        </div>
      </div>
    </Dialog>
  );
}

function BedDialog({
  open,
  onClose,
  ward,
  bed,
  canAdm,
  canWard,
  onAssign,
  assignBusy,
  onFree,
  freeBusy,
  onEdit,
  onDelete,
  onViewPatient,
}: {
  open: boolean;
  onClose: () => void;
  ward: Ward;
  bed: Bed;
  canAdm: boolean;
  canWard: boolean;
  onAssign: (admissionId: string) => void;
  assignBusy: boolean;
  onFree: () => void;
  freeBusy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onViewPatient: (patientId: string) => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: unassigned } = useQuery({ queryKey: ['unassigned'], queryFn: API.listUnassigned, enabled: open && bed.status === 'free' && canAdm });
  const { data: occupant } = useQuery({
    queryKey: ['bedOccupant', bed.id],
    queryFn: () => API.bedOccupant(bed.id),
    enabled: open && bed.status === 'occupied' && canAdm,
  });
  const [selected, setSelected] = useState('');

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['unassigned'] });
    void qc.invalidateQueries({ queryKey: ['bedOccupant', bed.id] });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${ward.name_ar} — ${bed.room} / ${bed.bed_no}`}
      description={bed.status === 'occupied' ? t('status.occupied') : t('status.free')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.close')}</Button>
          {bed.status === 'free' && canAdm && (
            <Button icon={<Stethoscope className="h-4 w-4" />} disabled={!selected} loading={assignBusy} onClick={() => onAssign(selected)}>
              {t('wards.assign')}
            </Button>
          )}
          {bed.status === 'occupied' && canAdm && (
            <Button variant="outline" loading={freeBusy} onClick={onFree}>
              {t('wards.freeBed')}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {bed.status === 'free' && canAdm ? (
          unassigned && unassigned.length === 0 ? (
            <p className="py-6 text-center text-sm font-medium text-ink/45">{t('wards.noUnassigned')}</p>
          ) : (
            <>
              <p className="text-sm text-ink/60">{t('wards.assignHint')}</p>
              <Select
                label={t('wards.patient')}
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                options={(unassigned ?? []).map((u) => ({ value: u.admission_id, label: u.patient_name_ar }))}
                placeholder={t('admit.selectBed')}
              />
            </>
          )
        ) : null}

        {bed.status === 'occupied' && canAdm ? (
          occupant ? (
            <div className="flex items-center gap-3 rounded-xl bg-surface-muted/70 p-4 dark:bg-white/5">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                <Users className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-ink">{occupant.patient_name_ar}</p>
                <p className="text-xs text-ink/50">{t('wards.occupantLabel')}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => onViewPatient(occupant.patient_id)}>
                {t('wards.viewPatient')}
              </Button>
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-ink/45">{t('errors.generic')}</p>
          )
        ) : null}

        {bed.status === 'free' && !canAdm && (
          <p className="py-4 text-center text-sm font-medium text-ink/45">{t('wards.freeBedHint')}</p>
        )}

        {canWard && (
          <div className="flex items-center justify-between gap-3 border-t border-ink/8 pt-3 dark:border-white/10">
            <p className="text-xs font-bold uppercase tracking-wide text-ink/40">{t('wards.manageBed')}</p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => { onEdit(); void invalidate(); }}>
                {t('common.edit')}
              </Button>
              <Button size="sm" variant="ghost" className="text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/30" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => { onDelete(); void invalidate(); }}>
                {t('common.delete')}
              </Button>
            </div>
          </div>
        )}

        {bed.code && (
          <div className="mt-4 p-4 rounded-xl bg-surface-muted dark:bg-white/10">
            <p className="text-sm font-medium text-ink/60">{t('beds.barcodeLabel')}</p>
            <div className="flex items-center gap-3">
              <span className="flex-1 font-mono text-sm text-ink">{bed.code}</span>
              <Button size="icon-sm" variant="ghost" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/track/${bed.code}`)}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <QRCode
              value={bed.code}
              size={180}
              bgColor="white"
              fgColor="black"
              correctLevel="M"
            />
          </div>
        )}
      </div>
    </Dialog>
  );
}