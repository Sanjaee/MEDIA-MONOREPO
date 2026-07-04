"use server";
export async function getAdsAction() { return []; }
export async function getAdSlotsAction() { return []; }
export async function trackAdImpressionAction(adId: string) { return { success: true }; }
export async function trackAdClickAction(adId: string) { return { success: true }; }
export async function getMyPendingAds() { return []; }
export async function submitAdDetails(...args: any[]) { return { success: true }; }
export async function getActiveAds() { return []; }
