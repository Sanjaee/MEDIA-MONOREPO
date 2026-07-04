"use server";

import { db } from "@/db";
import { comments, posts } from "@/db/schema";
import { eq, desc, and, isNull, sql, asc } from "drizzle-orm";
import { auth } from "@/auth";

export async function createCommentAction({ postId, content, parentCommentId }: { postId: string, content: string, parentCommentId?: string | null }) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const commentId = crypto.randomUUID();

  await db.insert(comments).values({
    id: commentId,
    postId,
    authorId: session.user.id as string,
    content,
    parentCommentId: parentCommentId || null,
  });

  if (parentCommentId) {
    await db.update(comments)
      .set({ replyCount: sql`${comments.replyCount} + 1` })
      .where(eq(comments.id, parentCommentId));
  } else {
    await db.update(posts)
      .set({ commentCount: sql`${posts.commentCount} + 1` })
      .where(eq(posts.id, postId));
  }

  const newComment = await db.query.comments.findFirst({
    where: eq(comments.id, commentId),
    with: { 
      author: true,
      parentComment: {
        with: {
          author: true,
        }
      }
    },
  });

  return newComment;
}

export async function getCommentsAction(postId: string, cursor?: Date | null, limit = 20) {
  const whereClause = cursor
    ? and(eq(comments.postId, postId), isNull(comments.parentCommentId), sql`${comments.createdAt} < ${cursor}`)
    : and(eq(comments.postId, postId), isNull(comments.parentCommentId));

  const fetchedComments = await db.query.comments.findMany({
    where: whereClause,
    orderBy: [desc(comments.createdAt)],
    limit: limit + 1,
    with: { author: true },
  });

  let nextCursor: Date | null = null;
  if (fetchedComments.length > limit) {
    const nextItem = fetchedComments.pop();
    nextCursor = nextItem?.createdAt ?? null;
  }

  return { comments: fetchedComments, nextCursor };
}

export async function getRepliesAction(parentCommentId: string, cursor?: Date | null, limit = 20) {
  const whereClause = cursor
    ? and(eq(comments.parentCommentId, parentCommentId), sql`${comments.createdAt} > ${cursor}`)
    : eq(comments.parentCommentId, parentCommentId);

  const fetchedReplies = await db.query.comments.findMany({
    where: whereClause,
    orderBy: [asc(comments.createdAt)],
    limit: limit + 1,
    with: { 
      author: true,
      parentComment: {
        with: {
          author: true,
        }
      }
    },
  });

  let nextCursor: Date | null = null;
  if (fetchedReplies.length > limit) {
    const nextItem = fetchedReplies.pop();
    nextCursor = nextItem?.createdAt ?? null;
  }

  return { replies: fetchedReplies, nextCursor };
}

export async function deleteCommentAction(commentId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const comment = await db.query.comments.findFirst({
    where: eq(comments.id, commentId),
  });

  if (!comment) throw new Error("Not found");
  if (comment.authorId !== session.user.id) throw new Error("Forbidden");

  // recursively delete replies (for SQLite usually PRAGMA foreign_keys, but Neon Postgres we might need manual delete if cascade not set)
  // Simple hack: delete replies first
  await db.delete(comments).where(eq(comments.parentCommentId, commentId));
  
  await db.delete(comments).where(eq(comments.id, commentId));

  if (comment.parentCommentId) {
    await db.update(comments)
      .set({ replyCount: sql`GREATEST(${comments.replyCount} - 1, 0)` })
      .where(eq(comments.id, comment.parentCommentId));
  } else {
    await db.update(posts)
      .set({ commentCount: sql`GREATEST(${posts.commentCount} - 1, 0)` })
      .where(eq(posts.id, comment.postId));
  }

  return { success: true };
}
