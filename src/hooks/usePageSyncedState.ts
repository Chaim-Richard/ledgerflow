import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

/** A page value wins when its key changes; local edits survive ordinary rerenders. */
export function usePageSyncedState<T>(
  pageKey: string,
  pageValue: T | undefined,
  initialValue: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState(() => ({
    pageKey,
    value: pageValue !== undefined
      ? pageValue
      : typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue,
  }));
  const value = state.pageKey !== pageKey && pageValue !== undefined ? pageValue : state.value;
  if (state.pageKey !== pageKey) {
    setState({ pageKey, value });
  }
  const setValue = useCallback<Dispatch<SetStateAction<T>>>(update => {
    setState(previous => ({
      pageKey,
      value: typeof update === 'function' ? (update as (value: T) => T)(previous.value) : update,
    }));
  }, [pageKey]);
  return [value, setValue];
}
