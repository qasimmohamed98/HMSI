import { Hono } from 'hono';
import { securityHeaders, csrfProtection, requireSecretOutsideLocal } from './middleware/security.js';
import { setUser } from './middleware/auth.js';
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

export const api = new Hono();

api.use('*', securityHeaders());
api.use('*', requireSecretOutsideLocal());
api.use('*', async (_c, next) => {
  await ensureMigrated();
  await next();
});
api.use('*', setUser);
api.use('*', csrfProtection());

api.route('/api/auth', authRoutes);
api.route('/api/dashboard', dashboardRoutes);
api.route('/api/patients', patientRoutes);
api.route('/api/patients', recordRoutes);
api.route('/api/patients', attachmentRoutes);
api.route('/api/patients', labelRoutes);
api.route('/api/vitals', vitalsRoutes);
api.route('/api/wards', wardRoutes);
api.route('/api/users', userRoutes);
api.route('/api/doctors', doctorRoutes);
api.route('/api/admissions', admissionRoutes);
api.route('/api/reports', reportRoutes);
api.route('/api/__staff', staffRoutes);
api.route('/api/org', orgRoutes);
api.route('/api/hospitals', hospitalRoutes);
api.route('/api/public', publicTrackRoutes);
api.route('/api/audit', auditRoutes);
api.route('/api/trash', trashRoutes);

api.notFound((c) => c.json({ message: 'المسار غير موجود' }, 404));

api.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ message: err.message }, err.status);
  console.error('[hmsi] unhandled error', err);
  return c.json({ message: 'حدث خطأ غير متوقع في الخادم' }, 500);
});
