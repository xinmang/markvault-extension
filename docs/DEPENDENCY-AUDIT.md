# 依赖审计与维护记录

检查日期：2026-10-12。结果对应当前锁文件，使用 npm 官方审计接口；告警数量不等同于可直接利用的漏洞数量。

## 升级结果

全量依赖审计由 **89 条告警（38 高危、39 中危、12 低危）** 降至 **1 条开发依赖高危告警**；生产依赖审计为 **0 条**。

```bash
pnpm audit --json --registry=https://registry.npmjs.org
pnpm audit --prod --registry=https://registry.npmjs.org
```

| 组件 | 本次解析版本 | 说明 |
| --- | --- | --- |
| Vite / CRXJS | `7.3.7` / `2.7.1` | 更新开发服务与扩展打包链，保留 CRXJS 2.x |
| DOMPurify | `3.4.16` | 更新网页内容净化依赖 |
| archiver | `8.0.0` | 打包脚本迁移到 `ZipArchive` API |
| sharp | `0.35.5` | 更新图标构建的原生图像处理依赖 |
| PostCSS / Tailwind CSS | `8.5.29` / `3.4.19` | 保留 Tailwind 3，避免同时引入样式迁移 |
| OpenAI / Anthropic SDK | `6.49.0` / `0.70.1` | 更新现有版本范围内的 SDK |

删除了不再需要的 `@types/dompurify`，使用 DOMPurify 自带类型。固定 Node 推荐版本与 pnpm 版本，提交锁文件，并仅允许 `esbuild`、`sharp` 执行安装脚本。

Tailwind 3 引入的 `postcss-selector-parser` 6.x 存在 [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf)，修复从 7.1.6 开始。通过 `pnpm-workspace.yaml` 中的定向 override 更新到修复范围，类型检查和完整样式构建已通过。未来 Tailwind 自行升级此依赖后应移除此 override。

## 尚未解决的告警

`braces@3.0.3`：[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)，深层嵌套 glob 模式可能造成栈耗尽。审计接口在检查当日没有给出已发布修复版本。

依赖路径均为开发工具：`tailwindcss → chokidar / micromatch / fast-glob → braces`。它不进入扩展运行依赖，但构建不可信的输入仍有风险。未屏蔽该告警、未伪造修复版本，也未为了数字清零直接迁移 Tailwind 4。

后续优先跟进上游修复；若长期没有修复，再单独迁移 Tailwind，并验证弹出窗口、设置页和新标签页的样式。CI 对生产依赖设置高危审计门禁，维护时仍需运行全量审计。

## 公开准备与后续改进

- 安装包由源码构建，附项目 LICENSE 和独立 SHA-256 文件，使用固定 Release 附件名。
- 本次生成的 ZIP 共 46 个条目，manifest 入口和资源引用检查通过；33 个文本资源未发现开发服务入口或检查规则覆盖的凭证模式。校验和匹配，错误标签和无效目标的构建拒绝检查通过。
- 删除未被源码使用的 `history` 权限；HTTP/HTTPS 站点访问仍由网页提取和自定义服务连接使用。
- API Key 当前直接保存在 `chrome.storage.local`，没有额外加密；未将未使用的加密工具当成现有安全保证。
- 后续可将站点权限改为按需申请，但需要覆盖内容脚本、快照、跨域服务请求和已有配置迁移。
- 当前验证覆盖类型、构建与产物结构；尚缺 Chrome/Edge 自动安装和核心业务的浏览器端回归测试。
- 仍应由维护者在公开前核对全部 Git 历史、来源署名、第三方许可，以及 GitHub 的可见性和安全报告设置。

依赖审计是时间点检查，不覆盖所有应用逻辑、浏览器策略、系统组件或未公开漏洞。
