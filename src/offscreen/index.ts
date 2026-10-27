/**
 * 离屏文档消息入口：只处理 target === 'offscreen' 的 RENDER_SCREENSHOT。
 */

import type {
  ScreenshotContent,
  ScreenshotRenderOptions,
  ScreenshotRenderResult,
} from '@/types/screenshot';
import { DEFAULT_SCREENSHOT_RENDER_OPTIONS } from '@/types/screenshot';
import { renderScreenshotCard } from './render-card';

interface OffscreenMessage {
  target?: string;
  type?: string;
  payload?: {
    content?: ScreenshotContent;
    options?: Partial<ScreenshotRenderOptions>;
  };
}

type SendResponse = (response: {
  success: boolean;
  data?: ScreenshotRenderResult;
  error?: string;
}) => void;

export function isRenderScreenshotMessage(
  message: unknown
): message is {
  target: 'offscreen';
  type: 'RENDER_SCREENSHOT';
  payload: { content: ScreenshotContent; options?: Partial<ScreenshotRenderOptions> };
} {
  if (!message || typeof message !== 'object') return false;
  const candidate = message as OffscreenMessage;
  return (
    candidate.target === 'offscreen' &&
    candidate.type === 'RENDER_SCREENSHOT' &&
    Boolean(candidate.payload && candidate.payload.content)
  );
}

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse: SendResponse) => {
    // 其他消息一律不响应，避免干扰正常消息通道
    if (!isRenderScreenshotMessage(message)) return false;

    const content = message.payload.content;
    const options: ScreenshotRenderOptions = {
      ...DEFAULT_SCREENSHOT_RENDER_OPTIONS,
      ...(message.payload.options ?? {}),
    };

    renderScreenshotCard(content, options)
      .then((data) => {
        sendResponse({ success: true, data });
      })
      .catch((error: unknown) => {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return true;
  }
);
