"use client";

import { useEffect } from "react";
import { PostCard } from "./PostCard";
import { PostSkeleton } from "./PostSkeleton";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getSearchFeedAction } from "@/actions/feed.actions";
import { useWindowVirtualizer } from "@tanstack/react-virtual";

type SearchCursor = { createdAt: string; id: string } | null;

export function SearchFeed({ q, initialData }: { q: string; initialData: { posts: any[], nextCursor: SearchCursor } }) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['feed', 'search', q],
    queryFn: async ({ pageParam }) => {
      return getSearchFeedAction({ q, cursor: pageParam as SearchCursor, limit: 10 });
    },
    initialPageParam: null as SearchCursor,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    initialData: {
      pages: [initialData],
      pageParams: [null as SearchCursor],
    },
    staleTime: Infinity,
  });

  const allPosts = data ? data.pages.flatMap((page) => page.posts) : initialData.posts;

  const virtualizer = useWindowVirtualizer({
    count: hasNextPage ? allPosts.length + 1 : allPosts.length,
    estimateSize: () => 300,
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    const [lastItem] = [...virtualItems].reverse();
    if (!lastItem) return;

    if (
      lastItem.index >= allPosts.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [hasNextPage, fetchNextPage, allPosts.length, isFetchingNextPage, virtualItems]);

  if (allPosts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p>No results found for "{q}"</p>
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
