"use client";

import { useEffect } from "react";
import { NewsCard } from "./NewsCard";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getNewsFeedAction } from "@/actions/news.actions";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { Loader2 } from "lucide-react";

type NewsCursor = { createdAt: string; id: string } | null;

export function NewsFeed({ initialData }: { initialData: { posts: any[], nextCursor: NewsCursor } }) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['news-feed'],
    queryFn: async ({ pageParam }) => {
      return getNewsFeedAction({ cursor: pageParam as NewsCursor, limit: 10 });
    },
    initialPageParam: null as NewsCursor,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    initialData: {
      pages: [initialData],
      pageParams: [null as NewsCursor],
    },
    staleTime: Infinity,
  });

  const allNews = data ? data.pages.flatMap((page) => page.posts) : initialData.posts;

  const virtualizer = useWindowVirtualizer({
    count: hasNextPage ? allNews.length + 1 : allNews.length,
    estimateSize: () => 300, 
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    const [lastItem] = [...virtualItems].reverse();

    if (!lastItem) return;

    if (
      lastItem.index >= allNews.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [hasNextPage, fetchNextPage, allNews.length, isFetchingNextPage, virtualItems]);

  if (allNews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-muted-foreground text-center">
        <p className="text-lg font-medium">No news available.</p>
        <p className="text-sm mt-1">Check back later for updates!</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-20 w-full relative">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const isLoaderRow = virtualItem.index > allNews.length - 1;
          const newsItem = allNews[virtualItem.index];

          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {isLoaderRow ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <NewsCard post={newsItem} priority={virtualItem.index < 4} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
