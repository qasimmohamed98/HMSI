import { db } from '../../db/index.js';

/**
 * التدرج الوظيفي العراقي: مدير القسم (مدير الصيادلة، مدير الأشعة، مدير المختبر...) يدير موظفي قسمه
 * فقط، دون صلاحية «users.manage» الشاملة على المستشفى كله. هذه الدالة تعيد الأقسام التي يترأسها
 * المستخدم ضمن مستشفاه الحالي؛ نتيجة فارغة تعني أنه ليس مديراً لأي قسم.
 */
export async function getHeadedDepartmentIds(userId: string, hospitalId: string): Promise<string[]> {
  const rows = await db.execute({
    sql: `SELECT id FROM departments WHERE hospital_id = ? AND head_user_id = ?`,
    args: [hospitalId, userId],
  });
  return rows.rows.map((r) => String((r as Record<string, unknown>).id));
}
