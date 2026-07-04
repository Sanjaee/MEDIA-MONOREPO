"use server";

import { auth } from "@/auth";

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
export async function createCommentAction({ postId, content, parentCommentId }: { postId: string, content: string, parentCommentId?: string | null }) {
  return fetchFromGo('/comments', {
    method: 'POST',
    body: JSON.stringify({ postId, content, parentCommentId }),
  });
}

export async function getCommentsAction(postId: string, cursor?: Date | string | null, limit = 20) {
  const params = new URLSearchParams();
  if (cursor) {
    const cursorStr = typeof cursor === 'string' ? cursor : cursor.toISOString();
    params.append('cursor', cursorStr);
  }
  params.append('limit', limit.toString());

  return fetchFromGo(`/comments/post/${postId}?${params.toString()}`);
}

export async function getRepliesAction(parentCommentId: string, cursor?: Date | string | null, limit = 20) {
  const params = new URLSearchParams();
  if (cursor) {
    const cursorStr = typeof cursor === 'string' ? cursor : cursor.toISOString();
    params.append('cursor', cursorStr);
  }
  params.append('limit', limit.toString());

  return fetchFromGo(`/comments/${parentCommentId}/replies?${params.toString()}`);
}

export async function deleteCommentAction(commentId: string) {
  return fetchFromGo(`/comments/${commentId}`, {
    method: 'DELETE',
  });
}
