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

export async function banUserAction(userId: string, reason: string) {
  await checkAdmin();
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

export async function getAllUsers() {
  await checkAdmin();
  return [];
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
