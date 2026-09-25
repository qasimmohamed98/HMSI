import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Download, KeyRound, ShieldCheck, ShieldOff, Smartphone } from 'lucide-react';
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, Input, useToast } from '@/components/ui';
import { API } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/** التحقق بخطوتين من الإعدادات: تفعيل بمسح QR، رموز استرداد، إيقاف بكلمة المرور */
export function TwoFactorCard() {
  const { t } = useTranslation();
  const { refresh } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const status = useQuery({ queryKey: ['2fa-status'], queryFn: API.twofaStatus });
  const [setup, setSetup] = useState<{ secret: string; otpauth_url: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [askPassword, setAskPassword] = useState<'disable' | 'codes' | null>(null);

  const done = () => {
    void qc.invalidateQueries({ queryKey: ['2fa-status'] });
    void refresh();
  };
  const start = useMutation({ mutationFn: API.twofaSetup, onSuccess: setSetup });

  const enabled = status.data?.enabled;
  return (
    <Card id="security">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-brand-600" />
          {t('twofa.title')}
          {status.data && <Badge variant={enabled ? 'success' : 'neutral'}>{t(enabled ? 'twofa.on' : 'twofa.off')}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-ink/60">{t('twofa.intro')}</p>
        {enabled ? (
          <>
            <p className="text-xs text-ink/50">{t('twofa.codesLeft', { count: status.data?.recovery_codes_left ?? 0 })}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" icon={<KeyRound className="h-4 w-4" />} onClick={() => setAskPassword('codes')}>
                {t('twofa.newCodes')}
              </Button>
              <Button variant="ghost" size="sm" className="text-danger-600" icon={<ShieldOff className="h-4 w-4" />} onClick={() => setAskPassword('disable')}>
                {t('twofa.disable')}
              </Button>
            </div>
          </>
        ) : (
          <Button icon={<Smartphone className="h-4 w-4" />} loading={start.isPending} onClick={() => start.mutate()}>
            {t('twofa.enable')}
          </Button>
        )}
      </CardContent>

      {setup && (
        <SetupDialog
          setup={setup}
          onClose={() => setSetup(null)}
          onEnabled={(c) => {
            setSetup(null);
            setCodes(c);
            done();
            toast.success(t('twofa.enabled'));
          }}
        />
      )}
      {codes && <CodesDialog codes={codes} onClose={() => setCodes(null)} />}
      {askPassword && (
        <PasswordDialog
          mode={askPassword}
          onClose={() => setAskPassword(null)}
          onDone={(c) => {
            setAskPassword(null);
            done();
            if (c) setCodes(c);
            else toast.success(t('twofa.disabled'));
          }}
        />
      )}
    </Card>
  );
}

function SetupDialog({ setup, onClose, onEnabled }: { setup: { secret: string; otpauth_url: string }; onClose: () => void; onEnabled: (codes: string[]) => void }) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const enable = useMutation({ mutationFn: () => API.twofaEnable(code), onSuccess: (r) => onEnabled(r.recovery_codes) });
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('twofa.setupTitle')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button loading={enable.isPending} disabled={code.replace(/\s/g, '').length !== 6} onClick={() => enable.mutate()}>
            {t('twofa.verify')}
          </Button>
        </>
      }
    >
      <ol className="list-decimal space-y-4 ps-5 text-sm text-ink/75">
        <li>{t('twofa.step1')}</li>
        <li>
          {t('twofa.step2')}
          <div className="mt-3 flex flex-col items-center gap-2">
            <div className="rounded-xl bg-white p-3">
              <QRCodeSVG value={setup.otpauth_url} size={176} level="M" />
            </div>
            <p className="text-xs text-ink/50">{t('twofa.manual')}</p>
            <code dir="ltr" className="select-all rounded-lg bg-ink/5 px-3 py-1.5 font-mono text-sm tracking-widest dark:bg-white/5">
              {setup.secret.match(/.{1,4}/g)?.join(' ')}
            </code>
          </div>
        </li>
        <li>
          {t('twofa.step3')}
          <Input
            className="mt-2 text-center font-mono text-lg tracking-[0.4em]"
            dir="ltr"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && code.replace(/\s/g, '').length === 6 && enable.mutate()}
            autoFocus
          />
        </li>
      </ol>
      {enable.error && (
        <Alert variant="danger" className="mt-3">
          {(enable.error as Error).message}
        </Alert>
      )}
    </Dialog>
  );
}

function CodesDialog({ codes, onClose }: { codes: string[]; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { user } = useAuth();
  const text = `Q VIREXA — ${user?.username ?? ''}\n${t('twofa.codesTitle')}\n\n${codes.join('\n')}\n`;
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `q-virexa-recovery-${user?.username ?? 'codes'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Dialog
      open
      onClose={onClose}
      closable={false}
      title={t('twofa.codesTitle')}
      footer={<Button onClick={onClose}>{t('twofa.codesSaved')}</Button>}
    >
      <Alert variant="warning">{t('twofa.codesHint')}</Alert>
      <ul dir="ltr" className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm">
        {codes.map((c) => (
          <li key={c} className="rounded-lg bg-ink/5 px-3 py-2 text-center dark:bg-white/5">
            {c}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          icon={<Copy className="h-4 w-4" />}
          onClick={() => void navigator.clipboard?.writeText(text).then(() => toast.success(t('twofa.copied')))}
        >
          {t('twofa.copy')}
        </Button>
        <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" />} onClick={download}>
          {t('twofa.download')}
        </Button>
      </div>
    </Dialog>
  );
}

function PasswordDialog({ mode, onClose, onDone }: { mode: 'disable' | 'codes'; onClose: () => void; onDone: (codes: string[] | null) => void }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const run = useMutation({
    mutationFn: async () => (mode === 'disable' ? (await API.twofaDisable(password), null) : (await API.twofaRecoveryCodes(password)).recovery_codes),
    onSuccess: onDone,
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={t(mode === 'disable' ? 'twofa.disable' : 'twofa.newCodes')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant={mode === 'disable' ? 'danger' : 'primary'} loading={run.isPending} disabled={!password} onClick={() => run.mutate()}>
            {t('common.confirm')}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-ink/65">{t(mode === 'disable' ? 'twofa.disableHint' : 'twofa.newCodesHint')}</p>
      <Input label={t('password.current')} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" dir="ltr" autoFocus />
      {run.error && (
        <Alert variant="danger" className="mt-3">
          {(run.error as Error).message}
        </Alert>
      )}
    </Dialog>
  );
}
