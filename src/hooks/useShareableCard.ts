'use client';

/**
 * useShareableCard - Learner-First Sharing Hook
 *
 * Abstracts the complexity of html-to-image and the Web Share API
 * to enable mobile-first sharing (Instagram Stories, TikTok, Messages)
 * with desktop fallback (download).
 */

import { useState, useCallback } from 'react';
import { toPng, toBlob } from 'html-to-image';
import { useToast } from '@/components/social/toast-provider';

interface UseShareableCardOptions {
  /** Reference to the element to capture */
  ref: React.RefObject<HTMLElement | null>;
  /** Filename without extension */
  fileName: string;
  /** Title for Web Share API */
  title?: string;
  /** Share text/caption */
  text?: string;
  /** Background color for the image (default: #0a0a0a) */
  backgroundColor?: string;
  /** Pixel ratio for high-res export (default: 2 for Retina) */
  pixelRatio?: number;
}

interface UseShareableCardReturn {
  /** Native mobile share (falls back to download on desktop) */
  shareNative: () => Promise<void>;
  /** Direct download as PNG */
  downloadImage: () => Promise<void>;
  /** Copy image to clipboard */
  copyToClipboard: () => Promise<void>;
  /** Share text to Twitter/X */
  shareToTwitter: (customText?: string) => void;
  /** Whether any sharing operation is in progress */
  isSharing: boolean;
  /** Whether Web Share API with file support is available */
  canShareFiles: boolean;
}

export function useShareableCard({
  ref,
  fileName,
  title = 'My Trading Win',
  text = 'Check out my progress on KCU!',
  backgroundColor = '#0a0a0a',
  pixelRatio = 2,
}: UseShareableCardOptions): UseShareableCardReturn {
  const [isSharing, setIsSharing] = useState(false);
  const { showToast } = useToast();

  // Check if Web Share API supports file sharing
  const canShareFiles = typeof navigator !== 'undefined' &&
    !!navigator.share &&
    !!navigator.canShare;

  // Generate PNG blob from the element
  const generateBlob = useCallback(async (): Promise<Blob | null> => {
    if (!ref.current) return null;

    try {
      const blob = await toBlob(ref.current, {
        cacheBust: true,
        pixelRatio,
        backgroundColor,
        // Filter out elements marked for exclusion
        filter: (node: HTMLElement) => {
          return !node.dataset?.html2canvasIgnore;
        },
      });
      return blob;
    } catch (err) {
      console.error('Image generation failed:', err);
      return null;
    }
  }, [ref, pixelRatio, backgroundColor]);

  // Generate PNG data URL from the element
  const generateDataUrl = useCallback(async (): Promise<string | null> => {
    if (!ref.current) return null;

    try {
      const dataUrl = await toPng(ref.current, {
        cacheBust: true,
        pixelRatio,
        backgroundColor,
        filter: (node: HTMLElement) => {
          return !node.dataset?.html2canvasIgnore;
        },
      });
      return dataUrl;
    } catch (err) {
      console.error('Image generation failed:', err);
      return null;
    }
  }, [ref, pixelRatio, backgroundColor]);

  // Native mobile share (Instagram/TikTok/Messages)
  const shareNative = useCallback(async () => {
    if (!ref.current) {
      showToast({
        type: 'error',
        title: 'Share Failed',
        message: 'Nothing to share',
      });
      return;
    }

    setIsSharing(true);

    try {
      const blob = await generateBlob();
      if (!blob) {
        throw new Error('Failed to generate image');
      }

      const file = new File([blob], `${fileName}.png`, { type: 'image/png' });

      // Check if Web Share API supports sharing files
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title,
          text,
          files: [file],
        });
        showToast({
          type: 'success',
          title: 'Shared!',
          message: 'Your card was shared successfully',
        });
      } else {
        // Fallback for Desktop or unsupported browsers
        await downloadImageInternal();
      }
    } catch (err) {
      console.error('Share failed:', err);
      // User cancelled the share - not an error
      if ((err as Error).name === 'AbortError') {
        return;
      }
      // Any other error - fall back to download
      showToast({
        type: 'info',
        title: 'Downloading instead',
        message: 'Web share unavailable, saving to your device',
      });
      await downloadImageInternal();
    } finally {
      setIsSharing(false);
    }
  }, [ref, fileName, title, text, generateBlob, showToast]);

  // Internal download function
  const downloadImageInternal = useCallback(async () => {
    const dataUrl = await generateDataUrl();
    if (!dataUrl) {
      showToast({
        type: 'error',
        title: 'Download Failed',
        message: 'Could not generate image',
      });
      return;
    }

    const link = document.createElement('a');
    link.download = `${fileName}.png`;
    link.href = dataUrl;
    link.click();

    showToast({
      type: 'success',
      title: 'Downloaded!',
      message: 'Image saved to your device',
    });
  }, [fileName, generateDataUrl, showToast]);

  // Public download function with loading state
  const downloadImage = useCallback(async () => {
    if (!ref.current) {
      showToast({
        type: 'error',
        title: 'Download Failed',
        message: 'Nothing to download',
      });
      return;
    }

    setIsSharing(true);
    try {
      await downloadImageInternal();
    } finally {
      setIsSharing(false);
    }
  }, [ref, downloadImageInternal, showToast]);

  // Copy image to clipboard
  const copyToClipboard = useCallback(async () => {
    if (!ref.current) {
      showToast({
        type: 'error',
        title: 'Copy Failed',
        message: 'Nothing to copy',
      });
      return;
    }

    setIsSharing(true);

    try {
      const dataUrl = await generateDataUrl();
      if (!dataUrl) {
        throw new Error('Failed to generate image');
      }

      // Convert data URL to blob for clipboard
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);

      showToast({
        type: 'success',
        title: 'Copied!',
        message: 'Image copied to clipboard',
      });
    } catch (err) {
      console.error('Copy to clipboard failed:', err);
      showToast({
        type: 'error',
        title: 'Copy Failed',
        message: 'Could not copy to clipboard',
      });
    } finally {
      setIsSharing(false);
    }
  }, [ref, generateDataUrl, showToast]);

  // Share to Twitter/X with text
  const shareToTwitter = useCallback((customText?: string) => {
    const shareText = customText || text;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [text]);

  return {
    shareNative,
    downloadImage,
    copyToClipboard,
    shareToTwitter,
    isSharing,
    canShareFiles,
  };
}

export default useShareableCard;
