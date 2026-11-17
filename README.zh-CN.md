# MarkVault 扩展

[English](README.md) | 简体中文

在浏览器中保存网页、整理标签页，并连接自己的 MarkVault 实例。

[![构建与发布](https://github.com/xinmang/markvault-extension/actions/workflows/extension.yml/badge.svg)](https://github.com/xinmang/markvault-extension/actions/workflows/extension.yml)
[![许可证：CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](LICENSE)

面向 Chrome、Edge、Brave、Opera 的 Manifest V3 扩展，包含弹出窗口、设置页和新标签页。

[下载安装包](https://github.com/xinmang/markvault-extension/releases/latest/download/markvault-extension-chrome.zip) · [版本记录](https://github.com/xinmang/markvault-extension/releases) · [问题反馈](https://github.com/xinmang/markvault-extension/issues) · [依赖审计](docs/DEPENDENCY-AUDIT.md)

## 功能

- **网页收藏**：编辑标题、描述和标签，同步到 MarkVault。
- **AI 辅助**：推荐标签、改写描述，两类模型可分别配置。
- **标签页组**：收纳当前窗口的网页，需要时重新打开。
- **快照与截图**：保存网页快照，或把帖子正文渲染成干净的图文卡片。
- **新标签页**：快捷入口、文件夹、组件和外观设置。
- **浏览器书签**：导入、整理并同步书签。

## 安装

1. 从 [最新 Release](https://github.com/xinmang/markvault-extension/releases/latest) 下载 `markvault-extension-chrome.zip`。GitHub 自动生成的源码压缩包不能直接加载。
2. 打开 `chrome://extensions/` 或 `edge://extensions/`，开启**开发者模式**。
3. 选择**加载已解压的扩展程序**，选中包含 `manifest.json` 的解压目录。
4. 将扩展固定到工具栏，并打开设置。

用 `checksums.sha256` 校验安装包：

```bash
sha256sum --check checksums.sha256                              # Linux
shasum -a 256 -c checksums.sha256                               # macOS
Get-FileHash .\markvault-extension-chrome.zip -Algorithm SHA256 # Windows
```

更新时保留原目录，替换文件后在扩展管理页点击**重新加载**。不要先卸载扩展，否则本地设置可能丢失。

## 连接 MarkVault

1. 部署并登录 [MarkVault](https://github.com/xinmang/MarkVault)，在**设置 → API** 中创建 API Key。
2. 在扩展设置中填写实例地址（例如 `https://bookmarks.example.com` 或 `http://localhost:8787`）和 API Key。
3. 需要 AI 时，配置服务商、接口地址和密钥，再分别选择标签模型和描述模型。
4. 网站截图默认对 `x.com`、`twitter.com`、`linux.do` 开启，可在扩展设置中增删网站。

如果实例拒绝扩展的跨域请求，把扩展来源加入主项目 `.env` 并重启：

```dotenv
CORS_ALLOWED_ORIGINS=chrome-extension://<扩展ID>
```

## 权限与数据

权限以 [manifest.json](manifest.json) 为准：storage、tabs、scripting、bookmarks、notifications、alarms、offscreen，以及用于网页提取、连接实例和 AI 服务的 HTTP/HTTPS 访问。

API Key 以**未加密**形式保存在 `chrome.storage.local`。请保护浏览器配置目录，不要共享含密钥的备份。使用 AI 时，网页数据会发送到你配置的 AI 服务；保存、同步或上传快照时，数据会发送到 MarkVault 实例。新书签默认公开，保存前请核对可见性。

## 本地开发

需要 Node.js 22.12+（推荐 24，见 `.nvmrc`）和 pnpm 12.4.2。

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
```

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 启动开发服务，从扩展管理页加载 `dist/` |
| `pnpm typecheck` | 检查 TypeScript 类型 |
| `pnpm build` | 类型检查、构建，并生成 ZIP 和 SHA-256 |
| `pnpm build:only` | 只构建 `dist/`，不生成安装包 |
| `pnpm icons` | 重新生成浏览器图标 |

## 发布

CI 会在每次推送和 PR 时构建。推送到 `main` 时，如果 `package.json` 与 `manifest.json` 的版本还没有对应标签，CI 会创建 `v<版本>` 并发布 GitHub Release，附带 `markvault-extension-chrome.zip` 和 `checksums.sha256`。Release 说明会列出上一个标签以来的全部提交。已有标签不会被移动，因此每个版本只能发布一次。

也可以手动发布：同步递增两个版本文件，依赖有变化时更新锁文件，执行 `pnpm typecheck` 和 `pnpm build`，然后推送匹配的标签：

```bash
git tag v0.1.0
git push origin v0.1.0
```

版本从 `0.1.0` 起步，每次提交递增末段（`0.1.1`、`0.1.2`……）。每段必须是 0–65535 的整数，且不能有前导零。

## 许可证

[CC BY-NC 4.0](LICENSE)，与 [MarkVault](https://github.com/xinmang/MarkVault) 使用同一许可证。扩展源自 [ai-tmarks/tmarks](https://github.com/ai-tmarks/tmarks)，保留 TMarks Team 署名。第三方依赖遵循各自许可证。
