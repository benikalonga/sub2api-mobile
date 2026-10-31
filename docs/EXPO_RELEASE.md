# Expo Release

This project is linked to an Expo / EAS project:

- Owner: `your-expo-username`
- Slug: `sub2api-mobile`
- Project ID: `00000000-0000-0000-0000-000000000000`

## Configuration in place

- `app.json` sets `owner`
- `app.json` sets `scheme = sub2apimobile`
- `app.json` sets `runtimeVersion.policy = appVersion`
- `app.json` sets `updates.url`
- `package.json` includes `expo-dev-client`
- `eas.json` defines three profiles: `development / preview / production`

## Check sign-in status

```bash
npx expo whoami
npx eas whoami
```

## Key takeaways

### 1. What Expo Go is good for

`Expo Go` works well for:

- `npx expo start`
- Local Metro development
- Quickly checking JS / RN screen changes

### 2. What Expo Go is not good for

Confirmed in practice:

- `Expo Go` cannot be used as a stable preview shell for an `EAS Update branch`
- To open a new version from a branch in Expo Updates, use a `development build / dev client`

### 3. Requirements for branch previews

A stable branch/update preview needs all of the following:

- An update published with `eas update --branch <branch>`
- An app shell that supports `expo-updates`
- An app shell that includes `expo-dev-client` or a matching native build
- A custom `scheme` configured for the project
- A `runtimeVersion` that matches the update

## Local development

```bash
npm run start
```

To connect a dev client to the local server:

```bash
npm run start:dev-client
```

## Preview build

```bash
npm run eas:build:preview
```

## Dev client / simulator testing

Development build:

```bash
npm run eas:build:development
```

Or per platform:

```bash
npm run eas:build:development:android
npm run eas:build:development:ios
```

The `development` profile is configured with:

- `developmentClient: true`
- `distribution: internal`
- `ios.simulator: true`

This is a good way to build a test shell first, then iterate quickly with `Expo / EAS Update`.

## Recommended release flow

### Option A: local development and debugging

Use for:

- UI changes
- Investigating blank screens
- Debugging routes

Command:

```bash
npm run start
```

### Option B: publish a branch for the dev client

Use when you:

- Want to see a new branch/update in Expo Updates
- Want the test shell to pick up OTA updates directly

Steps:

```bash
npx eas-cli@latest update --branch preview --message "your message"
```

Then verify the branch in the dev client / development build.

### Option C: build the shell first, then use OTA

If you do not have a suitable dev client yet:

```bash
npm run eas:build:development:android
npm run eas:build:development:ios
```

After installing the development shell, publish:

```bash
npx eas-cli@latest update --branch preview --message "your message"
```

## Troubleshooting

### 1. Works locally, blank screen after publishing to a branch

Check:

- Whether you opened it in `Expo Go`
- Whether the shell is a `development build`
- Whether the project has a `scheme`
- Whether `runtimeVersion` matches

### 2. Branch published, but the device did not update

Confirm:

- You are looking at the correct project
- The branch is `preview`
- The shell's channel matches
- You are using a dev client / native preview shell

### 3. Deep link error: no custom scheme defined

`app.json` has no custom `scheme`, or the native shell is outdated and needs a rebuild.

## GitHub Actions build

The repository includes a workflow: `.github/workflows/eas-build.yml`

Before using it, add this secret to the GitHub repository:

- `EXPO_TOKEN`

To trigger it:

1. Open the repository's `Actions` tab
2. Select `EAS Build`
3. Click `Run workflow`
4. Choose:
   - `profile`: `preview` or `production`
   - `platform`: `android` / `ios` / `all`

The workflow runs:

```bash
npm ci
npx eas build --non-interactive --profile <profile> --platform <platform>
```

## Production build

```bash
npm run eas:build:production
```

## OTA updates

Preview:

```bash
npx eas update --branch preview --message "preview update"
```

Production:

```bash
npx eas update --branch production --message "production update"
```
