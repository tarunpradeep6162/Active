import { useSyncExternalStore } from 'react';
import { store, type UIState } from '../core/state';

export function useStore<T>(select: (s: UIState) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(store.get()));
}
