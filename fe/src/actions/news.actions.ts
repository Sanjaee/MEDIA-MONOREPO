"use server";

import { db } from "@/db";
import { news, newsMedia, users } from "@/db/schema";
import { desc, sql, or, and, eq } from "drizzle-orm";
import { auth } from "@/auth";

export async function createNewsAction(data: {
  customUsername: string;
  customRole?: string;
  content: string;
  mediaUrl?: string; // Simplification, just url
}) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  // Check if owner/admin
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (user?.role !== "admin" && user?.role !== "owner") {
    throw new Error("Forbidden: Only admin or owner can create news");
  }

  const [newNews] = await db.insert(news).values({
    customUsername: data.customUsername,
    customRole: data.customRole || "Admin",
    content: data.content,
  }).returning();

  if (data.mediaUrl) {
    await db.insert(newsMedia).values({
      newsId: newNews.id,
      type: "image", // hardcode or infer
      url: data.mediaUrl,
    });
  }

  return newNews;
}

function formatNews(newsItem: any) {
  return {
    id: newsItem.id,
    content: newsItem.content,
    createdAt: newsItem.createdAt,
    author: {
      username: newsItem.customUsername,
      role: newsItem.customRole,
    },
    media: newsItem.media.map((m: any) => ({
      id: m.id,
      type: m.type,
      url: m.url,
      publicId: m.publicId,
      thumbnailUrl: m.thumbnailUrl,
    })),
  };
}

export async function getNewsFeedAction({ cursor, limit = 10 }: { cursor?: { createdAt: string; id: string } | null; limit?: number }) {
  const allNews = await db.query.news.findMany({
    where: cursor
      ? or(
          sql`${news.createdAt} < ${new Date(cursor.createdAt)}`,
          and(
            eq(news.createdAt, new Date(cursor.createdAt)),
            sql`${news.id} < ${cursor.id}`
          )
        )
      : undefined,
    orderBy: [desc(news.createdAt), desc(news.id)],
    with: {
      media: true,
    },
    limit: limit + 1,
  });

  let nextCursor = null;
  if (allNews.length > limit) {
    const nextItem = allNews.pop();
    if (nextItem && nextItem.createdAt) {
      nextCursor = {
        createdAt: nextItem.createdAt.toISOString(),
        id: nextItem.id,
      };
    }
  }

  return {
    posts: allNews.map(n => formatNews(n)), // We use `posts` key to be compatible with useInfiniteQuery for feed
    nextCursor,
  };
}
