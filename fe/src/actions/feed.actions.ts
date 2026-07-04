"use server";

import { db } from "@/db";
import { posts, media } from "@/db/schema";
import { desc, sql, and, or, eq, exists } from "drizzle-orm";
import { auth } from "@/auth";

function formatPost(post: any, userId?: string) {
  return {
    id: post.id,
    content: post.content,
    createdAt: post.createdAt,
    author: {
      id: post.author.id,
      name: post.author.name,
      username: post.author.username,
      image: post.author.image,
      isVerified: post.author.isVerified,
      role: post.author.role,
    },
    media: post.media.map((m: any) => ({
      id: m.id,
      type: m.type,
      url: m.url,
      publicId: m.publicId,
      thumbnailUrl: m.thumbnailUrl,
    })),
    stats: {
      replies: post.commentCount || 0,
      reposts: post.repostCount || 0,
      likes: post.likeCount || 0,
      views: post.viewCount || 0,
      bookmarks: post.bookmarkCount || 0,
    },
    hasLiked: post.likes ? post.likes.length > 0 : false,
    hasBookmarked: post.bookmarks ? post.bookmarks.length > 0 : false,
  };
}

export async function getLatestFeedAction({ cursor, limit = 10 }: { cursor?: { createdAt: string; id: string } | null; limit?: number }) {
  const session = await auth();
  const userId = session?.user?.id;

  const allPosts = await db.query.posts.findMany({
    where: cursor
      ? or(
          sql`${posts.createdAt} < ${new Date(cursor.createdAt)}`,
          and(
            eq(posts.createdAt, new Date(cursor.createdAt)),
            sql`${posts.id} < ${cursor.id}`
          )
        )
      : undefined,
    orderBy: [desc(posts.createdAt), desc(posts.id)],
    with: {
      author: true,
      media: true,
      ...(userId ? { 
        likes: { where: (likes: any, { eq }: any) => eq(likes.userId, userId) },
        bookmarks: { where: (bookmarks: any, { eq }: any) => eq(bookmarks.userId, userId) }
      } : {}),
    },
    limit: limit + 1,
  });

  let nextCursor = null;
  if (allPosts.length > limit) {
    const nextItem = allPosts.pop();
    if (nextItem && nextItem.createdAt) {
      nextCursor = {
        createdAt: nextItem.createdAt.toISOString(),
        id: nextItem.id,
      };
    }
  }

  return {
    posts: allPosts.map(p => formatPost(p, userId)),
    nextCursor,
  };
}

export async function getTrendingFeedAction({ cursor, limit = 10 }: { cursor?: { score: number; id: string } | null; limit?: number }) {
  const session = await auth();
  const userId = session?.user?.id;

  const trendingScoreExpr = sql<number>`(${posts.likeCount} * 1 + ${posts.commentCount} * 3 + ${posts.repostCount} * 4 + ${posts.bookmarkCount} * 5 + ${posts.viewCount} * 0.05)`;
  const hasEngagementExpr = sql<boolean>`(${posts.likeCount} > 0 OR ${posts.commentCount} > 0 OR ${posts.repostCount} > 0 OR ${posts.bookmarkCount} > 0)`;

  const allPosts = await db.query.posts.findMany({
    extras: {
      score: trendingScoreExpr.as("score")
    },
    where: and(
      hasEngagementExpr,
      cursor
        ? or(
            sql`${trendingScoreExpr} < ${cursor.score}`,
            and(
              sql`${trendingScoreExpr} = ${cursor.score}`,
              sql`${posts.id} < ${cursor.id}`
            )
          )
        : undefined
    ),
    orderBy: [desc(trendingScoreExpr), desc(posts.id)],
    with: {
      author: true,
      media: true,
      ...(userId ? { 
        likes: { where: (likes: any, { eq }: any) => eq(likes.userId, userId) },
        bookmarks: { where: (bookmarks: any, { eq }: any) => eq(bookmarks.userId, userId) }
      } : {}),
    },
    limit: limit + 1,
  });

  let nextCursor = null;
  if (allPosts.length > limit) {
    const nextItem = allPosts.pop();
    if (nextItem) {
      nextCursor = {
        score: Number(nextItem.score) || 0,
        id: nextItem.id,
      };
    }
  }

  return {
    posts: allPosts.map(p => formatPost(p, userId)),
    nextCursor,
  };
}

export async function getHotFeedAction({ cursor, limit = 10 }: { cursor?: { score: number; id: string } | null; limit?: number }) {
  const session = await auth();
  const userId = session?.user?.id;

  const hotScoreExpr = sql<number>`(${posts.likeCount} * 1 + ${posts.commentCount} * 3 + ${posts.repostCount} * 4 + ${posts.bookmarkCount} * 5) / (GREATEST(EXTRACT(EPOCH FROM (NOW() - ${posts.createdAt})) / 3600, 0) + 2)`;

  const allPosts = await db.query.posts.findMany({
    extras: {
      score: hotScoreExpr.as("score")
    },
    where: cursor
      ? or(
          sql`${hotScoreExpr} < ${cursor.score}`,
          and(
            sql`${hotScoreExpr} = ${cursor.score}`,
            sql`${posts.id} < ${cursor.id}`
          )
        )
      : undefined,
    orderBy: [desc(hotScoreExpr), desc(posts.id)],
    with: {
      author: true,
      media: true,
      ...(userId ? { 
        likes: { where: (likes: any, { eq }: any) => eq(likes.userId, userId) },
        bookmarks: { where: (bookmarks: any, { eq }: any) => eq(bookmarks.userId, userId) }
      } : {}),
    },
    limit: limit + 1,
  });

  let nextCursor = null;
  if (allPosts.length > limit) {
    const nextItem = allPosts.pop();
    if (nextItem) {
      nextCursor = {
        score: Number(nextItem.score) || 0,
        id: nextItem.id,
      };
    }
  }

  return {
    posts: allPosts.map(p => formatPost(p, userId)),
    nextCursor,
  };
}

export async function getMediaFeedAction({ cursor, limit = 10 }: { cursor?: { createdAt: string; id: string } | null; limit?: number }) {
  const session = await auth();
  const userId = session?.user?.id;

  const allPosts = await db.query.posts.findMany({
    where: and(
      exists(db.select({ id: media.id }).from(media).where(eq(media.postId, posts.id))),
      cursor
        ? or(
            sql`${posts.createdAt} < ${new Date(cursor.createdAt)}`,
            and(
              eq(posts.createdAt, new Date(cursor.createdAt)),
              sql`${posts.id} < ${cursor.id}`
            )
          )
        : undefined
    ),
    orderBy: [desc(posts.createdAt), desc(posts.id)],
    with: {
      author: true,
      media: true,
      ...(userId ? { 
        likes: { where: (likes: any, { eq }: any) => eq(likes.userId, userId) },
        bookmarks: { where: (bookmarks: any, { eq }: any) => eq(bookmarks.userId, userId) }
      } : {}),
    },
    limit: limit + 1,
  });

  let nextCursor = null;
  if (allPosts.length > limit) {
    const nextItem = allPosts.pop();
    if (nextItem && nextItem.createdAt) {
      nextCursor = {
        createdAt: nextItem.createdAt.toISOString(),
        id: nextItem.id,
      };
    }
  }

  return {
    posts: allPosts.map(p => formatPost(p, userId)),
    nextCursor,
  };
}

export async function getSearchFeedAction({ q, cursor, limit = 10 }: { q: string; cursor?: { createdAt: string; id: string } | null; limit?: number }) {
  if (!q || q.trim() === "") {
    return { posts: [], nextCursor: null };
  }

  const session = await auth();
  const userId = session?.user?.id;
  const searchTerm = `%${q.trim()}%`;

  const allPosts = await db.query.posts.findMany({
    where: and(
      or(
        sql`${posts.content} ILIKE ${searchTerm}`,
        sql`EXISTS (SELECT 1 FROM users WHERE users.id = ${posts.authorId} AND (users.name ILIKE ${searchTerm} OR users.username ILIKE ${searchTerm}))`
      ),
      cursor
        ? or(
            sql`${posts.createdAt} < ${new Date(cursor.createdAt)}`,
            and(
              eq(posts.createdAt, new Date(cursor.createdAt)),
              sql`${posts.id} < ${cursor.id}`
            )
          )
        : undefined
    ),
    orderBy: [desc(posts.createdAt), desc(posts.id)],
    with: {
      author: true,
      media: true,
      ...(userId ? { 
        likes: { where: (likes: any, { eq }: any) => eq(likes.userId, userId) },
        bookmarks: { where: (bookmarks: any, { eq }: any) => eq(bookmarks.userId, userId) }
      } : {}),
    },
    limit: limit + 1,
  });

  let nextCursor = null;
  if (allPosts.length > limit) {
    const nextItem = allPosts.pop();
    if (nextItem && nextItem.createdAt) {
      nextCursor = {
        createdAt: nextItem.createdAt.toISOString(),
        id: nextItem.id,
      };
    }
  }

  return {
    posts: allPosts.map(p => formatPost(p, userId)),
    nextCursor,
  };
}
