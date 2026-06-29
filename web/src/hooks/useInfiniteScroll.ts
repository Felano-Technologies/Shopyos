import { useEffect, useRef, useCallback } from 'react';

interface UseInfiniteScrollOptions {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  threshold?: number;
  rootMargin?: string;
}

export const useInfiniteScroll = ({
  hasMore,
  isLoading,
  onLoadMore,
  threshold = 0.1,
  rootMargin = '200px',
}: UseInfiniteScrollOptions) => {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !isLoading) {
        onLoadMore();
      }
    },
    [hasMore, isLoading, onLoadMore]
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(handleObserver, {
      threshold,
      rootMargin,
    });

    observer.observe(el);

    return () => observer.disconnect();
  }, [handleObserver, threshold, rootMargin]);

  return { sentinelRef };
};
