"use client";

import { useEffect } from "react";
import { PostWithRelations } from "@/store/usePostStore";
import { PostCard } from "./PostCard";
import { PostSkeleton } from "./PostSkeleton";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getInfiniteBookmarkedPostsAction } from "@/actions/post.actions";
import { useWindowVirtualizer } from "@tanstack/react-virtual";

export function BookmarksFeed({ initialData }: { initialData: { posts: PostWithRelations[], nextCursor: { createdAt: Date, id: string } | null } }) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['bookmarks'],
    queryFn: async ({ pageParam }) => {
      return getInfiniteBookmarkedPostsAction({ cursor: pageParam as any, limit: 10 });
    },
    initialPageParam: null as { createdAt: Date, id: string } | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialData: {
      pages: [initialData],
      pageParams: [null],
    },
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
  }, [
    hasNextPage,
    fetchNextPage,
    allPosts.length,
    isFetchingNextPage,
    virtualItems,
  ]);

  if (allPosts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p>No bookmarks yet.</p>
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
                <PostCard post={post} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
