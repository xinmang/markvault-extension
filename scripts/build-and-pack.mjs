#!/usr/bin/env node

// 保留旧命令入口，统一使用独立仓库的构建与发布目录。
console.warn('build:legacy 已合并到 pnpm build，产物位于 release/。')
await import('./build-multi-browser.mjs')
