/**
 * 浏览器扩展构建配置
 * 
 * 构建面向现代 Chromium 浏览器的 Manifest V3 安装包。
 */

export const buildConfig = {
  // 输出目录
  output: {
    // 构建输出目录（临时）
    distDir: 'dist',
    // 独立仓库的发布目录
    publicDir: 'release',
  },

  // 浏览器版本配置
  browsers: [
    {
      // 浏览器标识
      id: 'chrome',
      // 显示名称
      name: 'Chrome',
      // 描述
      description: '面向支持 Manifest V3 的现代 Chromium 浏览器，其他浏览器需分别验证',
      // Manifest 文件路径
      manifest: 'manifest.json',
      // 输出文件名
      outputFile: 'markvault-extension-chrome.zip',
      // 图标颜色（用于文档）
      color: 'blue',
      // 是否启用
      enabled: true,
      // 支持的浏览器列表
      supportedBrowsers: [
        'Chrome',
        'Edge',
        'Brave',
        'Opera'
      ],
      // 分类
      category: 'chromium',
    },
  ],

  // 构建选项
  buildOptions: {
    // 压缩级别 (0-9)
    compressionLevel: 9,
    // 是否显示详细日志
    verbose: true,
    // 是否在构建前清理
    clean: true,
  },

}

/**
 * 获取启用的浏览器配置
 */
export function getEnabledBrowsers() {
  return buildConfig.browsers.filter(browser => browser.enabled)
}

/**
 * 根据 ID 获取浏览器配置
 */
export function getBrowserConfig(id) {
  return buildConfig.browsers.find(browser => browser.id === id)
}

/**
 * 获取所有浏览器 ID
 */
export function getAllBrowserIds() {
  return buildConfig.browsers.map(browser => browser.id)
}

/**
 * 验证配置
 */
export function validateConfig() {
  const errors = []
  
  buildConfig.browsers.forEach(browser => {
    if (!browser.id) {
      errors.push('浏览器配置缺少 id')
    }
    if (!browser.name) {
      errors.push(`浏览器 ${browser.id} 缺少 name`)
    }
    if (!browser.manifest) {
      errors.push(`浏览器 ${browser.id} 缺少 manifest`)
    }
    if (!browser.outputFile) {
      errors.push(`浏览器 ${browser.id} 缺少 outputFile`)
    }
  })
  
  return {
    valid: errors.length === 0,
    errors
  }
}
