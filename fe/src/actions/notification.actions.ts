"use server";

import { auth } from "@/auth";

const API_URL = process.env.BACKEND_API_URL || "http://127.0.0.1:8080/api";

async function fetchFromGo(endpoint: string, options: RequestInit = {}) {
  const session = await auth();
  const token = session?.user?.id;

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}`, "X-User-Id": token } : {}),
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
  const res = await fetchFromGo(`/notifications?limit=${limit}&offset=${offset}`);
  return res.data || [];
}

export async function markNotificationAsReadAction(id: string) {
  const res = await fetchFromGo(`/notifications/${id}/read`, { method: "PUT" });
  return res.data === "success";
}

export async function markAllNotificationsAsReadAction() {
  const res = await fetchFromGo(`/notifications/read-all`, { method: "PUT" });
  return res.data === "success";
}
