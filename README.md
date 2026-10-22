# MarkVault Extension

**在浏览器中保存网页、整理标签页，并连接自己的 MarkVault 实例。**

[![构建与发布](https://github.com/xinmang/markvault-extension/actions/workflows/extension.yml/badge.svg)](https://github.com/xinmang/markvault-extension/actions/workflows/extension.yml)
[![许可证：MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

这是 [MarkVault](https://github.com/xinmang/MarkVault) 配套的 Manifest V3 浏览器扩展，包含弹出窗口、独立设置页和新标签页。面向现代 Chrome、Edge、Brave、Opera 等 Chromium 浏览器；当前只生成 Chromium 安装包，不提供 Firefox 版本。

[下载安装包](https://github.com/xinmang/markvault-extension/releases/latest/download/markvault-extension-chrome.zip) · [版本记录](https://github.com/xinmang/markvault-extension/releases) · [问题反馈](https://github.com/xinmang/markvault-extension/issues) · [依赖审计与维护](docs/DEPENDENCY-AUDIT.md)

## 功能

| 功能 | 说明 |
| --- | --- |
| 网页收藏 | 保存当前网页，编辑标题、描述与标签，同步到 MarkVault |
| AI 辅助 | 使用配置的 AI 服务推荐标签、整理收藏与文件夹 |
| 标签页组 | 收纳当前窗口中的网页，在需要时重新打开 |
| 网页快照 | 捕获网页内容并上传到连接的 MarkVault 实例 |
| 新标签页 | 快捷入口、文件夹、组件与外观设置 |
| 浏览器书签 | 导入、整理书签，并通过配置的目录与服务同步 |

## 安装

1. 从 [最新正式 Release](https://github.com/xinmang/markvault-extension/releases/latest) 下载 **`markvault-extension-chrome.zip`**，解压到长期保留的目录。GitHub 自动生成的 `Source code` 压缩包是源码，不能直接加载。
2. 打开 `chrome://extensions/` 或 `edge://extensions/`，开启“开发者模式”。
3. 选择“加载已解压的扩展程序”，选中包含 `manifest.json` 的解压目录。
4. 将扩展固定到工具栏，打开设置，按下文连接自己的实例。

Release 同时提供 `checksums.sha256`。Linux 可在下载目录运行 `sha256sum --check checksums.sha256`，macOS 使用 `shasum -a 256 -c checksums.sha256`；Windows PowerShell 可运行 `Get-FileHash .\markvault-extension-chrome.zip -Algorithm SHA256`，与校验文件中的值比较。

更新时保留原安装目录，备份所需配置后，用新版本文件替换并在扩展管理页面点击“重新加载”。不要通过卸载再安装更新，以免丢失浏览器本地配置。首次正式 Release 发布成功前，上述下载地址可能返回 404，此时可按开发说明自行构建。

## 连接 MarkVault

1. 部署并登录 [MarkVault](https://github.com/xinmang/MarkVault)，在“设置 → API”中创建权限合适的 API Key。
2. 在扩展设置中填写实例的完整网站地址，例如 `https://bookmarks.example.com`；本机部署可填 `http://localhost:8787`。不要把 API Key 填入地址栏。
3. 填入 MarkVault API Key 并保存配置，验证连接后再保存网页。
4. 需要 AI 时，另行设置 AI 服务、模型、接口地址和对应密钥；MarkVault API Key 与 AI 服务密钥用途不同。

如果实例拒绝扩展的跨域请求，在扩展管理页复制扩展 ID，把完整来源加入主项目 `.env`，再执行 `docker compose up -d`：

```dotenv
CORS_ALLOWED_ORIGINS=chrome-extension://你的扩展ID
```

多个来源用逗号分隔。更换加载目录可能导致扩展 ID 改变，需要同步更新白名单。开发时的 Vite 地址不应加入生产实例的长期信任列表。

## 权限与数据

实际权限以根目录 [manifest.json](manifest.json) 及浏览器安装提示为准：

| 权限 | 用途 |
| --- | --- |
| `storage`、`unlimitedStorage` | 保存设置、连接配置、缓存和新标签页数据 |
| `activeTab`、`tabs` | 获取网页信息、收纳标签页以及打开收藏 |
| `scripting` | 在网页中执行内容提取和快照捕获 |
| `bookmarks` | 读取、导入和整理浏览器书签目录 |
| `notifications` | 显示保存结果等操作通知 |
| `alarms` | 在后台定时执行同步和刷新 |
| HTTP/HTTPS 站点访问 | 连接用户配置的自托管实例、AI 接口，并提取网页内容 |

扩展会替换浏览器的新标签页，内容脚本匹配普通网页。内置页面、扩展商店等浏览器受限页面可能无法提取或保存快照。

连接密钥当前保存在浏览器的 **`chrome.storage.local`，没有额外加密**。请保护浏览器配置目录，不要共享含密钥的配置、备份或截图。开启 AI 功能后，参与推荐的网页信息会发送到你配置的 AI 服务；保存书签、同步和上传快照时，相关数据会发送到 MarkVault 实例。保存前请核对公开/私有状态，当前默认偏好会将新书签设为公开。

## 本地开发

需要 **Node.js 22.12+，推荐 24**（见 `.nvmrc`），以及 **pnpm 12.4.2**（见 `packageManager`）：

```bash
git clone https://github.com/xinmang/markvault-extension.git
cd markvault-extension
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
```

`pnpm-workspace.yaml` 仅允许构建所需的 `esbuild`、`sharp` 执行安装脚本，不要为解决安装问题而放开所有依赖脚本。

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 启动扩展开发服务，再从扩展管理页加载 `dist/` |
| `pnpm typecheck` | 检查 TypeScript 类型 |
| `pnpm build` / `pnpm build:chrome` | 类型检查、生产构建、生成 ZIP 与 SHA-256 |
| `pnpm build:only` | 只生成生产 `dist/`，不生成发布安装包 |
| `pnpm icons` | 从图标素材重新生成浏览器图标 |

开发模式需要保持 Vite 运行，只在可信的本机开发环境使用。生产安装应使用 `pnpm build` 产物。

```text
manifest.json          扩展入口、权限与版本
src/background/        后台 Service Worker 和任务处理
src/content/           网页内容脚本
src/popup/             工具栏弹出窗口
src/options/           设置与导入页面
src/newtab/            新标签页
src/lib/               服务、存储、状态与通用工具
public/                图标和多语言资源
scripts/               构建、打包与图标生成
dist/                  可加载的扩展（构建生成）
release/               ZIP 和校验和（构建生成）
```

## 发布

[GitHub Actions](.github/workflows/extension.yml) 在推送 `main`、提交 PR 或手动运行时检查并打包，构建产物保留 30 天；推送版本标签时还会创建正式 GitHub Release。

1. 同步修改 `package.json` 和 `manifest.json` 的版本，运行 `pnpm install --lockfile-only` 更新锁文件，并执行类型检查、构建和依赖审计。
2. 用构建后的 `dist/` 验证安装、保存书签、AI 配置、标签页组、快照和同步，提交源码及锁文件。
3. 推送与版本一致的标签，例如两个文件都为 `1.0.4` 时：

   ```bash
   git tag v1.0.4
   git push origin v1.0.4
   ```

4. 确认工作流成功，并检查 Release 中存在 `markvault-extension-chrome.zip` 和 `checksums.sha256`。仓库与 Release 需要允许目标用户访问。

构建脚本会拒绝不一致的版本标签，ZIP 根目录包含可加载的 `manifest.json`、运行资源及项目许可证。产物无需复制到 MarkVault 主仓库；主应用通过 GitHub 的 `releases/latest/download/markvault-extension-chrome.zip` 获取最新正式版。

## 贡献与来源

提交问题时请提供扩展版本、浏览器版本、实例版本和脱敏后的复现步骤；不要在公开 Issue 中提交 API Key 或私人书签。提交代码前至少执行 `pnpm typecheck` 和 `pnpm build`，修改权限时同步更新本文，依赖升级同时更新锁文件与审计记录。

本仓库从 [xinmang/tmarks](https://github.com/xinmang/tmarks) 的浏览器扩展源码独立维护，保留 TMarks Team 原有署名及当前仓库的 [MIT 许可证](LICENSE)。主应用与扩展分别维护许可证，请分别查阅对应仓库；第三方依赖仍遵循各自许可证。
