"use server";

import { db } from "@/db";
import { users, posts, comments, likes } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function getUserProfileByUsername(username: string) {
  // Try to find the user
  const user = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  if (!user) return null;

  // Fetch counts: total posts, total comments, total likes received (optional, we can just do a simple aggregation or mock it for now)
  const postsResult = await db.select({ count: sql<number>`count(*)` }).from(posts).where(eq(posts.authorId, user.id));
  const commentsResult = await db.select({ count: sql<number>`count(*)` }).from(comments).where(eq(comments.authorId, user.id));
  
  const totalPosts = Number(postsResult[0]?.count || 0);
  const totalComments = Number(commentsResult[0]?.count || 0);

  // We don't have "reputation", so we use "total posts" or similar for now.
  // Fetch recent posts
  const recentPosts = await db.query.posts.findMany({
    where: eq(posts.authorId, user.id),
    orderBy: (posts, { desc }) => [desc(posts.createdAt)],
    limit: 3,
  });
  
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    image: user.image,
    bio: user.bio,
    role: user.role,
    isVerified: user.isVerified,
    isBanned: user.isBanned,
    banReason: user.banReason,
    createdAt: user.createdAt,
    stats: {
      totalThreads: totalPosts, // map posts to threads
      totalPosts: totalComments, // map comments to posts (forum style)
      reputation: 0, // Mock
    },
    recentPosts: recentPosts.map(p => ({
      id: p.id,
      content: p.content,
      createdAt: p.createdAt,
    }))
  };
}
