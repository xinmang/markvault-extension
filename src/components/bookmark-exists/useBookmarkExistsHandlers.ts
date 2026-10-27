/**
 * BookmarkExistsDialog 事件处理 Hook
 */

import { t } from '@/lib/i18n';
import { TIMEOUTS } from '@/lib/constants/timeouts';
import type { BookmarkExistsAction } from './useBookmarkExistsState';

interface UseBookmarkExistsHandlersProps {
  selectedAction: BookmarkExistsAction | null;
  descriptionInput: string;
  newTags: string[];
  setIsProcessing: (processing: boolean) => void;
  setProcessingMessage: (message: string) => void;
  setIsVisible: (visible: boolean) => void;
  onUpdateTags: (tags: string[]) => Promise<void>;
  onUpdateDescription: (description: string) => Promise<void>;
  onCreateSnapshot: () => Promise<void>;
  onCreateScreenshot: () => Promise<void>;
  onCancel: () => void;
}

export function useBookmarkExistsHandlers({
  selectedAction,
  descriptionInput,
  newTags,
  setIsProcessing,
  setProcessingMessage,
  setIsVisible,
  onUpdateTags,
  onUpdateDescription,
  onCreateSnapshot,
  onCreateScreenshot,
  onCancel,
}: UseBookmarkExistsHandlersProps) {
  const handleConfirm = async () => {
    if (selectedAction === 'snapshot') {
      setIsProcessing(true);
      setProcessingMessage(t('msg_capturing'));
      
      try {
        await onCreateSnapshot();
        setProcessingMessage(t('msg_snapshot_success'));
        
        setTimeout(() => {
          setIsProcessing(false);
          onCancel();
        }, 1500);
      } catch (error) {
        setProcessingMessage(t('msg_snapshot_failed'));
        setTimeout(() => {
          setIsProcessing(false);
        }, 2000);
      }
    } else if (selectedAction === 'screenshot') {
      setIsProcessing(true);
      setProcessingMessage(t('popup_screenshot_generating'));

      try {
        await onCreateScreenshot();
        setProcessingMessage(t('msg_screenshot_uploaded'));

        setTimeout(() => {
          setIsProcessing(false);
          onCancel();
        }, 1500);
      } catch (error) {
        // 截图失败的原因（没有正文、缺少权限等）需要让用户看到，停留更久
        setProcessingMessage(error instanceof Error ? error.message : t('error_screenshot_upload', ''));
        setTimeout(() => {
          setIsProcessing(false);
        }, 3500);
      }
    } else if (selectedAction === 'update-tags') {
      setIsProcessing(true);
      setProcessingMessage(t('msg_updating_tags'));
      
      try {
        await onUpdateTags(newTags);
        setProcessingMessage(t('msg_tags_success'));
        
        setTimeout(() => {
          setIsProcessing(false);
          onCancel();
        }, 1500);
      } catch (error) {
        setProcessingMessage(t('msg_tags_failed'));
        setTimeout(() => {
          setIsProcessing(false);
        }, 2000);
      }
    } else if (selectedAction === 'update-description') {
      setIsProcessing(true);
      setProcessingMessage(t('msg_updating_desc'));
      
      try {
        await onUpdateDescription(descriptionInput.trim());
        setProcessingMessage(t('msg_desc_success'));
        
        setTimeout(() => {
          setIsProcessing(false);
          onCancel();
        }, 1500);
      } catch (error) {
        setProcessingMessage(t('msg_desc_failed'));
        setTimeout(() => {
          setIsProcessing(false);
        }, 2000);
      }
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onCancel, TIMEOUTS.ANIMATION);
  };

  return {
    handleConfirm,
    handleClose,
  };
}
