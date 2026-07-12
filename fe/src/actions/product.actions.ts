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
    let errorMsg = res.statusText;
    try {
      const errorData = await res.json();
      if (errorData && errorData.error) {
        errorMsg = errorData.error;
      }
    } catch (e) {}
    throw new Error(errorMsg);
  }

  return res.json();
}

export async function withdrawEarningsAction(currency: string, address: string, amountUsd: number) {
  try {
    const res = await fetchFromGo("/payment/products/withdraw", {
      method: "POST",
      body: JSON.stringify({
        currency,
        toAddress: address,
        amountCents: Math.floor(amountUsd * 100)
      })
    });
    
    if (!res || !res.success) {
      return { success: false, error: res?.error || "Failed to process withdrawal" };
    }
    
    return { success: true, data: res.data };
  } catch (error: any) {
    console.error("Failed to withdraw:", error);
    return { success: false, error: error.message };
  }
}

export async function getWithdrawalHistoryAction() {
  try {
    const res = await fetchFromGo("/payment/products/withdraw/history", {
      method: "GET",
    });
    if (!res || !res.success) {
      return [];
    }
    return res.data || [];
  } catch (error) {
    console.error("Failed to fetch withdrawal history:", error);
    return [];
  }
}

export type BuyerDetail = {
  userId: string;
  username: string;
  avatarUrl: string;
  amount: number;
  purchasedAt: string;
};

export type SoldProduct = {
  postId: string;
  content: string;
  price: number;
  salesCount: number;
  totalEarned: number;
  buyers: BuyerDetail[];
};

export type ProductSalesStats = {
  availableBalance: number;
  totalWithdrawn: number;
  totalRevenue: number;
  totalTransactions: number;
  products: SoldProduct[];
};

export type WithdrawalHistoryItem = {
  id: string;
  amountCents: number;
  currency: string;
  toAddress: string;
  status: string;
  createdAt: string;
};

export async function getProductSalesStatsAction(): Promise<ProductSalesStats | null> {
  try {
    const res = await fetchFromGo("/payment/products/sales");
    if (!res || !res.success) {
      return null;
    }
    return res.data;
  } catch (error) {
    console.error("Failed to fetch product sales stats:", error);
    return null;
  }
}

