import { createClient, type Client, type Transaction } from '@libsql/client';

function buildClient(): Client {
  const url = process.env.TURSO_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    return createClient({ url: 'file:local.db' });
  }
  return authToken ? createClient({ url, authToken }) : createClient({ url });
}

export const db: Client = buildClient();

export type DbTx = Transaction;

export async function nowIso(): Promise<string> {
  return new Date().toISOString();
}

export function uuid(prefix: string): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${hex}`;
}