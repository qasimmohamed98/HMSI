import type { Context } from 'hono';
import { z } from 'zod';
import type { Schema } from 'zod';

export type Validation = { ok: true; data: unknown } | { ok: false; json: Response };

export async function parseBody(c: Context, schema: Schema): Promise<Validation> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return { ok: false, json: c.json({ message: 'جسم الطلب غير صالح' }, 400) };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? 'بيانات غير صحيحة';
    return { ok: false, json: c.json({ message }, 422) };
  }
  return { ok: true, data: result.data };
}

export function pick<T extends Record<string, unknown>>(obj: T, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = obj[k];
  return out;
}

export { z };