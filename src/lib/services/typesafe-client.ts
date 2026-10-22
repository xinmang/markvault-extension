/**
 * TypeSafe AI (System One) HTTP 客户端
 *
 * 对接文档：https://docs.typesafe.ai/api
 *
 * 接口一览：
 * - POST {base}/systemone  评估 state 并对一组带类型的 questions 返回结构化 answers
 * - GET  {base}/models     列出当前账号可用的模型 / 别名
 *
 * 鉴权：请求头 `Authorization: Bearer <API_KEY>`
 *
 * 错误约定：401 密钥无效、422 请求体校验失败、429 限流、529 服务过载。
 * 429 / 529 按文档要求做指数退避重试，并优先遵循 `retry-after` 响应头。
 */

import { AI_SERVICE_URLS, TYPESAFE_CONFIG } from '@/lib/constants/urls';

/** instructions 支持字符串、结构化对象或数组（可把数据与问题放在同一对象里） */
export type TypeSafeInstructions = string | Record<string, unknown> | unknown[];

export interface TypeSafeNoulQuestion {
  type: 'noul';
  instructions: TypeSafeInstructions;
  criteria?: {
    true?: TypeSafeInstructions;
    false?: TypeSafeInstructions;
  };
}

export interface TypeSafeChoiceQuestion {
  type: 'choice';
  instructions: TypeSafeInstructions;
  /** 选项 → 评分说明；无需额外说明时用 null */
  criteria: Record<string, TypeSafeInstructions | null>;
}

export interface TypeSafeScoreQuestion {
  type: 'score';
  instructions: TypeSafeInstructions;
  /** 有序等级列表，2~10 项 */
  criteria: TypeSafeInstructions[];
}

export type TypeSafeQuestion =
  | TypeSafeNoulQuestion
  | TypeSafeChoiceQuestion
  | TypeSafeScoreQuestion;

export interface TypeSafeNoulAnswer {
  type: 'noul';
  /** 0（否）~ 1（是）的概率 */
  noul: number;
}

export interface TypeSafeChoiceAnswer {
  type: 'choice';
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
}

export interface TypeSafeScoreAnswer {
  type: 'score';
  score: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
  confidence: number;
}

export type TypeSafeAnswer = TypeSafeNoulAnswer | TypeSafeChoiceAnswer | TypeSafeScoreAnswer;

export interface TypeSafeResponse {
  /** 实际执行评估的版本化模型 ID（别名会解析成具体版本） */
  model: string;
  answers: Record<string, TypeSafeAnswer>;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface TypeSafeRequest {
  /** 待评估内容：纯文本，或结构化数据（对象 / 数组） */
  state: string | Record<string, unknown> | unknown[];
  /** 问题 id → 带类型的问题 */
  questions: Record<string, TypeSafeQuestion>;
}

export interface TypeSafeCallParams extends TypeSafeRequest {
  apiKey: string;
  model?: string;
  apiUrl?: string;
}

export class TypeSafeError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    /** 附加信息；限流重试时会写入建议的等待毫秒数 */
    public details?: unknown
  ) {
    super(message);
    this.name = 'TypeSafeError';
  }
}

const SYSTEMONE_ENDPOINT = '/systemone';
const MODELS_ENDPOINT = '/models';

/** 429 / 529 的最大重试次数（不含首次请求） */
const MAX_RETRIES = 3;

const resolveEndpoint = (baseUrl: string, endpoint: string): string => {
  const trimmed = (baseUrl || '').trim() || AI_SERVICE_URLS.TYPESAFE;

  // 用户可能直接粘贴了完整接口地址
  if (trimmed.includes(endpoint)) {
    return trimmed;
  }

  const normalizedBase = trimmed.replace(/\/+$/, '');
  return `${normalizedBase}${endpoint}`;
};

const buildHeaders = (apiKey: string): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  return headers;
};

const parseRetryAfter = (response: Response): number | undefined => {
  const raw = response.headers.get('retry-after');
  if (!raw) return undefined;

  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const date = Date.parse(raw);
  if (!Number.isNaN(date)) {
    return Math.max(0, date - Date.now());
  }

  return undefined;
};

const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const extractErrorText = async (response: Response): Promise<string> => {
  try {
    const text = await response.text();
    return text.trim().slice(0, 300);
  } catch {
    return response.statusText || 'Unknown error';
  }
};

/**
 * 统一把 HTTP 状态码翻译成可读错误，便于 base.ts 的 handleError 二次映射。
 */
const toTypeSafeError = async (response: Response): Promise<TypeSafeError> => {
  const errorText = await extractErrorText(response);

  switch (response.status) {
    case 401:
      return new TypeSafeError(
        `TypeSafe API Key 无效或缺失（401）。请检查 Authorization 头中的密钥。${errorText ? ` ${errorText}` : ''}`,
        401
      );
    case 422:
      return new TypeSafeError(
        `TypeSafe 请求体校验失败（422）。请检查 state / model / questions 是否合法。${errorText ? ` ${errorText}` : ''}`,
        422
      );
    case 429:
      return new TypeSafeError(`TypeSafe 触发限流（429）。${errorText}`, 429);
    case 529:
      return new TypeSafeError(`TypeSafe 服务暂时过载（529）。${errorText}`, 529);
    default:
      return new TypeSafeError(
        `TypeSafe 请求失败（${response.status}）：${errorText}`,
        response.status
      );
  }
};

const isRetryableStatus = (status: number | undefined): boolean =>
  status === 429 || status === 529;

/**
 * 调用 POST /v1/systemone
 *
 * 所有 question 针对同一份 state 并行评估，问题之间相互独立；
 * 需要依赖关系的判断应在代码中发起第二次请求。
 */
export async function callTypeSafe(params: TypeSafeCallParams): Promise<TypeSafeResponse> {
  const { apiKey, model, apiUrl, state, questions } = params;

  if (!apiKey || !apiKey.trim()) {
    throw new TypeSafeError('缺少 TypeSafe API Key', 401);
  }

  const url = resolveEndpoint(apiUrl || AI_SERVICE_URLS.TYPESAFE, SYSTEMONE_ENDPOINT);
  const headers = buildHeaders(apiKey);

  const body = {
    state,
    model: model?.trim() || TYPESAFE_CONFIG.DEFAULT_MODEL,
    questions,
  };

  let lastError: TypeSafeError | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      // 指数退避：1s / 2s / 4s；若响应带 retry-after 则优先使用
      const backoff = lastError && isRetryableStatus(lastError.status)
        ? lastError.details as number | undefined
        : undefined;
      await delay(backoff ?? Math.pow(2, attempt - 1) * 1000);
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    } catch (error) {
      // 网络层错误不重试，直接抛出交由上层处理
      throw new TypeSafeError(
        `TypeSafe 网络请求失败：${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    if (response.ok) {
      const data = (await response.json()) as TypeSafeResponse;
      if (!data || typeof data !== 'object' || !data.answers) {
        throw new TypeSafeError('TypeSafe 响应格式错误：缺少 answers 字段', response.status, data);
      }
      return data;
    }

    const retryAfterMs = parseRetryAfter(response);
    const error = await toTypeSafeError(response);
    if (retryAfterMs !== undefined) {
      error.details = retryAfterMs;
    }

    if (!isRetryableStatus(error.status) || attempt === MAX_RETRIES) {
      throw error;
    }

    lastError = error;
  }

  throw lastError || new TypeSafeError('TypeSafe 请求失败');
}

interface TypeSafeModelsResponse {
  models?: Array<{ name?: string; description?: string; release_date?: string }>;
}

/**
 * 调用 GET /v1/models
 *
 * 返回当前账号可用的模型名与别名（如 jev-latest）。
 */
export async function listTypeSafeModels(apiKey: string, apiUrl?: string): Promise<string[]> {
  if (!apiKey || !apiKey.trim()) {
    throw new TypeSafeError('缺少 TypeSafe API Key', 401);
  }

  const url = resolveEndpoint(apiUrl || AI_SERVICE_URLS.TYPESAFE, MODELS_ENDPOINT);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: buildHeaders(apiKey),
    });
  } catch (error) {
    throw new TypeSafeError(
      `TypeSafe 网络请求失败：${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  if (!response.ok) {
    throw await toTypeSafeError(response);
  }

  const data = (await response.json()) as TypeSafeModelsResponse;
  const models = Array.isArray(data?.models)
    ? data.models
        .map(item => (typeof item?.name === 'string' ? item.name.trim() : ''))
        .filter((name): name is string => name.length > 0)
    : [];

  if (models.length === 0) {
    throw new TypeSafeError('TypeSafe 未返回可用模型列表');
  }

  return models;
}

/**
 * 便捷读取 noul 答案的概率值。
 */
export const getNoulScore = (
  answers: Record<string, TypeSafeAnswer>,
  questionId: string
): number | undefined => {
  const answer = answers[questionId];
  if (!answer || answer.type !== 'noul') return undefined;
  return typeof answer.noul === 'number' ? answer.noul : undefined;
};

/**
 * 便捷读取 choice 答案的选项名。
 */
export const getChoiceAnswer = (
  answers: Record<string, TypeSafeAnswer>,
  questionId: string
): string | undefined => {
  const answer = answers[questionId];
  if (!answer || answer.type !== 'choice') return undefined;
  return typeof answer.choice === 'string' ? answer.choice : undefined;
};
