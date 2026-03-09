# sub2api-mobile

Mobile-first admin console for Sub2API operations, built with Expo + React Native + Expo Router.

## Mobile Preview

![Mobile Preview](docs/mobile.jpg)

## Highlights

- Cross-platform app (iOS / Android / Web) for operational and admin workflows.
- Server health and metrics monitoring views.
- User, API key, account, and group management pages.
- Built-in local admin proxy (`server/index.js`) for safer web-side admin integration.
- Multi-account admin server switching in settings.

## Tech Stack

- Expo SDK 54
- React Native 0.81
- React 19
- Expo Router
- TanStack Query
- Valtio
- Express (local proxy)

## Prerequisites

- Node.js 20+
- npm 10+

## Getting Started

Install dependencies:

```bash
npm ci
```

Run locally:

```bash
npm run start
```

Common targets:

```bash
npm run android
npm run ios
npm run web
```

## Local Admin Proxy (Web-Friendly)

For web usage with admin APIs, start the local proxy with environment variables:

```bash
SUB2API_BASE_URL="https://your-upstream-host.example.com" \
SUB2API_ADMIN_API_KEY="admin-xxxx" \
ALLOW_ORIGIN="http://localhost:8081" \
npm run proxy
```

Then point the app `Base URL` to:

```txt
http://localhost:8787
```

See full details in [docs/LOCAL_PROXY_SETUP.md](docs/LOCAL_PROXY_SETUP.md).

## Build & Release

EAS scripts:

```bash
npm run eas:build:development
npm run eas:build:preview
npm run eas:build:production
```

OTA update scripts:

```bash
npm run eas:update:preview -- "your message"
npm run eas:update:production -- "your message"
```

Additional release notes: [docs/EXPO_RELEASE.md](docs/EXPO_RELEASE.md)

## Project Structure

```txt
app/                 Expo Router routes/screens
src/components/      Reusable UI components
src/services/        Admin API request layer
src/store/           Global config/account state (Valtio)
src/lib/             Utilities, query client, fetch helpers
docs/                Operational and release documentation
server/              Local Express proxy for admin APIs
```

## Security Notes

- Web builds are intentionally configured to avoid persistent storage of `adminApiKey`.
- Native platforms continue to use secure storage semantics.
- For responsible disclosure, see [SECURITY.md](SECURITY.md).

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
