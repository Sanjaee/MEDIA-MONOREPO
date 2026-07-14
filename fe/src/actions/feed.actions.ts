"use server";

import { auth } from "@/auth";

const API_URL = process.env.BACKEND_API_URL || "http://127.0.0.1:8080/api";

async function fetchFromGo(endpoint: string) {
  const session = await auth();
  const token = (session as any)?.accessToken; // In a real app, use a proper session token or JWT

  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    },
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch from Go API: ${res.statusText}`);
  }

  return res.json();
}

export async function getLatestFeedAction({ cursor, limit = 10 }: { cursor?: { createdAt: string; id: string } | null; limit?: number }) {
  const query = new URLSearchParams();
  if (cursor?.createdAt) query.append("cursor", cursor.createdAt);
  query.append("limit", limit.toString());

  const res = await fetchFromGo(`/feed/latest?${query.toString()}`);
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

export async function getTrendingFeedAction({ cursor, limit = 10 }: { cursor?: { score: number; id: string } | null; limit?: number }) {
  const query = new URLSearchParams();
  if (cursor?.score) query.append("cursorScore", cursor.score.toString());
  if (cursor?.id) query.append("cursorId", cursor.id);
  query.append("limit", limit.toString());

  return fetchFromGo(`/feed/trending?${query.toString()}`);
}

export async function getHotFeedAction({ cursor, limit = 10 }: { cursor?: { score: number; id: string } | null; limit?: number }) {
  const query = new URLSearchParams();
  if (cursor?.score) query.append("cursorScore", cursor.score.toString());
  if (cursor?.id) query.append("cursorId", cursor.id);
  query.append("limit", limit.toString());

  return fetchFromGo(`/feed/hot?${query.toString()}`);
}

export async function getMediaFeedAction({ cursor, limit = 10 }: { cursor?: { createdAt: string; id: string } | null; limit?: number }) {
  const query = new URLSearchParams();
  if (cursor?.createdAt) query.append("cursor", cursor.createdAt);
  query.append("limit", limit.toString());

  return fetchFromGo(`/feed/media?${query.toString()}`);
}

export async function getSearchFeedAction({ q, cursor, limit = 10 }: { q: string; cursor?: { createdAt: string; id: string } | null; limit?: number }) {
  if (!q || q.trim() === "") {
    return { posts: [], nextCursor: null };
  }

  const query = new URLSearchParams();
  query.append("q", q);
  if (cursor?.createdAt) query.append("cursor", cursor.createdAt);
  query.append("limit", limit.toString());

  return fetchFromGo(`/feed/search?${query.toString()}`);
}
