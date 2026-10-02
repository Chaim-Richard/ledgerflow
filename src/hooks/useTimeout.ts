import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook providing safe setTimeout with automatic cleanup on unmount.
 * 
 * Can be used:
 * 1. Declaratively:
 *    useTimeout(callback, delayMs);
 * 
 * 2. Imperatively:
 *    const { setSafeTimeout, clearSafeTimeout } = useTimeout();
 *    setSafeTimeout(() => setSuccess(null), 4000);
 */
export function useTimeout(callback?: () => void, delay?: number | null) {
  const savedCallback = useRef(callback);
  const activeTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Declarative execution
  useEffect(() => {
    if (typeof delay !== 'number' || !savedCallback.current) {
      return;
    }
    const id = setTimeout(() => {
      savedCallback.current?.();
    }, delay);
    return () => clearTimeout(id);
  }, [delay]);

  // Imperative scheduler with tracked cleanup
  const setSafeTimeout = useCallback((fn: () => void, ms: number = 0) => {
    const timerId = setTimeout(() => {
      activeTimersRef.current.delete(timerId);
      fn();
    }, ms);
    activeTimersRef.current.add(timerId);
    return timerId;
  }, []);

  const clearSafeTimeout = useCallback((timerId: ReturnType<typeof setTimeout>) => {
    clearTimeout(timerId);
    activeTimersRef.current.delete(timerId);
  }, []);

  // Cleanup all imperative timers on unmount
  useEffect(() => {
    const timers = activeTimersRef.current;
    return () => {
      timers.forEach((timerId) => clearTimeout(timerId));
      timers.clear();
    };
  }, []);

  return {
    setSafeTimeout,
    clearSafeTimeout,
    setTimeout: setSafeTimeout,
    clearTimeout: clearSafeTimeout
  };
}

export default useTimeout;
