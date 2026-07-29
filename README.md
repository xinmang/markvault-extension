# MarkVault Chrome Extension

MarkVault 的 Chromium 浏览器扩展，提供以下能力：

- 保存当前网页并生成 AI 标签
- 收纳和恢复当前窗口的标签页组
- 与 MarkVault 服务同步书签、标签和标签页组
- NewTab、选项页和弹出窗口
- 支持 Chrome、Edge、Brave、Opera 等 Chromium 内核浏览器

## 来源与版本

本仓库从 [xinmang/tmarks](https://github.com/xinmang/tmarks) 历史提交中提取插件源码，使用提交 `d4062f54ef7b725f0c1f2295c96f11c04e014b7e` 的 `tab/` 目录（该目录最后一次实际修改提交为 `2ef452859136cb527405296a27c6438fd3b3ccad`）。源码遵循上游插件附带的 MIT 许可证，详见 [LICENSE](./LICENSE)。

## 开发

需要 Node.js 20.19+（或 22.12+）和 pnpm：

```bash
pnpm install
pnpm typecheck
pnpm build
```

`pnpm build` 会生成：

```text
release/markvault-extension-chrome.zip
```

在 Chrome 中打开 `chrome://extensions`，开启“开发者模式”，选择“加载已解压的扩展程序”，加载 `dist/` 目录即可。

首次使用时，在扩展设置中填写 MarkVault 网站地址和 API Key。默认地址为本地开发服务器 `http://localhost:8787`；部署到其他地址时请改为实际地址。

## 与 MarkVault 主项目配套

主项目位于 `C:\Github3\MarkVault` 时，可将构建后的 ZIP 复制到主项目的 `public/extensions/` 目录，并按主项目页面提供下载。
