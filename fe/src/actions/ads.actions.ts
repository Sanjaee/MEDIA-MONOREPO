"use server";

import { auth } from "@/auth";


export async function getMyPendingAds() { return []; }
export async function submitAdDetails(...args: any[]) { return { success: true }; }
export async function getActiveAds() { return []; }

// Plisio Integration for Ads

const PLISIO_BASE_URL = "https://api.plisio.net/api/v1";

export async function getPlisioCurrenciesAction() {
  const baseUrl = process.env.BACKEND_API_URL || "http://127.0.0.1:8080/api";
  
  const res = await fetch(`${baseUrl}/payment/plisio/currencies`, {
    method: "GET",
    headers: {
      "Accept": "application/json"
    },
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error("Failed to fetch Plisio currencies from backend");
  }

  const data = await res.json();
  if (!data.success) {
    throw new Error("Backend API error fetching currencies");
  }

  return data.data;
}

export async function createAdPaymentAction(adId: string, amountUSD: number, currency: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const baseUrl = process.env.BACKEND_API_URL || "http://127.0.0.1:8080/api";
  
  // Need to pass token if backend requires it. Assuming you have a way to pass the session user id or token
  // Let's assume you pass a custom header or the backend just expects the bearer token
  const res = await fetch(`${baseUrl}/payment/plisio/ad`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      // "Authorization": `Bearer ${session.token}` // if needed
      "X-User-Id": session.user.id || "" // Example temporary auth header, adjust according to your backend auth
    },
    body: JSON.stringify({
      adId,
      amount: amountUSD,
      currency
    }),
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error("Failed to call backend API to create invoice");
  }

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "Backend API error");
  }

  return {
    success: true,
    invoiceUrl: data.data.hostedUrl,
    orderId: data.data.order_id
  };
}
