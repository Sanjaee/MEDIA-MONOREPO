"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, Heart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatShortTime } from "@/utils/timeUtils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSession } from "next-auth/react";
import { useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { deleteCommentAction, getRepliesAction } from "@/actions/comment.actions";
import { CommentForm } from "./CommentForm";
import { UserNameWithRole } from "@/components/ui/UserNameWithRole";

interface CommentItemProps {
  comment: any; // We'll type this properly later, or keep it generic
  postId: string;
  isReply?: boolean;
  level?: number;
  autoExpand?: boolean;
}

export function CommentItem({ comment, postId, isReply = false, level = 0, autoExpand = false }: CommentItemProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [isReplying, setIsReplying] = useState(false);
  const [showReplies, setShowReplies] = useState(autoExpand);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);

  const isOwner = session?.user?.id === comment.author.id;

  const { mutate: deleteComment, isPending: isDeleting } = useMutation({
    mutationFn: deleteCommentAction,
    onSuccess: () => {
      if (comment.parentCommentId) {
        queryClient.invalidateQueries({ queryKey: ["replies", comment.parentCommentId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["comments", postId] });
      }
    },
    onError: (e) => {
      console.error(e);
      toast.error("Failed to delete comment");
    }
  });

  const {
    data: repliesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingReplies,
  } = useInfiniteQuery({
    queryKey: ["replies", comment.id],
    queryFn: async ({ pageParam }) => {
      return await getRepliesAction(comment.id, pageParam as Date | null);
    },
    initialPageParam: null as Date | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: showReplies,
  });

  const replies = repliesData?.pages.flatMap(page => page.replies) || [];

  const avatarClass = isReply ? "w-6 h-6" : "w-10 h-10";
  const nameClass = isReply ? "text-xs" : "text-sm";
  const textClass = isReply ? "text-[13px]" : "text-[15px]";
  const timeClass = isReply ? "text-[10px]" : "text-xs";
  const iconSize = isReply ? 14 : 16;
  const paddingClass = isReply ? "py-1.5" : "px-4 py-3";

  return (
    <div className={`flex flex-col w-full relative group transition-colors ${level === 0 ? "hover:bg-muted/30" : ""}`}>
      {/* Row for avatar and content */}
      <div className={`flex gap-2 w-full ${paddingClass}`}>
        <div className="flex flex-col items-center">
          <Link href={`/${comment.author.username}`} className="shrink-0 relative z-10">
            <Avatar className={avatarClass}>
              <AvatarImage src={comment.author.image ?? ""} alt={comment.author.name ?? ""} />
              <AvatarFallback>{comment.author.name?.charAt(0)}</AvatarFallback>
            </Avatar>
          </Link>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <Link href={`/${comment.author.username}`} className="min-w-0 max-w-[150px] sm:max-w-[200px]">
                <UserNameWithRole displayName={comment.author.name || ""} role={comment.author.role} className={`mb-0 ${nameClass}`} />
              </Link>
              <span className="text-muted-foreground">·</span>
              <span className={`text-muted-foreground ${timeClass}`}>
                {comment.createdAt ? formatShortTime(comment.createdAt) : ""}
              </span>
            </div>
            <Link href={`/${comment.author.username}`} className={`text-muted-foreground truncate ${timeClass}`}>
              @{comment.author.username}
            </Link>
          </div>

          <div className={`mt-0.5 whitespace-pre-wrap break-words pr-8 ${textClass}`}>
            {level > 0 && comment.parentComment && (
              <Link href={`/${comment.parentComment.author.username}`} className="text-blue-500 hover:underline mr-1 font-medium">
                @{comment.parentComment.author.username}
              </Link>
            )}
            {comment.content}
          </div>

          <div className="flex items-center gap-6 mt-1 text-muted-foreground">
            <button
              onClick={() => setIsReplying(!isReplying)}
              className="flex items-center gap-1 text-[12px] hover:text-blue-500 transition-colors group/btn"
            >
              <div className="p-1 rounded-full group-hover/btn:bg-blue-500/10"><MessageCircle size={iconSize} /></div>
              <span>{comment.replyCount > 0 ? comment.replyCount : "Reply"}</span>
            </button>

            <button className="flex items-center gap-1.5 text-[12px] hover:text-pink-500 transition-colors group/btn">
              <div className="p-1 rounded-full group-hover/btn:bg-pink-500/10"><Heart size={iconSize} /></div>
              <span>{comment.likeCount > 0 ? comment.likeCount : ""}</span>
            </button>
          </div>

          {isReplying && (
            <div className="mt-3">
              <CommentForm
                postId={postId}
                parentCommentId={comment.id}
                onSuccess={() => {
                  setIsReplying(false);
                  setShowReplies(true);
                }}
                autoFocus
              />
            </div>
          )}

          {comment.replyCount > 0 && !showReplies && (
            <button
              onClick={() => setShowReplies(true)}
              className="mt-1 text-xs text-blue-500 hover:underline font-medium flex items-center gap-2"
            >
              View {comment.replyCount} replies
            </button>
          )}
        </div>
      </div>

      {showReplies && (
        <div className={`flex flex-col relative w-full ${level === 0 ? "pl-[52px]" : ""}`}>
          {/* Main vertical line ONLY drawn by root comment */}
          {level === 0 && (
            <div className="absolute left-[36px] top-0 bottom-2 w-px bg-border" />
          )}

          {isLoadingReplies && <div className="text-xs text-muted-foreground py-2">Loading replies...</div>}

          <div className="flex flex-col w-full">
            {replies.map((reply) => (
              <div key={reply.id} className="relative w-full">
                {/* Curved branch for each reply connecting to the main vertical line */}
                <div className="absolute left-[-16px] top-0 w-[16px] h-[18px] border-l border-b border-border rounded-bl-xl" />
                <CommentItem comment={reply} postId={postId} isReply={true} level={level + 1} autoExpand={true} />
              </div>
            ))}
          </div>

          {hasNextPage && (
            <div className={`relative mt-1 mb-2 ${level > 0 ? "ml-[32px]" : ""}`}>
              <div className={`absolute ${level > 0 ? "left-[-48px] w-[48px]" : "left-[-16px] w-[16px]"} top-[-8px] h-[18px] border-l border-b border-border rounded-bl-xl`} />
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="text-xs text-blue-500 hover:underline font-medium text-left"
              >
                {isFetchingNextPage ? "Loading..." : "View more replies"}
              </button>
            </div>
          )}

          {replies.length > 0 && level === 0 && (
            <div className="relative mt-1 mb-2">
              <div className="absolute left-[-16px] top-[-8px] w-[16px] h-[18px] border-l border-b border-border rounded-bl-xl" />
              <button
                onClick={() => setShowReplies(false)}
                className="text-xs text-muted-foreground hover:underline"
              >
                Hide replies
              </button>
            </div>
          )}
        </div>
      )}

      {isOwner && (
        <button
          onClick={() => setShowDeleteAlert(true)}
          disabled={isDeleting}
          className="absolute top-3 right-4 p-2 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-500 rounded-full hover:bg-red-500/10 transition-all"
        >
          <Trash2 size={16} />
        </button>
      )}

      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your comment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                deleteComment(comment.id);
                setShowDeleteAlert(false);
              }}
              className="bg-red-500 hover:bg-red-600 focus:ring-red-500"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
