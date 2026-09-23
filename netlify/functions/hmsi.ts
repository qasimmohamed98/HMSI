import type { Context, Config } from '@netlify/functions';
import { handle } from 'hono/netlify';
import { api } from '../../server/src/app.js';

const handler = handle(api);

export default async function hmsi(request: Request, context: Context): Promise<Response> {
  return handler(request, { context });
}

export const config: Config = {
  path: ['/api/*'],
};