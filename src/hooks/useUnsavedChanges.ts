/**
 * useUnsavedChanges Hook
 *
 * Tracks unsaved changes and warns users before leaving the page.
 * Provides dirty state tracking and confirmation dialogs.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseUnsavedChangesOptions {
  /** Initial value to compare against */
  initialValue?: unknown;
  /** Custom message for the confirmation dialog */
  message?: string;
  /** Callback when user confirms leaving with unsaved changes */
  onConfirmLeave?: () => void;
  /** Whether to enable the warning (useful for conditional usage) */
  enabled?: boolean;
}

interface UseUnsavedChangesReturn {
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Mark the current state as clean (after save) */
  markClean: () => void;
  /** Mark the current state as dirty */
  markDirty: () => void;
  /** Update the comparison value (after save) */
  updateInitialValue: (value: unknown) => void;
  /** Check if a value differs from the initial value */
  checkDirty: (currentValue: unknown) => boolean;
  /** Reset to initial state */
  reset: () => void;
  /** Show a confirmation dialog if dirty */
  confirmIfDirty: (callback: () => void) => void;
}

export function useUnsavedChanges(options: UseUnsavedChangesOptions = {}): UseUnsavedChangesReturn {
  const {
    initialValue,
    message = 'You have unsaved changes. Are you sure you want to leave?',
    onConfirmLeave,
    enabled = true,
  } = options;

  const [isDirty, setIsDirty] = useState(false);
  const initialValueRef = useRef<unknown>(initialValue);
  const enabledRef = useRef(enabled);

  // Update enabled ref
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // Warn before unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && enabledRef.current) {
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, message]);

  const markClean = useCallback(() => {
    setIsDirty(false);
  }, []);

  const markDirty = useCallback(() => {
    if (enabledRef.current) {
      setIsDirty(true);
    }
  }, []);

  const updateInitialValue = useCallback((value: unknown) => {
    initialValueRef.current = value;
    setIsDirty(false);
  }, []);

  const checkDirty = useCallback((currentValue: unknown): boolean => {
    // Deep comparison for objects
    const initial = initialValueRef.current;
    if (typeof initial === 'object' && typeof currentValue === 'object') {
      return JSON.stringify(initial) !== JSON.stringify(currentValue);
    }
    return initial !== currentValue;
  }, []);

  const reset = useCallback(() => {
    setIsDirty(false);
    initialValueRef.current = initialValue;
  }, [initialValue]);

  const confirmIfDirty = useCallback((callback: () => void) => {
    if (isDirty && enabledRef.current) {
      const confirmed = window.confirm(message);
      if (confirmed) {
        onConfirmLeave?.();
        setIsDirty(false);
        callback();
      }
    } else {
      callback();
    }
  }, [isDirty, message, onConfirmLeave]);

  return {
    isDirty,
    markClean,
    markDirty,
    updateInitialValue,
    checkDirty,
    reset,
    confirmIfDirty,
  };
}

/**
 * useAutoSave Hook
 *
 * Automatically saves content after a debounce period.
 */

interface UseAutoSaveOptions<T> {
  /** The data to save */
  data: T;
  /** Save function */
  onSave: (data: T) => Promise<void>;
  /** Debounce delay in milliseconds */
  delay?: number;
  /** Whether auto-save is enabled */
  enabled?: boolean;
  /** Callback when save starts */
  onSaveStart?: () => void;
  /** Callback when save completes */
  onSaveComplete?: () => void;
  /** Callback when save fails */
  onSaveError?: (error: Error) => void;
}

interface UseAutoSaveReturn {
  /** Whether a save is in progress */
  isSaving: boolean;
  /** Last saved timestamp */
  lastSaved: Date | null;
  /** Force an immediate save */
  saveNow: () => Promise<void>;
  /** Whether there are pending changes */
  hasPendingChanges: boolean;
}

export function useAutoSave<T>(options: UseAutoSaveOptions<T>): UseAutoSaveReturn {
  const {
    data,
    onSave,
    delay = 3000,
    enabled = true,
    onSaveStart,
    onSaveComplete,
    onSaveError,
  } = options;

  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);

  const dataRef = useRef(data);
  const lastSavedDataRef = useRef<T | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update data ref
  useEffect(() => {
    dataRef.current = data;

    // Check if data changed from last saved
    if (lastSavedDataRef.current !== null) {
      const hasChanges = JSON.stringify(data) !== JSON.stringify(lastSavedDataRef.current);
      setHasPendingChanges(hasChanges);
    }
  }, [data]);

  const saveNow = useCallback(async () => {
    if (!enabled) return;

    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    try {
      setIsSaving(true);
      onSaveStart?.();
      await onSave(dataRef.current);
      lastSavedDataRef.current = dataRef.current;
      setLastSaved(new Date());
      setHasPendingChanges(false);
      onSaveComplete?.();
    } catch (error) {
      onSaveError?.(error instanceof Error ? error : new Error('Save failed'));
    } finally {
      setIsSaving(false);
    }
  }, [enabled, onSave, onSaveStart, onSaveComplete, onSaveError]);

  // Debounced auto-save
  useEffect(() => {
    if (!enabled || !hasPendingChanges) return;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      saveNow();
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, enabled, delay, hasPendingChanges, saveNow]);

  return {
    isSaving,
    lastSaved,
    saveNow,
    hasPendingChanges,
  };
}
