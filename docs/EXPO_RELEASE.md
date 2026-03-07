# Expo Release

当前项目已绑定新的 Expo / EAS 项目：

- Owner: `ckken`
- Slug: `sub2api-mobile`
- Project ID: `00000000-0000-0000-0000-000000000000`

## 已完成配置

- `app.json` 已配置 `owner`
- `app.json` 已配置 `runtimeVersion.policy = appVersion`
- `app.json` 已配置 `updates.url`
- `eas.json` 已配置 `development / preview / production` 三套 profile

## 登录状态检查

```bash
npx expo whoami
npx eas whoami
```

## 预览包

```bash
npm run eas:build:preview
```

## GitHub Actions 构建

仓库已提供工作流：`.github/workflows/eas-build.yml`

使用前需要在 GitHub 仓库 Secrets 里配置：

- `EXPO_TOKEN`

触发方式：

1. 打开 GitHub 仓库的 `Actions`
2. 选择 `EAS Build`
3. 点击 `Run workflow`
4. 选择：
   - `profile`: `preview` 或 `production`
   - `platform`: `android` / `ios` / `all`

工作流会执行：

```bash
npm ci
npx eas build --non-interactive --profile <profile> --platform <platform>
```

## 正式包

```bash
npm run eas:build:production
```

## OTA 更新

预发：

```bash
npx eas update --branch preview --message "preview update"
```

正式：

```bash
npx eas update --branch production --message "production update"
```

## 当前还需要你补的内容

- iOS 的 `bundleIdentifier`
- Android 的 `package`

如果不补这两个标识，原生构建时 EAS 还会继续要求你确认或生成。
