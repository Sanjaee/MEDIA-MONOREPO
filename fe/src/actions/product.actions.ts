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
  totalRevenue: number;
  totalTransactions: number;
  products: SoldProduct[];
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

