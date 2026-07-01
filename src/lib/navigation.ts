import { useRouter } from 'expo-router';
import { useCallback } from 'react';

/** Navigate back, or to overview when there is no history (e.g. direct URL / refresh on web). */
export function useSafeBack(fallbackPath: '/' | string = '/') {
  const router = useRouter();

  return useCallback(() => {
    if (typeof router.canGoBack === 'function' && router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(fallbackPath as '/');
  }, [router, fallbackPath]);
}
