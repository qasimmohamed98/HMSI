import { localName } from '@/lib/format';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Plus, Pencil, Power, PowerOff } from 'lucide-react';
import { Badge, Card, CardContent, CardHeader, CardTitle, Avatar, Skeleton, EmptyState, Button, Dialog, Input, Select } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { API, type NewUserInput, type UpdateUserInput } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui';
import type { Role, User } from '@hmsi/shared';

const roleTone = (role: string) =>
  ({
    super_admin: 'danger',
    admin: 'warning',
    doctor: 'brand',
    nurse: 'success',
    pharmacist: 'info',
    lab: 'warning',
    radiology: 'neutral',
    reception: 'info',
    viewer: 'neutral',
  })[role] as 'danger' | 'warning' | 'brand' | 'success' | 'info' | 'neutral';

const CREATABLE_ROLES: Role[] = ['admin', 'doctor', 'nurse', 'pharmacist', 'lab', 'radiology', 'reception', 'viewer'];

export default function UsersPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['users'], queryFn: API.listUsers });
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);

  const toggleMut = useMutation({
    mutationFn: (u: User) => API.updateUser(u.id, { isActive: !u.is_active }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(t('common.done'));
    },
  });

  return (
    <div>
      <PageHeader
        title={t('nav.users')}
        subtitle={localName(user, 'hospital_name')}
        actions={
          user?.role === 'admin' || user?.role === 'super_admin' ? (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
              {t('users.add')}
            </Button>
          ) : undefined
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-brand-600" />
            {t('nav.users')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[68px] w-full rounded-xl" />
              ))}
            </div>
          ) : error || !data ? (
            <EmptyState title={t('errors.generic')} action={{ label: t('common.retry'), onClick: () => void refetch() }} />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.map((u) => {
                const editable = (user?.role === 'super_admin' || user?.role === 'admin') && u.role !== 'super_admin';
                return (
                  <div key={u.id} className="flex items-center gap-3 rounded-xl border border-ink/8 p-3.5 dark:border-white/10">
                    <Avatar name={localName(u, 'full_name') || u.username} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink">{localName(u, 'full_name') || u.username}</p>
                      <p className="truncate text-xs text-ink/45">{u.username}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant={roleTone(u.role)}>{t(`user.role.${u.role as Role}`)}</Badge>
                      {!u.is_active && <Badge variant="danger">{t('user.inactive')}</Badge>}
                    </div>
                    {editable && (
                      <div className="flex shrink-0 gap-1">
                        <Button size="icon-sm" variant="ghost" onClick={() => setEditUser(u)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className={u.is_active ? 'text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/30' : 'text-success-600 hover:bg-success-50 dark:hover:bg-success-900/30'}
                          onClick={() => toggleMut.mutate(u)}
                          disabled={toggleMut.isPending}
                        >
                          {u.is_active ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {createOpen && (
        <UserFormDialog
          open
          onClose={() => setCreateOpen(false)}
          onSuccess={() => {
            setCreateOpen(false);
            void qc.invalidateQueries({ queryKey: ['users'] });
            toast.success(t('common.done'));
          }}
        />
      )}
      {editUser && (
        <EditUserDialog
          open
          user={editUser}
          onClose={() => setEditUser(null)}
          onSuccess={() => {
            setEditUser(null);
            void qc.invalidateQueries({ queryKey: ['users'] });
            toast.success(t('common.done'));
          }}
        />
      )}
    </div>
  );
}

function UserFormDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState<NewUserInput>({
    username: '',
    password: '',
    fullNameAr: '',
    fullNameEn: '',
    email: '',
    role: 'doctor',
  });
  const mut = useMutation({
    mutationFn: API.createUser,
    onSuccess,
    onError: () => {},
  });
  const set = <K extends keyof NewUserInput>(k: K, v: NewUserInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const submit = () => {
    if (form.username.trim().length < 3 || form.password.length < 6 || form.fullNameAr.trim().length < 2) return;
    mut.mutate({ ...form, username: form.username.trim(), fullNameAr: form.fullNameAr.trim(), fullNameEn: form.fullNameEn?.trim() || undefined });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('users.add')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} loading={mut.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('users.username')} value={form.username} onChange={(e) => set('username', e.target.value)} autoFocus dir="ltr" />
          <Input label={t('users.password')} type="password" value={form.password} onChange={(e) => set('password', e.target.value)} dir="ltr" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('users.fullNameAr')} value={form.fullNameAr} onChange={(e) => set('fullNameAr', e.target.value)} />
          <Input label={t('users.fullNameEn')} value={form.fullNameEn ?? ''} onChange={(e) => set('fullNameEn', e.target.value)} dir="ltr" />
        </div>
        <Input label={t('users.email')} type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} dir="ltr" />
        <Select label={t('users.role')} value={form.role} onChange={(e) => set('role', e.target.value as NewUserInput['role'])} options={CREATABLE_ROLES.map((r) => ({ value: r, label: t(`user.role.${r}`) }))} />
      </div>
    </Dialog>
  );
}

function EditUserDialog({ open, user, onClose, onSuccess }: { open: boolean; user: User; onClose: () => void; onSuccess: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState<UpdateUserInput>({
    fullNameAr: user.full_name_ar,
    fullNameEn: user.full_name_en || null,
    email: user.email,
    role: (user.role === 'super_admin' ? 'viewer' : user.role) as UpdateUserInput['role'],
  });
  const mut = useMutation({
    mutationFn: (input: UpdateUserInput) => API.updateUser(user.id, input),
    onSuccess,
  });
  const set = <K extends keyof UpdateUserInput>(k: K, v: UpdateUserInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toast = useToast();
  const [newPassword, setNewPassword] = useState('');
  const resetMut = useMutation({
    mutationFn: () => API.resetUserPassword(user.id, newPassword),
    onSuccess: () => {
      setNewPassword('');
      toast.success(t('common.done'));
    },
  });
  const submit = () => {
    if ((form.fullNameAr ?? '').trim().length < 2) return;
    mut.mutate({ ...form, fullNameAr: form.fullNameAr?.trim(), email: form.email?.trim() || null, fullNameEn: form.fullNameEn?.trim() || null });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${t('users.edit')} — ${localName(user, 'full_name') || user.username}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} loading={mut.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('users.fullNameAr')} value={form.fullNameAr ?? ''} onChange={(e) => set('fullNameAr', e.target.value)} />
          <Input label={t('users.fullNameEn')} value={form.fullNameEn ?? ''} onChange={(e) => set('fullNameEn', e.target.value)} dir="ltr" />
        </div>
        <Input label={t('users.email')} type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} dir="ltr" />
        <Select
          label={t('users.role')}
          value={form.role!}
          onChange={(e) => set('role', e.target.value as UpdateUserInput['role'])}
          options={CREATABLE_ROLES.map((r) => ({ value: r, label: t(`user.role.${r}`) }))}
        />
        <div className="space-y-2 border-t border-ink/8 pt-4 dark:border-white/10">
          <p className="text-sm font-bold text-ink">{t('password.reset')}</p>
          <p className="text-xs text-ink/50">{t('password.resetHint')}</p>
          <div className="flex items-end gap-2">
            <Input
              label={t('password.new')}
              hint={t('password.rule')}
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              dir="ltr"
              containerClassName="flex-1"
            />
            <Button variant="outline" loading={resetMut.isPending} disabled={newPassword.length < 8} onClick={() => resetMut.mutate()}>
              {t('password.reset')}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}