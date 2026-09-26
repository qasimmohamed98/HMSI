import { Hono } from 'hono';
import { contextStorage } from 'hono/context-storage';
import { securityHeaders, csrfProtection, requireSecretOutsideLocal } from './middleware/security.js';
import { setUser, getSession } from './middleware/auth.js';
import { ensureMigrated } from './seed/migrate.js';
import { HttpError } from './lib/errors.js';
import { authRoutes } from './routes/auth.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { patientRoutes } from './routes/patients.js';
import { recordRoutes } from './routes/records.js';
import { attachmentRoutes } from './routes/attachments.js';
import { vitalsRoutes } from './routes/vitals.js';
import { admissionRoutes } from './routes/admissions.js';
import { wardRoutes } from './routes/wards.js';
import { userRoutes } from './routes/users.js';
import { doctorRoutes } from './routes/doctors.js';
import { reportRoutes } from './routes/reports.js';
import { staffRoutes } from './routes/staff.js';
import { orgRoutes } from './routes/org.js';
import { hospitalRoutes } from './routes/hospitals.js';
import { publicTrackRoutes } from './routes/publicTrack.js';
import { auditRoutes } from './routes/audit.js';
import { labelRoutes } from './routes/labels.js';
import { trashRoutes } from './routes/trash.js';
import { billingRoutes } from './routes/billing.js';
import { signupRoutes } from './routes/signup.js';
import { subscriptionGuard } from './lib/subscription.js';
import { siteRoutes, publicSiteRoutes } from './routes/site.js';
import { systemRoutes, healthRoutes } from './routes/system.js';
import { recordError } from './lib/monitor.js';
import { twofaRoutes, twofaAdminRoutes } from './routes/twofa.js';
import { notificationRoutes } from './routes/notifications.js';
import { pushRoutes } from './routes/push.js';
import { roundsRoutes } from './routes/rounds.js';
import { handoverRoutes } from './routes/handover.js';
import { careTeamRoutes } from './routes/careTeam.js';

export const api = new Hono();

// سياق الطلب متاح للمستودعات (فرض «الطبيب يرى مرضاه فقط» في getAdmissionScope)
api.use('*', contextStorage());
api.use('*', securityHeaders());
api.use('*', requireSecretOutsideLocal());
api.use('*', async (_c, next) => {
  await ensureMigrated();
  await next();
});
api.use('*', setUser);
api.use('*', csrfProtection());
api.use('*', subscriptionGuard());
// كلمة مرور مؤقتة أو ضعيفة: لا شيء متاح غير مسارات الحساب حتى تُغيَّر
api.use('*', async (c, next) => {
  const s = getSession(c);
  const path = new URL(c.req.url).pathname;
  if (s?.user.must_change_password && !path.startsWith('/api/auth/') && path !== '/api/health') {
    return c.json({ message: 'يجب تغيير كلمة المرور قبل المتابعة', code: 'password_change_required' }, 403, { 'X-Hmsi-Reason': 'password_change_required' });
  }
  // لم يوافق على شروط الاستخدام وسياسة الخصوصية (الإصدار الحالي): لا بيانات قبل الموافقة
  if (s?.user.terms_required && !path.startsWith('/api/auth/') && path !== '/api/health') {
    return c.json({ message: 'يجب الموافقة على شروط الاستخدام وسياسة الخصوصية قبل المتابعة', code: 'terms_required' }, 403, { 'X-Hmsi-Reason': 'terms_required' });
  }
  return next();
});

api.route('/api/auth/2fa', twofaRoutes);
api.route('/api/auth', authRoutes);
api.route('/api/dashboard', dashboardRoutes);
api.route('/api/patients', patientRoutes);
api.route('/api/patients', recordRoutes);
api.route('/api/patients', attachmentRoutes);
api.route('/api/patients', labelRoutes);
api.route('/api/vitals', vitalsRoutes);
api.route('/api/wards', wardRoutes);
api.route('/api/users', userRoutes);
api.route('/api/users', twofaAdminRoutes);
api.route('/api/doctors', doctorRoutes);
api.route('/api/admissions', admissionRoutes);
api.route('/api/reports', reportRoutes);
api.route('/api/__staff', staffRoutes);
api.route('/api/org', orgRoutes);
api.route('/api/hospitals', hospitalRoutes);
api.route('/api/public', publicTrackRoutes);
api.route('/api/audit', auditRoutes);
api.route('/api/trash', trashRoutes);
api.route('/api/billing', billingRoutes);
api.route('/api/public', signupRoutes);
api.route('/api/public', publicSiteRoutes);
api.route('/api/site', siteRoutes);
api.route('/api/system', systemRoutes);
api.route('/api/notifications', notificationRoutes);
api.route('/api/push', pushRoutes);
api.route('/api/medication-rounds', roundsRoutes);
api.route('/api/handover', handoverRoutes);
api.route('/api/care-team', careTeamRoutes);
api.route('/api/health', healthRoutes);

api.notFound((c) => c.json({ message: 'المسار غير موجود' }, 404));

api.onError(async (err, c) => {
  if (err instanceof HttpError) return c.json({ message: err.message, ...('code' in err ? { code: (err as { code: string }).code } : {}) }, err.status);
  console.error('[hmsi] unhandled error', err);
  const s = getSession(c);
  await recordError({
    source: 'server',
    message: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    detail: err instanceof Error ? (err.stack ?? '').split('\n').slice(1, 8).join('\n') : null,
    path: `${c.req.method} ${new URL(c.req.url).pathname}`,
    hospitalId: s?.user.hospital_id,
    userId: s?.user.id,
    userAgent: c.req.header('user-agent'),
  });
  return c.json({ message: 'حدث خطأ غير متوقع في الخادم' }, 500);
});
