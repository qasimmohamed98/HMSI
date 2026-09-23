import { serve } from '@hono/node-server';
import { api } from './app.js';

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: api.fetch, port });
console.log(`HMSI API listening on http://localhost:${port}`);