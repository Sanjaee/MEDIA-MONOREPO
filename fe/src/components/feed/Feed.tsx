"use client";

import { useEffect, useRef } from "react";
import { PostWithRelations } from "@/store/usePostStore";
import { PostCard } from "./PostCard";
import { PostSkeleton } from "./PostSkeleton";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getInfiniteFeedPostsAction } from "@/actions/post.actions";
import { useWindowVirtualizer } from "@tanstack/react-virtual";

export function Feed({ initialData }: { initialData: { posts: PostWithRelations[], nextCursor: number | null } }) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: async ({ pageParam }) => {
      return getInfiniteFeedPostsAction({ page: pageParam as number, limit: 10 });
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialData: {
      pages: [initialData],
      pageParams: [1],
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
                <PostCard post={post} priority={virtualItem.index < 4} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
