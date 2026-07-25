"use server";

import { fetchFromGo } from "./feed.actions";

export async function getTrendingFeedAction({ cursor, limit = 10 }: { cursor?: { score: number; id: string } | null; limit?: number }) {
  const query = new URLSearchParams();
  if (cursor?.score) query.append("cursorScore", cursor.score.toString());
  if (cursor?.id) query.append("cursorId", cursor.id);
  query.append("limit", limit.toString());

  const res = await fetchFromGo(`/feed/trending?${query.toString()}`);
  if (!res.posts) return { posts: [], nextCursor: res.nextCursor };

  const mappedPosts = res.posts.map((post: any) => ({
    ...post,
    hasLiked: post.hasLiked || false,
    hasBookmarked: post.hasBookmarked || false,
    stats: {
      likes: post.likeCount || 0,
      replies: post.commentCount || 0,
      reposts: post.repostCount || 0,
      bookmarks: post.bookmarkCount || 0,
      views: post.viewCount || 0,
    }
  }));

  return { posts: mappedPosts, nextCursor: res.nextCursor };
}
