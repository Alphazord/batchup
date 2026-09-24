"use client";

import { useRef, useCallback, useState } from "react";

interface GestureCallbacks {
  onSwipeRight?: () => void;
  onLongPress?: () => void;
}

interface GestureState {
  isSwiping: boolean;
  swipeOffset: number;
  isLongPressing: boolean;
}

export function useGesture(callbacks: GestureCallbacks) {
  const [state, setState] = useState<GestureState>({
    isSwiping: false,
    swipeOffset: 0,
    isLongPressing: false,
  });

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSwipingRef = useRef(false);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
      isSwipingRef.current = false;

      // Start long press timer
      clearLongPress();
      longPressTimerRef.current = setTimeout(() => {
        if (!isSwipingRef.current) {
          setState((prev) => ({ ...prev, isLongPressing: true }));
          callbacks.onLongPress?.();
          // Haptic feedback if available
          if (navigator.vibrate) {
            navigator.vibrate(50);
          }
        }
      }, 500);
    },
    [callbacks, clearLongPress],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;

      // If vertical scroll is dominant, cancel swipe
      if (Math.abs(deltaY) > Math.abs(deltaX) && !isSwipingRef.current) {
        clearLongPress();
        return;
      }

      // If horizontal swipe is significant, start swipe mode
      if (Math.abs(deltaX) > 10) {
        isSwipingRef.current = true;
        clearLongPress();

        // Only allow right swipe (for reply)
        const offset = Math.max(0, Math.min(deltaX, 100));
        setState((prev) => ({ ...prev, isSwiping: true, swipeOffset: offset }));
      }
    },
    [clearLongPress],
  );

  const onTouchEnd = useCallback(() => {
    clearLongPress();

    if (isSwipingRef.current && state.swipeOffset > 50) {
      // Trigger reply
      callbacks.onSwipeRight?.();
    }

    // Reset state
    touchStartRef.current = null;
    isSwipingRef.current = false;
    setState({ isSwiping: false, swipeOffset: 0, isLongPressing: false });
  }, [callbacks, clearLongPress, state.swipeOffset]);

  return {
    state,
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
  };
}
