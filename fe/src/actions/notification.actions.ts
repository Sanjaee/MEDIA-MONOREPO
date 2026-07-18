"use server";

import { auth } from "@/auth";

const API_URL = process.env.BACKEND_API_URL || "http://127.0.0.1:8080/api";

async function fetchFromGo(endpoint: string, options: RequestInit = {}) {
  const session = await auth();
  const token = (session as any)?.accessToken;
  const userId = (session?.user as any)?.id;

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      ...(userId ? { "X-User-Id": userId } : {}),
      ...(options.headers || {}),
    },
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch from Go API: ${res.statusText}`);
  }

  return res.json();
}

export async function getNotificationsAction(limit: number = 20, offset: number = 0) {
  try {
    const res = await fetchFromGo(`/notifications?limit=${limit}&offset=${offset}`);
    return res.data || [];
  } catch (error) {
    return [];
  }
}

export async function markNotificationAsReadAction(id: string) {
  const res = await fetchFromGo(`/notifications/${id}/read`, { method: "PUT" });
  return res.data === "success";
}

export async function markAllNotificationsAsReadAction() {
  const res = await fetchFromGo(`/notifications/read-all`, { method: "PUT" });
  return res.data === "success";
}

export async function deleteNotificationAction(id: string) {
  const res = await fetchFromGo(`/notifications/${id}`, { method: "DELETE" });
  return res.data === "success";
}

export async function deleteAllNotificationsAction() {
  const res = await fetchFromGo(`/notifications/delete-all`, { method: "DELETE" });
  return res.data === "success";
}
