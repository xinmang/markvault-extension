# MarkVault Extension

English | [简体中文](README.zh-CN.md)

Save pages, organize tabs, and connect to your self-hosted MarkVault instance from the browser.

[![Build and release](https://github.com/xinmang/markvault-extension/actions/workflows/extension.yml/badge.svg)](https://github.com/xinmang/markvault-extension/actions/workflows/extension.yml)
[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](LICENSE)

A Manifest V3 extension for Chrome, Edge, Brave, and Opera, with a popup, options page, and new tab page.

[Download](https://github.com/xinmang/markvault-extension/releases/latest/download/markvault-extension-chrome.zip) · [Releases](https://github.com/xinmang/markvault-extension/releases) · [Issues](https://github.com/xinmang/markvault-extension/issues) · [Dependency audit](docs/DEPENDENCY-AUDIT.md)

## Features

- **Save pages** — edit the title, description, and tags; sync to MarkVault.
- **AI assistance** — suggest tags and rewrite descriptions with separately configurable models.
- **Tab groups** — collect the current window's tabs and reopen them later.
- **Snapshots and screenshots** — capture page content or render social posts as clean image cards.
- **New tab** — shortcuts, folders, widgets, and appearance settings.
- **Bookmarks** — import, organize, and sync browser bookmarks.

## Install

1. Download `markvault-extension-chrome.zip` from the [latest release](https://github.com/xinmang/markvault-extension/releases/latest). Source archives cannot be loaded as an extension.
2. Open `chrome://extensions/` or `edge://extensions/` and enable **Developer mode**.
3. Choose **Load unpacked** and select the extracted folder that contains `manifest.json`.
4. Pin the extension and open its settings.

Verify the download with `checksums.sha256`:

```bash
sha256sum --check checksums.sha256                              # Linux
shasum -a 256 -c checksums.sha256                               # macOS
Get-FileHash .\markvault-extension-chrome.zip -Algorithm SHA256 # Windows
```

To update, replace the files in the same folder and click **Reload** in the extensions page. Do not uninstall the extension first, or local settings may be lost.

## Connect MarkVault

1. Deploy and sign in to [MarkVault](https://github.com/xinmang/MarkVault), then create an API key under **Settings → API**.
2. In the extension settings, enter your instance URL (for example `https://bookmarks.example.com` or `http://localhost:8787`) and the API key.
3. For AI features, configure a provider, endpoint, and key, then choose a model for tags and one for descriptions.
4. Screenshots are enabled for `x.com`, `twitter.com`, and `linux.do` by default. Add or remove sites in the extension settings.

If your instance rejects cross-origin requests, add the extension origin to the main app's `.env` and restart it:

```dotenv
CORS_ALLOWED_ORIGINS=chrome-extension://<extension-id>
```

## Permissions and data

Permissions are declared in [manifest.json](manifest.json): storage, tabs, scripting, bookmarks, notifications, alarms, offscreen, and HTTP/HTTPS access for page extraction and connections to your instance and AI provider.

API keys are stored **unencrypted** in `chrome.storage.local`. Protect your browser profile and do not share backups that contain keys. When AI features are used, page data is sent to the AI service you configure. When saving, syncing, or uploading snapshots, data is sent to your MarkVault instance. New bookmarks are public by default; check the visibility before saving.

## Development

Requires Node.js 22.12+ (24 recommended, see `.nvmrc`) and pnpm 12.4.2.

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
```

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the dev server; load `dist/` as an unpacked extension |
| `pnpm typecheck` | Type-check TypeScript |
| `pnpm build` | Type-check, build, and create the ZIP with SHA-256 |
| `pnpm build:only` | Build `dist/` without packaging |
| `pnpm icons` | Regenerate browser icons |

## Release

CI builds every push and pull request. On a push to `main`, if `package.json` and `manifest.json` contain a version without a matching tag, CI creates `v<version>` and publishes a GitHub Release with `markvault-extension-chrome.zip` and `checksums.sha256`. The release notes list every commit since the previous tag. Existing tags are never moved, so each version can be released only once.

You can also release manually by bumping both versions, refreshing the lockfile if dependencies changed, running `pnpm typecheck` and `pnpm build`, and pushing a matching tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Versions start at `0.1.0`, and every commit increments the last segment (`0.1.1`, `0.1.2`, …). Each segment must be an integer from 0 to 65535 without leading zeros.

## License

[CC BY-NC 4.0](LICENSE), the same license as [MarkVault](https://github.com/xinmang/MarkVault). The extension originated from [ai-tmarks/tmarks](https://github.com/ai-tmarks/tmarks); TMarks Team attribution is retained. Third-party dependencies keep their own licenses.
