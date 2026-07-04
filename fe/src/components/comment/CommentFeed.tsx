"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { getCommentsAction } from "@/actions/comment.actions";
import { CommentItem } from "./CommentItem";
import { CommentForm } from "./CommentForm";

interface CommentFeedProps {
  postId: string;
  hideHeader?: boolean;
  hideForm?: boolean;
}

export function CommentFeed({ postId, hideHeader = false, hideForm = false }: CommentFeedProps) {
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

  return (
    <div className="w-full pb-20">
      {!hideHeader && (
        <>
          <div className="border-b-1 border-muted"></div>
          <div className="py-2 px-4 font-bold text-xl border-b">
            Comments
          </div>
        </>
      )}

      {!hideForm && <CommentForm postId={postId} />}

      {status === "pending" ? (
        <div className="p-4 text-center text-muted-foreground">Loading comments...</div>
      ) : status === "error" ? (
        <div className="p-4 text-center text-red-500">Error loading comments.</div>
      ) : comments.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          No comments yet. Be the first to reply!
        </div>
      ) : (
        <div className="flex flex-col">
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} postId={postId} />
          ))}
        </div>
      )}

      {hasNextPage && (
        <div className="p-4 text-center">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="text-blue-500 hover:underline disabled:opacity-50"
          >
            {isFetchingNextPage ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
