"use server";

import { auth } from "@/auth";

const API_URL = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8080/api";

export type FriendStatus = "none" | "pending" | "accepted" | "incoming_request";

async function authedFetch(endpoint: string, options: RequestInit = {}) {
  const session = await auth();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `Request failed: ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore parse errors, fall back to generic message
    }
    throw new Error(message);
  }

  return res.json();
}

type SocialStatusResult = {
  friendStatus: FriendStatus;
  isFriend: boolean;
  isBlocked: boolean;
};

export async function getSocialStatusAction(userId: string): Promise<SocialStatusResult> {
  try {
    const data = await authedFetch(`/users/${userId}/social`);
    return {
      friendStatus: data.friendStatus ?? "none",
      isFriend: !!data.isFriend,
      isBlocked: !!data.isBlocked,
    };
  } catch {
    return { friendStatus: "none", isFriend: false, isBlocked: false };
  }
}

export async function toggleFriendAction(userId: string): Promise<{ status: FriendStatus; isFriend: boolean }> {
  const data = await authedFetch(`/users/${userId}/friend`, { method: "POST" });
  return {
    status: (data.status as FriendStatus) ?? "none",
    isFriend: !!data.isFriend,
  };
}

export async function blockUserAction(userId: string): Promise<{ isBlocked: boolean }> {
  const data = await authedFetch(`/users/${userId}/block`, { method: "POST" });
  return { isBlocked: data.isBlocked ?? true };
}

export async function unblockUserAction(userId: string): Promise<{ isBlocked: boolean }> {
  const data = await authedFetch(`/users/${userId}/block`, { method: "DELETE" });
  return { isBlocked: data.isBlocked ?? false };
}

export async function reportPostAction(postId: string, reason: string, description?: string): Promise<{ success: boolean }> {
  const data = await authedFetch(`/posts/${postId}/report`, {
    method: "POST",
    body: JSON.stringify({ reason, description: description || "" }),
  });
  return { success: !!data.success };
}