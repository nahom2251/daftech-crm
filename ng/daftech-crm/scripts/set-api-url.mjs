// Rewrites the production/staging apiBaseUrl at build time from the API_BASE_URL
// environment variable, so the same commit can be deployed against any API host
// (Render, staging, on-prem) without editing source.
//
// Usage: API_BASE_URL=https://daftech-crm-api.onrender.com/api npm run build:prod

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const target = process.env.ENV_FILE ?? 'src/environments/environment.production.ts';
const apiBaseUrl = process.env.API_BASE_URL;

if (!apiBaseUrl) {
  console.log('[set-api-url] API_BASE_URL not set — keeping the committed apiBaseUrl.');
  process.exit(0);
}

const path = resolve(here, '..', target);
const source = readFileSync(path, 'utf8');
const normalized = apiBaseUrl.replace(/\/+$/, '');
const updated = source.replace(/apiBaseUrl:\s*'[^']*'/, `apiBaseUrl: '${normalized}'`);

if (updated === source) {
  console.error(`[set-api-url] Could not find an apiBaseUrl entry in ${target}.`);
  process.exit(1);
}

writeFileSync(path, updated);
console.log(`[set-api-url] ${target} -> ${normalized}`);
