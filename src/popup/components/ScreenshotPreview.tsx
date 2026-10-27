/**
 * 网站截图预览：在弹窗内生成帖子图文卡片，可复制或下载
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Message } from '@/types';
import type { ScreenshotRenderResult } from '@/types/screenshot';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { t } from '@/lib/i18n';

interface ScreenshotPreviewProps {
  theme: 'light' | 'dark';
  pageUrl: string;
  onClose: () => void;
}

type PreviewState =
  | { status: 'loading' }
  | { status: 'ready'; result: ScreenshotRenderResult }
  | { status: 'failed'; message: string };

const NO_CONTENT = 'NO_CONTENT';

function describeError(message: string) {
  return message === NO_CONTENT ? t('popup_screenshot_no_content') : t('popup_screenshot_failed', message);
}

/** 扩展页的 CSP 不允许 fetch data: 地址，直接解码 base64 */
function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  const mime = /^data:([^;,]+)/.exec(dataUrl)?.[1] || 'image/png';
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** 剪贴板只稳定支持 PNG，复制前把 WebP/JPEG 转成 PNG */
async function toPngBlob(blob: Blob): Promise<Blob> {
  if (blob.type === 'image/png') return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((png) => (png ? resolve(png) : reject(new Error('PNG encode failed'))), 'image/png');
  });
}

function fileNameFor(pageUrl: string, mime: string) {
  let host = 'page';
  try {
    host = new URL(pageUrl).hostname.replace(/^www\./, '') || host;
  } catch {
    // 使用默认名
  }
  const extension = mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : 'webp';
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
  return `markvault-${host}-${stamp}.${extension}`;
}

export function ScreenshotPreview({ theme, pageUrl, onClose }: ScreenshotPreviewProps) {
  const [state, setState] = useState<PreviewState>({ status: 'loading' });
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const requestRef = useRef(0);
  const closeRef = useRef<HTMLButtonElement>(null);

  const generate = useCallback(async () => {
    const requestId = ++requestRef.current;
    setState({ status: 'loading' });
    setCopyMessage(null);
    try {
      const response = await chrome.runtime.sendMessage<Message, { success: boolean; data?: ScreenshotRenderResult; error?: string }>({
        type: 'GENERATE_SCREENSHOT',
        payload: { theme },
      });
      if (requestId !== requestRef.current) return;
      if (!response?.success || !response.data) {
        setState({ status: 'failed', message: describeError(response?.error || 'Unknown error') });
        return;
      }
      setState({ status: 'ready', result: response.data });
    } catch (error) {
      if (requestId !== requestRef.current) return;
      setState({ status: 'failed', message: describeError(error instanceof Error ? error.message : String(error)) });
    }
  }, [theme]);

  useEffect(() => {
    void generate();
    closeRef.current?.focus();
    return () => {
      requestRef.current += 1;
    };
  }, [generate]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleCopy = async () => {
    if (state.status !== 'ready') return;
    try {
      const png = await toPngBlob(dataUrlToBlob(state.result.dataUrl));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      setCopyMessage(t('popup_screenshot_copied'));
    } catch (error) {
      setCopyMessage(t('popup_screenshot_failed', error instanceof Error ? error.message : String(error)));
    }
  };

  const handleDownload = () => {
    if (state.status !== 'ready') return;
    const url = URL.createObjectURL(dataUrlToBlob(state.result.dataUrl));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileNameFor(pageUrl, state.result.mime);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const buttonClass =
    'rounded-lg border border-[var(--tab-popup-border-strong)] bg-[var(--tab-popup-surface)] px-3 py-1.5 text-xs font-medium text-[var(--tab-popup-text)] transition-all hover:bg-[var(--tab-popup-action-neutral-bg)] disabled:cursor-not-allowed disabled:opacity-40 active:scale-95';

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-[var(--tab-popup-surface)]" role="dialog" aria-modal="true" aria-label={t('popup_screenshot_preview')}>
      <header className="flex shrink-0 items-center gap-2 border-b border-[var(--tab-popup-border)] px-3 py-2">
        <p className="text-sm font-semibold text-[var(--tab-popup-text)]">{t('popup_screenshot_preview')}</p>
        {state.status === 'ready' && (
          <span className="text-[10px] text-[var(--tab-popup-text-muted)]">
            {state.result.width}×{state.result.height} · {Math.max(1, Math.round(state.result.bytes / 1024))} KB
          </span>
        )}
        <button ref={closeRef} type="button" onClick={onClose} className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-[var(--tab-popup-text-muted)] transition-all hover:bg-[var(--tab-popup-action-neutral-bg)] active:scale-95" title={t('popup_screenshot_close')} aria-label={t('popup_screenshot_close')}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--tab-popup-bg)] p-3">
        {state.status === 'loading' && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-[var(--tab-popup-text-muted)]">
            <LoadingSpinner />
            <p>{t('popup_screenshot_generating')}</p>
          </div>
        )}
        {state.status === 'failed' && (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm text-[var(--tab-popup-text)]">{state.message}</p>
            <button type="button" onClick={() => void generate()} className={buttonClass}>{t('btn_retry')}</button>
          </div>
        )}
        {state.status === 'ready' && (
          <img src={state.result.dataUrl} alt={t('popup_screenshot')} className="w-full rounded-xl border border-[var(--tab-popup-border)] shadow-sm" />
        )}
      </div>

      <footer className="flex shrink-0 items-center gap-2 border-t border-[var(--tab-popup-border)] px-3 py-2">
        <p className="min-w-0 flex-1 truncate text-[11px] text-[var(--tab-popup-text-muted)]" role="status">
          {copyMessage ?? (state.status === 'ready' && state.result.truncated ? t('popup_screenshot_truncated') : '')}
        </p>
        <button type="button" onClick={() => void handleCopy()} disabled={state.status !== 'ready'} className={buttonClass}>{t('popup_screenshot_copy')}</button>
        <button type="button" onClick={handleDownload} disabled={state.status !== 'ready'} className="rounded-lg bg-gradient-to-r from-[var(--tab-popup-primary-from)] to-[var(--tab-popup-primary-via)] px-3 py-1.5 text-xs font-semibold text-[var(--tab-popup-primary-text)] shadow-sm transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40 active:scale-95">{t('popup_screenshot_download')}</button>
      </footer>
    </div>
  );
}
