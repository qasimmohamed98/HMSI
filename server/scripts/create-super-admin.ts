/**
 * إنشاء أول مدير عام على قاعدة فارغة (تثبيت جديد)، أو إعادة تعيين كلمة مروره إن نسيها.
 *   node dist/scripts/create-super-admin.js [username]              ← إنشاء (يُرفض إن وُجد مدير عام)
 *   node dist/scripts/create-super-admin.js [username] --reset      ← كلمة مؤقتة جديدة لمدير عام موجود
 * كلمة المرور المؤقتة عشوائية وتُطبع مرة واحدة، ويُجبَر صاحبها على تغييرها عند أول دخول.
 */
import { randomBytes } from 'node:crypto';
import { db, uuid } from '../db/index.js';
import { ensureMigrated } from '../src/seed/migrate.js';
import { hashPassword } from '../src/lib/password.js';

const args = process.argv.slice(2);
const reset = args.includes('--reset');
const username = (args.find((a) => !a.startsWith('--')) ?? 'admin').trim().toLowerCase();
if (!/^[a-z0-9_.-]{3,64}$/.test(username)) {
  console.error('اسم المستخدم: أحرف إنجليزية وأرقام فقط (3 أحرف على الأقل)');
  process.exit(2);
}

// كلمة مؤقتة سهلة القراءة: بلا أحرف متشابهة (0/O، 1/l)
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const temp = Array.from(randomBytes(14), (b) => alphabet[b % alphabet.length]).join('') + '#7';

await ensureMigrated();
const existing = await db.execute({ sql: `SELECT id, role FROM users WHERE lower(username) = ? LIMIT 1`, args: [username] });

if (reset) {
  const u = existing.rows[0] as unknown as { id: string; role: string } | undefined;
  if (!u || u.role !== 'super_admin') {
    console.error(`لا يوجد مدير عام باسم ${username}`);
    process.exit(1);
  }
  await db.batch([
    { sql: `UPDATE users SET password_hash = ?, must_change_password = 1, is_active = 1 WHERE id = ?`, args: [await hashPassword(temp), u.id] },
    { sql: `DELETE FROM sessions WHERE user_id = ?`, args: [u.id] },
  ]);
} else {
  const supers = await db.execute(`SELECT COUNT(*) AS n FROM users WHERE role = 'super_admin'`);
  if (Number((supers.rows[0] as unknown as { n: number }).n) > 0) {
    console.error('يوجد مدير عام بالفعل — لإعادة تعيين كلمة مروره استخدم --reset');
    process.exit(1);
  }
  if (existing.rows.length) {
    console.error(`اسم المستخدم ${username} مستخدم بالفعل`);
    process.exit(1);
  }
  // مساحة «إدارة النظام» للمدير العام (بلا مرضى ولا اشتراك)
  const sys = await db.execute(`SELECT id FROM hospitals WHERE code = 'SYSTEM' LIMIT 1`);
  let hospitalId = sys.rows[0] ? String((sys.rows[0] as unknown as { id: string }).id) : '';
  if (!hospitalId) {
    hospitalId = uuid('h');
    await db.execute({
      sql: `INSERT INTO hospitals (id, name_ar, name_en, code) VALUES (?, 'إدارة النظام', 'System administration', 'SYSTEM')`,
      args: [hospitalId],
    });
  }
  await db.execute({
    sql: `INSERT INTO users (id, hospital_id, username, full_name_ar, full_name_en, role, password_hash, is_active, must_change_password)
          VALUES (?, ?, ?, 'مدير النظام', 'System administrator', 'super_admin', ?, 1, 1)`,
    args: [uuid('u'), hospitalId, username, await hashPassword(temp)],
  });
}

console.log('');
console.log(reset ? '✓ أُعيد تعيين كلمة المرور' : '✓ أُنشئ المدير العام');
console.log(`  اسم المستخدم:        ${username}`);
console.log(`  كلمة المرور المؤقتة: ${temp}`);
console.log('  ستُطلب كلمة مرور جديدة عند أول دخول.');
process.exit(0);
