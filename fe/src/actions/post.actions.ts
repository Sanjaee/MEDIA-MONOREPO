"use server";

import { auth } from "@/auth";
import { CreatePostInput } from "@/lib/validations/post";

const API_URL = process.env.BACKEND_API_URL || "http://127.0.0.1:8080/api";

async function fetchFromGo(endpoint: string, options: RequestInit = {}) {
  const session = await auth();
  const token = (session as any)?.accessToken; // Using user ID as a mock token

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

function mapGoPostToNextPost(post: any) {
  if (!post) return post;
  return {
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
  };
}

export async function createPostAction(formData: FormData) {
  const session = await auth();
  const token = (session as any)?.accessToken;

  const newFormData = new FormData();
  
  const content = formData.get("content");
  if (content) {
    newFormData.append("content", content);
  }
  
  const mediaFiles = formData.getAll("media");
  for (const file of mediaFiles) {
    newFormData.append("media", file);
  }

  const isProduct = formData.get("isProduct");
  if (isProduct === "true") {
    newFormData.append("isProduct", "true");
    
    const productPrice = formData.get("productPrice");
    if (productPrice) {
      newFormData.append("productPrice", productPrice);
    }
    
    const productUrl = formData.get("productUrl");
    if (productUrl) {
      newFormData.append("productUrl", productUrl);
    }
  }

  const res = await fetch(`${API_URL}/posts`, {
    method: 'POST',
    body: newFormData,
    headers: {
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    },
    cache: "no-store"
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("API Response:", res.status, errorText);
    throw new Error(`Failed to create post: ${res.statusText}. ${errorText}`);
  }

  return res.json();
}

export async function deletePostAction(postId: string) {
  return fetchFromGo(`/posts/${postId}`, {
    method: 'DELETE'
  });
}

export async function getPostById(postId: string) {
  try {
    const post = await fetchFromGo(`/posts/${postId}`);
    return mapGoPostToNextPost(post);
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
  return (res.posts || []).map(mapGoPostToNextPost);
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

  const res = await fetchFromGo(`/feed/bookmarks?${query.toString()}`);
  if (!res.posts) return { posts: [], nextCursor: res.nextCursor };
  return { posts: res.posts.map(mapGoPostToNextPost), nextCursor: res.nextCursor };
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

  const res = await fetchFromGo(`/feed/latest?${query.toString()}`);
  if (!res.posts) return { posts: [], nextCursor: res.nextCursor };
  return { posts: res.posts.map(mapGoPostToNextPost), nextCursor: res.nextCursor };
}
