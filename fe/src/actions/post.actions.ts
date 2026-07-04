"use server";

import { auth } from "@/auth";
import { CreatePostInput } from "@/lib/validations/post";

const API_URL = process.env.BACKEND_API_URL || "http://127.0.0.1:8080/api";

async function fetchFromGo(endpoint: string, options: RequestInit = {}) {
  const session = await auth();
  const token = session?.user?.id; // Using user ID as a mock token

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch from Go API: ${res.statusText}`);
  }

  return res.json();
}

export async function createPostAction(input: CreatePostInput) {
  // In a real app, Cloudinary uploads could still happen here or be moved to Go.
  // For this migration, we send the payload directly to Go API.
  return fetchFromGo('/posts', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function deletePostAction(postId: string) {
  return fetchFromGo(`/posts/${postId}`, {
    method: 'DELETE'
  });
}

export async function getPostById(postId: string) {
  try {
    return await fetchFromGo(`/posts/${postId}`);
  } catch (e) {
    return null;
  }
}

export async function toggleLikeAction(postId: string) {
  return fetchFromGo(`/posts/${postId}/like`, {
    method: 'POST'
  });
}

export async function toggleBookmarkAction(postId: string) {
  return fetchFromGo(`/posts/${postId}/bookmark`, {
    method: 'POST'
  });
}

export async function searchPostsAction(query: string, limit: number = 5) {
  if (!query || query.trim().length === 0) return [];
  
  const res = await fetchFromGo(`/feed/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  return res.posts || [];
}

export async function getInfiniteBookmarkedPostsAction({
  cursor,
  limit = 10,
}: {
  cursor?: { createdAt: Date; id: string } | null;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (cursor?.createdAt) query.append("cursor", cursor.createdAt.toISOString());
  query.append("limit", limit.toString());

  return fetchFromGo(`/feed/bookmarks?${query.toString()}`);
}

export async function getInfiniteFeedPostsAction({
  cursor,
  limit = 10,
}: {
  cursor?: string | null;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (cursor) query.append("cursor", cursor);
  query.append("limit", limit.toString());

  return fetchFromGo(`/feed/latest?${query.toString()}`);
}
