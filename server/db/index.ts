import { createClient, type Client, type Transaction } from '@libsql/client';

function buildClient(): Client {
  const url = process.env.TURSO_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    // قاعدة محلية للتطوير والاختبار؛ LOCAL_DB_URL يسمح بقاعدة منفصلة (مثل اختبار smoke)
    return createClient({ url: process.env.LOCAL_DB_URL ?? 'file:local.db' });
  }
  return authToken ? createClient({ url, authToken }) : createClient({ url });
}

export const db: Client = buildClient();

export type DbTx = Transaction;

/** يشغّل fn داخل transaction كتابة؛ commit عند النجاح وrollback عند أي خطأ. */
export async function withTx<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  const tx = await db.transaction('write');
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (e) {
    await tx.rollback().catch(() => undefined);
    throw e;
  } finally {
    tx.close();
  }
}

export function uuid(prefix: string): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${hex}`;
}

/** رمز عائلة من 6 أرقام بمولّد عشوائي آمن */
export function generateFamilyPin(): string {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return String(n[0] % 1_000_000).padStart(6, '0');
}
