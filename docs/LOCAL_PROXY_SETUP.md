# Local Proxy Setup

This project ships a minimal proxy layer that solves two problems:

- CORS when Expo Web calls the `Sub2API` admin API
- Keeping the admin API key out of the client

## Start the proxy

```bash
SUB2API_BASE_URL="https://api.example.com" \
SUB2API_ADMIN_API_KEY="admin-xxxx" \
ALLOW_ORIGIN="http://localhost:8081" \
npm run proxy
```

Default proxy address: `http://localhost:8787`

Optional environment variables:

- `PORT`: proxy port, default `8787`
- `ALLOW_ORIGIN`: allowed web origin, default `*`

## Start Expo Web

```bash
npm run web
```

## Bundle optimization flags

`metro.config.js` already enables more aggressive import optimization. For local or CI builds, you can also add:

```bash
EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH=1 \
EXPO_UNSTABLE_TREE_SHAKING=1 \
npx expo export --platform web
```

These variables are best suited to production builds or bundle analysis. Keep them separate from day-to-day development.

## Start both with one command

```bash
SUB2API_BASE_URL="https://api.example.com" \
SUB2API_ADMIN_API_KEY="admin-xxxx" \
ALLOW_ORIGIN="http://localhost:8081" \
npm run dev:web-proxy
```

## Server URL in the app

On the settings page, set `Base URL` to:

```txt
http://localhost:8787
```

## Health check

Open: `http://localhost:8787/healthz`

If it returns:

```json
{
  "ok": true,
  "upstreamConfigured": true,
  "apiKeyConfigured": true
}
```

the proxy is configured correctly.

## Aggregated API key endpoint

To separate "user API keys" from "upstream accounts" in the admin UI, the local proxy adds an aggregated endpoint:

- `GET /api/v1/keys`

This endpoint does not forward the upstream user-level `/api/v1/keys`. It aggregates the admin endpoints instead:

- `GET /api/v1/admin/users`
- `GET /api/v1/admin/users/:id/api-keys`

Supported parameters:

- `page`
- `page_size`
- `search`
- `status`

Use it for the "user API keys" list in an internal admin console.
