"use server";

import { auth } from "@/auth";

async function checkAdmin() {
  const session = await auth();
  const role = (session?.user as any)?.role || (session?.user as any)?.Role;
  if (role !== "owner") {
    throw new Error("Unauthorized: Owner access required");
  }
}

export async function getDashboardStatsAction() {
  await checkAdmin();
  return { totalUsers: 0, totalPosts: 0, totalComments: 0 };
}

export async function getRecentUsersAction() {
  await checkAdmin();
  return [];
}

export async function banUserAction(userId: string, reason: string, durationDays: number) {
  await checkAdmin();
  const session = await auth();
  const backendUrl = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

  const res = await fetch(`${backendUrl}/admin/users/${userId}/ban`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${(session as any)?.accessToken}`,
    },
    body: JSON.stringify({ reason, duration_days: durationDays }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to ban user: ${errorText}`);
  }

  return { success: true };
}

export async function unbanUserAction(userId: string) {
  await checkAdmin();
  const session = await auth();
  const backendUrl = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

  const res = await fetch(`${backendUrl}/admin/users/${userId}/unban`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${(session as any)?.accessToken}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to unban user: ${errorText}`);
  }

  return { success: true };
}

export async function updateUserRoleAction(userId: string, role: string) {
  await checkAdmin();
  return { success: true };
}

export async function getNewUserRegistrations() {
  await checkAdmin();
  return [];
}

export type AdminUserRow = {
  id: string;
  username: string;
  name: string;
  email: string;
  image?: string;
  avatar_url?: string;
  role: string;
  is_verified: boolean;
  is_banned: boolean;
  createdAt: string;
};

export async function getAllUsers(): Promise<AdminUserRow[]> {
  await checkAdmin();
  const session = await auth();
  const backendUrl = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";
  
  const res = await fetch(`${backendUrl}/admin/users`, {
    headers: {
      Authorization: `Bearer ${(session as any)?.accessToken}`,
    },
    cache: "no-store",
  });
  
  if (!res.ok) {
    throw new Error(`Failed to fetch admin users: ${res.statusText}`);
  }
  
  const data = await res.json();
  return data || [];
}

export type AdminTransactionRow = {
  id: string;
  userId: string;
  username: string;
  email: string;
  itemType: string;
  itemId: string;
  amount: number;
  status: string;
  paymentMethod: string;
  createdAt: string;
  cryptoOrderId?: string;
  cryptoTxnId?: string;
  cryptoPendingAmount?: string;
  cryptoReceivedAmount?: string;
  invoiceUrl?: string;
};

export async function getAdminTransactionsAction(): Promise<AdminTransactionRow[]> {
  await checkAdmin();
  const session = await auth();
  const backendUrl = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";
  
  const res = await fetch(`${backendUrl}/payment/admin/transactions`, {
    headers: {
      Authorization: `Bearer ${(session as any)?.accessToken}`,
    },
    cache: "no-store",
  });
  
  if (!res.ok) {
    throw new Error(`Failed to fetch admin transactions: ${res.statusText}`);
  }
  
  const data = await res.json();
  return data || [];
}
