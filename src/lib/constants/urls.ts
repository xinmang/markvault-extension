/**
 * URL 常量配置
 * 统一管理所有硬编码的 URL
 */

// MarkVault 服务相关。默认值对应本地 MarkVault 开发服务器。
export const TMARKS_URLS = {
    DEFAULT_BASE_URL: 'http://localhost:8787',
    DEFAULT_API_BASE: 'http://localhost:8787/api',
} as const;

/**
 * 根据基础 URL 生成完整的 URL
 * @param baseUrl 基础 URL（例如：http://localhost:8787）
 */
export function getTMarksUrls(baseUrl?: string) {
    const base = baseUrl || TMARKS_URLS.DEFAULT_BASE_URL;
    // 移除末尾的斜杠
    const cleanBase = base.replace(/\/$/, '');
    
    return {
        BASE_URL: cleanBase,
        API_BASE: `${cleanBase}/api`,
        WEB_APP: `${cleanBase}/`,
        TAB_GROUPS: `${cleanBase}/tab`,
    };
}

/**
 * 标准化 API URL
 * 确保 URL 包含 /api 后缀，用户可以输入基础 URL 或完整 API URL
 * @param url 用户输入的 URL
 * @returns 标准化后的 API URL
 * 
 * @example
 * normalizeApiUrl('http://localhost:8787') // => 'http://localhost:8787/api'
 * normalizeApiUrl('http://localhost:8787/') // => 'http://localhost:8787/api'
 * normalizeApiUrl('http://localhost:8787/api') // => 'http://localhost:8787/api'
 * normalizeApiUrl('http://localhost:8787/api/') // => 'http://localhost:8787/api'
 */
export function normalizeApiUrl(url: string): string {
    if (!url) {
        return TMARKS_URLS.DEFAULT_API_BASE;
    }
    
    // 移除末尾的斜杠
    const cleanUrl = url.trim().replace(/\/+$/, '');
    
    // 如果已经包含 /api，直接返回
    if (cleanUrl.endsWith('/api')) {
        return cleanUrl;
    }
    
    // 否则添加 /api 后缀
    return `${cleanUrl}/api`;
}

// AI 服务默认 URL
export const AI_SERVICE_URLS = {
    OPENAI: 'https://api.openai.com/v1',
    CLAUDE: 'https://api.anthropic.com/v1',
    DEEPSEEK: 'https://api.deepseek.com/v1',
    ZHIPU: 'https://open.bigmodel.cn/api/paas/v4',
    MODELSCOPE: 'https://api-inference.modelscope.cn/v1',
    SILICONFLOW: 'https://api.siliconflow.cn/v1',
    IFLOW: 'https://apis.iflow.cn/v1',
    // TypeSafe System One：POST /systemone 做结构化评估，GET /models 列出可用模型
    TYPESAFE: 'https://api.typesafe.ai/v1',
} as const;

// AI 服务文档链接
export const AI_SERVICE_DOCS = {
    OPENAI: 'https://platform.openai.com/api-keys',
    CLAUDE: 'https://console.anthropic.com/',
    DEEPSEEK: 'https://platform.deepseek.com/api_keys',
    ZHIPU: 'https://open.bigmodel.cn/usercenter/apikeys',
    MODELSCOPE: 'https://www.modelscope.cn/my/myaccesstoken',
    SILICONFLOW: 'https://cloud.siliconflow.cn/account/ak',
    IFLOW: 'https://console.xfyun.cn/services/iat',
    TYPESAFE: 'https://docs.typesafe.ai/api',
} as const;

// TypeSafe 相关默认值
export const TYPESAFE_CONFIG = {
    /** 官方旗舰模型别名，始终指向最新稳定版本 */
    DEFAULT_MODEL: 'jev-latest',
    /**
     * 单次请求最多评估多少个候选（标签 / 文件夹路径）。
     *
     * 与标签库加载上限（200）对齐，保证 TypeSafe 是“从整个标签库里分拣”，
     * 而不是只看前若干个。64k 上下文足以容纳 200 个 noul 问题；
     * 官方文档也说明「增加问题几乎不改变响应时间，仅增加少量 token 成本」。
     */
    MAX_CANDIDATES: 200,
    /**
     * 丢弃阈值：noul 是“该标签适合这个页面”的概率，低于此值视为模型明确否定。
     *
     * 0.1 意味着模型有 90% 把握认为“不适合”。**不要再往上调**：
     * 用户标签库里大量是“工具”“AI”这类通用大分类，得分天然不高，
     * 阈值调高（例如 0.5）会把整个结果过滤成 0 个标签。
     */
    MIN_SCORE: 0.1,
} as const;

// 外部服务
export const EXTERNAL_SERVICES = {
    GOOGLE_FAVICON: 'https://www.google.com/s2/favicons',
} as const;

// 超时配置（毫秒）
import { DURATIONS } from '@/lib/constants/durations';

export const TIMEOUTS = {
    AI_REQUEST: 30000, // 30秒
    API_REQUEST: DURATIONS.TEN_SECONDS,
    CONTENT_SCRIPT_INJECTION: DURATIONS.FIVE_SECONDS,
} as const;

// 分页配置
export const PAGINATION = {
    DEFAULT_PAGE_SIZE: 100,
    MAX_PAGES: 100, // 安全限制
} as const;

// 缓存配置
export const CACHE = {
    DEFAULT_MAX_AGE_HOURS: 24,
    MAX_EXISTING_TAGS: 200,
    MAX_RECENT_BOOKMARKS: 20,
} as const;
