"use server";

export async function getRecentRoleBuyers() {
  try {
    const backendUrl = process.env.BACKEND_API_URL || "http://api:8080/api";
    const res = await fetch(`${backendUrl}/payment/roles/recent`, {
      cache: "no-store"
    });
    if (!res.ok) return [];
    
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Failed to fetch recent role buyers", error);
    return [];
  }
}
