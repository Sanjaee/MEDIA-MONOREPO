"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { getCommentsAction } from "@/actions/comment.actions";
import { CommentItem } from "./CommentItem";
import { CommentForm } from "./CommentForm";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useEffect } from "react";

interface CommentFeedProps {
  postId: string;
  postAuthorId?: string;
  hideHeader?: boolean;
  hideForm?: boolean;
}

export function CommentFeed({ postId, postAuthorId, hideHeader = false, hideForm = false }: CommentFeedProps) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ["comments", postId],
    queryFn: async ({ pageParam }) => {
      return await getCommentsAction(postId, pageParam as Date | null);
    },
    initialPageParam: null as Date | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
  });

  const comments = data?.pages.flatMap(page => page.comments) || [];
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: hasNextPage ? comments.length + 1 : comments.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // Estimate for comment height
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) return;

    if (
      lastItem.index >= comments.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [virtualItems, comments.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="w-full flex flex-col h-full relative">
      {!hideHeader && (
        <>
          <div className="border-b-1 border-muted"></div>
          <div className="py-2 px-4 font-bold text-xl border-b">
            Comments
          </div>
        </>
      )}



      {status === "pending" ? (
        <div className="p-4 text-center text-muted-foreground">Loading comments...</div>
      ) : status === "error" ? (
        <div className="p-4 text-center text-red-500">Error loading comments.</div>
      ) : comments.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          No comments yet. Be the first to reply!
        </div>
      ) : (
        <div 
          ref={parentRef} 
          className="flex-1 overflow-y-auto w-full relative max-h-[600px]"
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualItems.map((virtualItem) => {
              const isLoaderRow = virtualItem.index > comments.length - 1;
              const comment = comments[virtualItem.index];

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
                    <div className="p-4 text-center text-muted-foreground">Loading more...</div>
                  ) : (
                    <CommentItem 
                      key={comment.id} 
                      comment={comment} 
                      postId={postId} 
                      postAuthorId={postAuthorId} 
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!hideForm && <div className="shrink-0 border-t sticky bottom-0 bg-background z-10"><CommentForm postId={postId} /></div>}
    </div>
  );
}
