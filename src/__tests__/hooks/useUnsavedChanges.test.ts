/**
 * Tests for useUnsavedChanges hook
 *
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

describe('useUnsavedChanges', () => {
  let originalConfirm: typeof window.confirm;
  let originalAddEventListener: typeof window.addEventListener;
  let originalRemoveEventListener: typeof window.removeEventListener;

  beforeEach(() => {
    originalConfirm = window.confirm;
    originalAddEventListener = window.addEventListener;
    originalRemoveEventListener = window.removeEventListener;
  });

  afterEach(() => {
    window.confirm = originalConfirm;
    window.addEventListener = originalAddEventListener;
    window.removeEventListener = originalRemoveEventListener;
  });

  describe('isDirty', () => {
    it('should start as not dirty', () => {
      const { result } = renderHook(() => useUnsavedChanges());
      expect(result.current.isDirty).toBe(false);
    });

    it('should become dirty when markDirty is called', () => {
      const { result } = renderHook(() => useUnsavedChanges());

      act(() => {
        result.current.markDirty();
      });

      expect(result.current.isDirty).toBe(true);
    });

    it('should become clean when markClean is called', () => {
      const { result } = renderHook(() => useUnsavedChanges());

      act(() => {
        result.current.markDirty();
      });

      expect(result.current.isDirty).toBe(true);

      act(() => {
        result.current.markClean();
      });

      expect(result.current.isDirty).toBe(false);
    });
  });

  describe('enabled option', () => {
    it('should not mark dirty when disabled', () => {
      const { result } = renderHook(() => useUnsavedChanges({ enabled: false }));

      act(() => {
        result.current.markDirty();
      });

      expect(result.current.isDirty).toBe(false);
    });
  });

  describe('checkDirty', () => {
    it('should return true when value differs from initial', () => {
      const { result } = renderHook(() =>
        useUnsavedChanges({ initialValue: { name: 'original' } })
      );

      expect(result.current.checkDirty({ name: 'changed' })).toBe(true);
    });

    it('should return false when value matches initial', () => {
      const { result } = renderHook(() =>
        useUnsavedChanges({ initialValue: { name: 'original' } })
      );

      expect(result.current.checkDirty({ name: 'original' })).toBe(false);
    });
  });

  describe('updateInitialValue', () => {
    it('should update the initial value and mark clean', () => {
      const { result } = renderHook(() =>
        useUnsavedChanges({ initialValue: 'old' })
      );

      act(() => {
        result.current.markDirty();
      });

      expect(result.current.isDirty).toBe(true);

      act(() => {
        result.current.updateInitialValue('new');
      });

      expect(result.current.isDirty).toBe(false);
      expect(result.current.checkDirty('new')).toBe(false);
      expect(result.current.checkDirty('old')).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      const { result } = renderHook(() =>
        useUnsavedChanges({ initialValue: 'initial' })
      );

      act(() => {
        result.current.markDirty();
        result.current.updateInitialValue('new');
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.isDirty).toBe(false);
    });
  });

  describe('confirmIfDirty', () => {
    it('should call callback immediately if not dirty', () => {
      const { result } = renderHook(() => useUnsavedChanges());
      const callback = jest.fn();

      act(() => {
        result.current.confirmIfDirty(callback);
      });

      expect(callback).toHaveBeenCalled();
    });

    it('should show confirm dialog if dirty', () => {
      window.confirm = jest.fn().mockReturnValue(true);
      const { result } = renderHook(() => useUnsavedChanges());
      const callback = jest.fn();

      act(() => {
        result.current.markDirty();
      });

      act(() => {
        result.current.confirmIfDirty(callback);
      });

      expect(window.confirm).toHaveBeenCalled();
      expect(callback).toHaveBeenCalled();
    });

    it('should not call callback if user cancels', () => {
      window.confirm = jest.fn().mockReturnValue(false);
      const { result } = renderHook(() => useUnsavedChanges());
      const callback = jest.fn();

      act(() => {
        result.current.markDirty();
      });

      act(() => {
        result.current.confirmIfDirty(callback);
      });

      expect(window.confirm).toHaveBeenCalled();
      expect(callback).not.toHaveBeenCalled();
    });

    it('should call onConfirmLeave when user confirms', () => {
      window.confirm = jest.fn().mockReturnValue(true);
      const onConfirmLeave = jest.fn();
      const { result } = renderHook(() =>
        useUnsavedChanges({ onConfirmLeave })
      );
      const callback = jest.fn();

      act(() => {
        result.current.markDirty();
      });

      act(() => {
        result.current.confirmIfDirty(callback);
      });

      expect(onConfirmLeave).toHaveBeenCalled();
    });
  });

  describe('beforeunload event', () => {
    it('should add beforeunload listener', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      renderHook(() => useUnsavedChanges());

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function)
      );
    });

    it('should remove beforeunload listener on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
      const { unmount } = renderHook(() => useUnsavedChanges());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function)
      );
    });
  });
});
