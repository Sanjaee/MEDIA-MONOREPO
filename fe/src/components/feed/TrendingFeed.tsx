"use client";

import { useEffect } from "react";
import { PostCard } from "./PostCard";
import { PostSkeleton } from "./PostSkeleton";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getTrendingFeedAction } from "@/actions/feed.actions";
import { useWindowVirtualizer } from "@tanstack/react-virtual";

type TrendingCursor = { score: number; id: string } | null;

export function TrendingFeed({ initialData }: { initialData: { posts: any[], nextCursor: TrendingCursor } }) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['feed', 'trending'],
    queryFn: async ({ pageParam }) => {
      return getTrendingFeedAction({ cursor: pageParam as TrendingCursor, limit: 10 });
    },
    initialPageParam: null as TrendingCursor,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialData: {
      pages: [initialData],
      pageParams: [null as TrendingCursor],
    },
    staleTime: Infinity, // Prevent background refetch on back navigation
  });

  const allPosts = data ? data.pages.flatMap((page) => page.posts) : initialData.posts;

  const virtualizer = useWindowVirtualizer({
    count: hasNextPage ? allPosts.length + 1 : allPosts.length,
    estimateSize: () => 300, // estimated height of a post card
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    const [lastItem] = [...virtualItems].reverse();

    if (!lastItem) {
      return;
    }

    if (
      lastItem.index >= allPosts.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [
    hasNextPage,
    fetchNextPage,
    allPosts.length,
    isFetchingNextPage,
    virtualItems,
  ]);

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
          const isLoaderRow = virtualItem.index > allPosts.length - 1;
          const post = allPosts[virtualItem.index];

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
                <PostSkeleton />
              ) : (
                <PostCard post={post as any} priority={virtualItem.index < 4} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
