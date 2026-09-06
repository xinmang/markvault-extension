/**
 * MarkVault API 基础客户端
 * 负责 HTTP 请求、认证、错误处理和请求生命周期管理。
 */

import type { TMarksError, RateLimitInfo } from './types';
import { normalizeApiUrl } from '@/lib/constants/urls';
import { TIMEOUTS } from '@/lib/constants/timeouts';
import { logger } from '@/lib/utils/logger';

export interface TMarksClientConfig {
  apiKey: string;
  baseUrl?: string;
  /** 请求超时时间，默认 10 秒。 */
  requestTimeoutMs?: number;
}

export class TMarksAPIError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: Record<string, unknown>,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'TMarksAPIError';
    Object.setPrototypeOf(this, new.target.prototype);
  }

  isAuthError(): boolean {
    return [
      'MISSING_API_KEY',
      'INVALID_API_KEY',
      'INSUFFICIENT_PERMISSIONS',
    ].includes(this.code);
  }

  isRateLimitError(): boolean {
    return this.code === 'RATE_LIMIT_EXCEEDED';
  }

  isNotFoundError(): boolean {
    return this.code === 'NOT_FOUND';
  }

  isDuplicateError(): boolean {
    return ['DUPLICATE_URL', 'DUPLICATE_TAG'].includes(this.code);
  }

  isServerError(): boolean {
    return this.status >= 500;
  }
}

export class TMarksClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly requestTimeoutMs: number;
  private rateLimitInfo: RateLimitInfo | null = null;

  constructor(config: TMarksClientConfig) {
    this.apiKey = config.apiKey.trim();
    this.baseUrl = normalizeApiUrl(config.baseUrl || '');
    this.requestTimeoutMs = Number.isFinite(config.requestTimeoutMs) && (config.requestTimeoutMs ?? 0) > 0
      ? Math.floor(config.requestTimeoutMs as number)
      : TIMEOUTS.API_REQUEST;
  }

  /** 获取最近一次响应中的速率限制信息。 */
  getRateLimitInfo(): RateLimitInfo | null {
    return this.rateLimitInfo;
  }

  /** 检查是否接近速率限制。 */
  isNearRateLimit(threshold = 0.2): boolean {
    if (!this.rateLimitInfo || this.rateLimitInfo.limit <= 0) return false;
    return this.rateLimitInfo.remaining / this.rateLimitInfo.limit < threshold;
  }

  /** 获取速率限制重置时间。 */
  getRateLimitResetTime(): Date | null {
    if (!this.rateLimitInfo) return null;
    return new Date(this.rateLimitInfo.reset * 1000);
  }

  /**
   * 发起 HTTP 请求。
   * 使用 AbortController 统一处理超时，并保留调用方传入的取消信号。
   */
  protected async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = this.buildUrl(endpoint);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    const externalSignal = options.signal;
    const abortFromExternalSignal = () => controller.abort();

    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener('abort', abortFromExternalSignal, { once: true });
      }
    }

    const headers = new Headers(options.headers);
    headers.set('X-API-Key', this.apiKey);
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }
    if (options.body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    logger.log('[TMarksClient] 发起请求:', {
      endpoint,
      method: options.method || 'GET',
    });

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      this.extractRateLimitInfo(response);
      const data = await this.parseResponse(response);

      if (!response.ok) {
        this.handleErrorResponse(
          response.status,
          data,
          this.parseRetryAfter(response.headers.get('Retry-After'))
        );
      }

      return data as T;
    } catch (error) {
      if (error instanceof TMarksAPIError) {
        throw error;
      }

      if (
        (error instanceof DOMException || error instanceof Error) &&
        error.name === 'AbortError'
      ) {
        throw new TMarksAPIError(
          'REQUEST_TIMEOUT',
          '请求超时，请检查网络连接后重试',
          0
        );
      }

      if (error instanceof TypeError) {
        logger.error('[TMarksClient] 网络错误:', error);
        throw new TMarksAPIError(
          'NETWORK_ERROR',
          '网络连接失败，无法访问 MarkVault 服务',
          0,
          { originalError: error.message }
        );
      }

      logger.error('[TMarksClient] 未知错误:', error);
      throw new TMarksAPIError(
        'UNKNOWN_ERROR',
        error instanceof Error ? error.message : '请求失败',
        0,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    } finally {
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener('abort', abortFromExternalSignal);
    }
  }

  /** GET 请求。 */
  protected async get<T>(endpoint: string, params?: object): Promise<T> {
    const queryString = params ? this.buildQueryString(params) : '';
    return this.request<T>(`${endpoint}${queryString}`, { method: 'GET' });
  }

  /** POST 请求。 */
  protected async post<T>(endpoint: string, body?: object): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  /** PATCH 请求。 */
  protected async patch<T>(endpoint: string, body: object): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  /** DELETE 请求。 */
  protected async delete<T>(endpoint: string, body?: object): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  private buildUrl(endpoint: string): string {
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${this.baseUrl}${normalizedEndpoint}`;
  }

  private buildQueryString(params: object): string {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
      if (value === undefined || value === null || value === '') continue;
      query.set(key, String(value));
    }
    const serialized = query.toString();
    return serialized ? `?${serialized}` : '';
  }

  private async parseResponse(response: Response): Promise<unknown> {
    if (response.status === 204) {
      return undefined;
    }

    const text = await response.text();
    if (!text.trim()) {
      return undefined;
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('json') || /^[\[{]/.test(text.trim())) {
      try {
        return JSON.parse(text) as unknown;
      } catch {
        if (!response.ok) {
          return text;
        }
      }
    }

    return response.ok ? { message: text } : text;
  }

  private extractRateLimitInfo(response: Response): void {
    const limit = this.parseHeaderNumber(response.headers.get('X-RateLimit-Limit'));
    const remaining = this.parseHeaderNumber(response.headers.get('X-RateLimit-Remaining'));
    const reset = this.parseHeaderNumber(response.headers.get('X-RateLimit-Reset'));

    if (limit !== null && remaining !== null && reset !== null && limit >= 0 && remaining >= 0 && reset >= 0) {
      this.rateLimitInfo = { limit, remaining, reset };
    }
  }

  private parseRetryAfter(value: string | null): number | undefined {
    if (!value) return undefined;
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return Math.max(0, seconds);

    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) return undefined;
    return Math.max(0, Math.ceil((timestamp - Date.now()) / 1000));
  }

  private parseHeaderNumber(value: string | null): number | null {
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private handleErrorResponse(
    status: number,
    errorData: unknown,
    retryAfterHeader?: number
  ): never {
    let code = 'UNKNOWN_ERROR';
    let message = `请求失败（HTTP ${status}）`;
    let details: Record<string, unknown> | undefined;
    let retryAfter = retryAfterHeader;

    if (errorData && typeof errorData === 'object' && 'error' in errorData) {
      const errorPayload = (errorData as TMarksError).error;
      if (errorPayload && typeof errorPayload === 'object') {
        code = errorPayload.code || code;
        message = errorPayload.message || message;
        details = errorPayload.details;
        retryAfter = errorPayload.retry_after ?? retryAfter;
      }
    } else if (typeof errorData === 'string' && errorData.trim()) {
      message = errorData;
    } else if (errorData && typeof errorData === 'object') {
      const payload = errorData as Record<string, unknown>;
      if (typeof payload.message === 'string' && payload.message.trim()) {
        message = payload.message;
      }
      if (typeof payload.code === 'string' && payload.code.trim()) {
        code = payload.code;
      }
    }

    const inferredCodeByStatus: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'INVALID_API_KEY',
      403: 'INSUFFICIENT_PERMISSIONS',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      429: 'RATE_LIMIT_EXCEEDED',
    };
    if (code === 'UNKNOWN_ERROR' && inferredCodeByStatus[status]) {
      code = inferredCodeByStatus[status];
    }
    if (code === 'UNKNOWN_ERROR' && status >= 500) {
      code = 'INTERNAL_ERROR';
    }

    logger.error('[TMarksClient] API 错误:', { status, code, message });
    throw new TMarksAPIError(code, message, status, details, retryAfter);
  }
}
