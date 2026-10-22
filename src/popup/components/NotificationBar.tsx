/**
 * Popup 通知栏（错误、成功、加载消息）
 */

import { ErrorMessage } from '@/components/ErrorMessage';
import { SuccessMessage } from '@/components/SuccessMessage';
import { LoadingMessage } from '@/components/LoadingMessage';

interface NotificationBarProps {
  error: string | null;
  successMessage: string | null;
  loadingMessage: string | null;
  lastRecommendationSource?: string;
  onDismissError: () => void;
  onDismissSuccess: () => void;
  onRetry?: () => void;
}

export function NotificationBar({
  error,
  successMessage,
  loadingMessage,
  lastRecommendationSource,
  onDismissError,
  onDismissSuccess,
  onRetry,
}: NotificationBarProps) {
  if (!error && !loadingMessage && !successMessage) return null;

  return (
    <div className="max-h-[30%] shrink-0 space-y-2 overflow-y-auto px-4 py-2" aria-live="polite" aria-relevant="additions text">
      {error && (
        <div className="pointer-events-auto">
          <ErrorMessage
            message={error}
            onDismiss={onDismissError}
            onRetry={lastRecommendationSource === 'fallback' ? onRetry : undefined}
          />
        </div>
      )}
      {loadingMessage && (
        <div className="pointer-events-auto">
          <LoadingMessage message={loadingMessage} />
        </div>
      )}
      {successMessage && (
        <div className="pointer-events-auto">
          <SuccessMessage message={successMessage} onDismiss={onDismissSuccess} />
        </div>
      )}
    </div>
  );
}
