import type { Ward, Bed } from '@hmsi/shared';
import { db } from '../../db/index.js';

export async function getWards(hospitalId: string): Promise<Ward[]> {
  const wards = await db.execute({
    sql: `SELECT w.*, d.name_ar AS department_name_ar, d.name_en AS department_name_en
          FROM wards w LEFT JOIN departments d ON d.id = w.department_id
          WHERE d.hospital_id = ?
          ORDER BY w.name_ar ASC`,
    args: [hospitalId],
  });
  const beds = await db.execute({
    sql: `SELECT b.* FROM beds b JOIN wards w ON w.id = b.ward_id JOIN departments d ON d.id = w.department_id WHERE d.hospital_id = ?`,
    args: [hospitalId],
  });

  const byWard = new Map<string, Bed[]>();
  for (const row of beds.rows) {
    const r = row as Record<string, unknown>;
    const bed: Bed = {
      id: String(r.id),
      ward_id: String(r.ward_id),
      room: String(r.room),
      bed_no: String(r.bed_no),
      status: String(r.status) === 'occupied' ? 'occupied' : 'free',
      code: String(r.code),
    };
    const list = byWard.get(bed.ward_id) ?? [];
    list.push(bed);
    byWard.set(bed.ward_id, list);
  }

  return wards.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      department_id: String(r.department_id),
      department_name_ar: String(r.department_name_ar ?? ''),
      department_name_en: String(r.department_name_en ?? ''),
      name_ar: String(r.name_ar),
      name_en: String(r.name_en),
      type: String(r.ward_type) as Ward['type'],
      beds: byWard.get(String(r.id)) ?? [],
    };
  });
}