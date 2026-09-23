import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Dialog, Input, Select, Button, Chip } from '@/components/ui';
import { Textarea } from '@/components/ui/Textarea';
import type { NewPatientInput } from '@/lib/api';
import { todayISO } from '@/lib/format';

export function NewPatientDialog({
  open,
  onClose,
  onSubmit,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: NewPatientInput) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [fullNameAr, setFullNameAr] = useState('');
  const [fullNameEn, setFullNameEn] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [birthDate, setBirthDate] = useState(todayISO());
  const [phone, setPhone] = useState('');
  const [bloodType, setBloodType] = useState('Unknown');
  const [allergyInput, setAllergyInput] = useState('');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [alertInput, setAlertInput] = useState('');
  const [alerts, setAlerts] = useState<string[]>([]);
  const [error, setError] = useState('');

  const reset = () => {
    setFullNameAr('');
    setFullNameEn('');
    setGender('male');
    setBirthDate(todayISO());
    setPhone('');
    setBloodType('Unknown');
    setAllergies([]);
    setAlerts([]);
    setAllergyInput('');
    setAlertInput('');
    setError('');
  };

  const addTag = (list: string[], setList: (v: string[]) => void, value: string, setInput: (v: string) => void) => {
    const v = (value ?? '').trim();
    if (!v) return;
    if (!list.includes(v)) setList([...list, v]);
    setInput('');
  };

  const submit = () => {
    if (fullNameAr.trim().length < 2 || !birthDate) {
      setError(t('errors.required'));
      return;
    }
    onSubmit({
      fullNameAr,
      fullNameEn: fullNameEn || undefined,
      gender,
      birthDate,
      phone: phone || null,
      bloodType,
      allergies,
      criticalAlerts: alerts,
    });
    reset();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('patients.newPatient')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} loading={busy}>
            {t('patients.savePatient')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <p className="text-sm font-semibold text-danger-600">{error}</p>}
        <Input label={t('patients.fullNameAr')} value={fullNameAr} onChange={(e) => setFullNameAr(e.target.value)} placeholder="مثال: محمد علي كريم" />
        <Input label={t('patients.fullNameEn')} value={fullNameEn} onChange={(e) => setFullNameEn(e.target.value)} placeholder="Mohammed Ali Karim" />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label={t('patients.gender')}
            value={gender}
            onChange={(e) => setGender(e.target.value as 'male' | 'female')}
            options={[
              { value: 'male', label: t('gender.male') },
              { value: 'female', label: t('gender.female') },
            ]}
          />
          <Input label={t('patients.birthDate')} type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('patients.phone')} value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" inputMode="tel" />
          <Select
            label={t('patients.bloodType')}
            value={bloodType}
            onChange={(e) => setBloodType(e.target.value)}
            options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'].map((b) => ({ value: b, label: b }))}
          />
        </div>

        <Textarea label={t('patients.allergies')} value={allergyInput} onChange={(e) => setAllergyInput(e.target.value)} rows={2} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag(allergies, setAllergies, allergyInput, setAllergyInput))} />
        <div className="-mt-2 flex flex-wrap gap-1.5">
          {allergies.map((a) => (
            <Chip key={a} label={a} tone="danger" onRemove={() => setAllergies(allergies.filter((x) => x !== a))} />
          ))}
          <button type="button" onClick={() => addTag(allergies, setAllergies, allergyInput, setAllergyInput)} className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700">
            <Plus className="h-3.5 w-3.5" /> {t('patients.addAllergy')}
          </button>
        </div>

        <Textarea label={t('patients.criticalAlerts')} value={alertInput} onChange={(e) => setAlertInput(e.target.value)} rows={2} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag(alerts, setAlerts, alertInput, setAlertInput))} />
        <div className="-mt-2 flex flex-wrap gap-1.5">
          {alerts.map((a) => (
            <Chip key={a} label={a} tone="warning" onRemove={() => setAlerts(alerts.filter((x) => x !== a))} />
          ))}
          <button type="button" onClick={() => addTag(alerts, setAlerts, alertInput, setAlertInput)} className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700">
            <Plus className="h-3.5 w-3.5" /> {t('patients.addAlert')}
          </button>
        </div>
      </div>
    </Dialog>
  );
}