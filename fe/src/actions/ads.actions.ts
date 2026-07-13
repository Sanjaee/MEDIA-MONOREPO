"use server";

import { auth } from "@/auth";


export async function getMyPendingAds() {
  const session = await auth();
  if (!session?.user) return [];
  const baseUrl = process.env.BACKEND_API_URL || "http://127.0.0.1:8080/api";
  const res = await fetch(`${baseUrl}/ads/pending`, {
    headers: { "X-User-Id": session.user.id || "" },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

export async function getMyActiveAdsAction() {
  const session = await auth();
  if (!session?.user) return [];
  const baseUrl = process.env.BACKEND_API_URL || "http://127.0.0.1:8080/api";
  const res = await fetch(`${baseUrl}/ads/active`, {
    headers: { "X-User-Id": session.user.id || "" },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  // filter by user id
  return (data.data || []).filter((ad: any) => ad.userId === session.user?.id);
}

export async function getActiveAds() {
  const baseUrl = process.env.BACKEND_API_URL || "http://127.0.0.1:8080/api";
  const res = await fetch(`${baseUrl}/ads/active`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

export async function createPendingAdAction(durationDays: number = 1) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const baseUrl = process.env.BACKEND_API_URL || "http://127.0.0.1:8080/api";
  const res = await fetch(`${baseUrl}/ads/`, {
    method: "POST",
    headers: { 
      "X-User-Id": session.user.id || "",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ durationDays })
  });
  if (!res.ok) throw new Error("Failed to create pending ad");
  const data = await res.json();
  return data.data;
}

// Plisio Integration for Ads

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
