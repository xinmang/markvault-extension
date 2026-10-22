#!/usr/bin/env node

/** 构建 Chromium 扩展，并生成可上传到 GitHub Release 的 ZIP 与校验和。 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream, existsSync, readFileSync } from 'node:fs'
import { mkdir, rm, rename, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ZipArchive } from 'archiver'
import { buildConfig, getEnabledBrowsers, validateConfig } from '../build.config.mjs'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(import.meta.url)

function projectDirectory(value) {
  const absolute = resolve(projectRoot, value)
  const child = relative(projectRoot, absolute)
  if (!child || child.startsWith('..') || isAbsolute(child)) {
    throw new Error(`构建目录必须位于项目内部：${value}`)
  }
  return absolute
}

const distDirectory = projectDirectory(buildConfig.output.distDir)
const releaseDirectory = projectDirectory(buildConfig.output.publicDir)

function runNode(script, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: projectRoot,
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`构建命令失败：${script}`)
}

async function createZip(outputFile) {
  const temporary = `${outputFile}.tmp`
  try {
    await new Promise((resolveArchive, reject) => {
      const stream = createWriteStream(temporary)
      const archive = new ZipArchive({ zlib: { level: buildConfig.buildOptions.compressionLevel } })
      stream.on('close', resolveArchive)
      stream.on('error', reject)
      archive.on('error', reject)
      archive.on('warning', reject)
      archive.pipe(stream)
      archive.directory(distDirectory, false)
      archive.file(join(projectRoot, 'LICENSE'), { name: 'LICENSE' })
      archive.finalize().catch(reject)
    })
    // 完整写入后替换安装包，构建失败时保留上次成功的产物。
    await rename(temporary, outputFile)
  } finally {
    await rm(temporary, { force: true })
  }
}

async function sha256(file) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  return hash.digest('hex')
}

async function main() {
  const validation = validateConfig()
  if (!validation.valid) throw new Error(validation.errors.join('\n'))

  const packageInfo = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'))
  const manifest = JSON.parse(readFileSync(join(projectRoot, 'manifest.json'), 'utf8'))
  if (packageInfo.version !== manifest.version) {
    throw new Error('package.json 与 manifest.json 的版本必须一致')
  }
  if (process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME !== `v${packageInfo.version}`) {
    throw new Error(`发布标签必须为 v${packageInfo.version}`)
  }

  const requested = process.argv.slice(2)
  const available = getEnabledBrowsers()
  const unknown = requested.filter((id) => !available.some((browser) => browser.id === id))
  if (unknown.length) throw new Error(`未启用的浏览器：${unknown.join(', ')}`)
  const browsers = requested.length ? available.filter((browser) => requested.includes(browser.id)) : available
  if (!browsers.length) throw new Error('没有启用的浏览器构建目标')

  // 类型检查先于清理，避免类型错误导致本地安装目录被删除。
  console.log(`正在构建 MarkVault Extension ${packageInfo.version}`)
  runNode(require.resolve('typescript/bin/tsc'), ['--noEmit'])
  if (buildConfig.buildOptions.clean) {
    if (distDirectory !== resolve(projectRoot, 'dist')) throw new Error('只允许清理项目的 dist 目录')
    await rm(distDirectory, { recursive: true, force: true })
  }
  runNode(join(dirname(require.resolve('vite/package.json')), 'bin/vite.js'), ['build'])

  const builtManifestPath = join(distDirectory, 'manifest.json')
  if (!existsSync(builtManifestPath)) throw new Error('缺少构建后的 manifest.json')
  const builtManifest = JSON.parse(readFileSync(builtManifestPath, 'utf8'))
  if (builtManifest.version !== packageInfo.version) throw new Error('构建后的扩展版本不一致')

  await mkdir(releaseDirectory, { recursive: true })
  const checksums = []
  for (const browser of browsers) {
    if (browser.outputFile !== `${packageInfo.name}-${browser.id}.zip`) {
      throw new Error(`安装包文件名不符合发布约定：${browser.outputFile}`)
    }
    const outputFile = join(releaseDirectory, browser.outputFile)
    await createZip(outputFile)
    checksums.push(`${await sha256(outputFile)}  ${browser.outputFile}`)
    console.log(`已生成 ${relative(projectRoot, outputFile)}`)
  }
  await writeFile(join(releaseDirectory, 'checksums.sha256'), `${checksums.join('\n')}\n`)
  console.log('校验和已保存到 release/checksums.sha256')
  console.log('发布后下载：https://github.com/xinmang/markvault-extension/releases/latest/download/markvault-extension-chrome.zip')
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
