"use server";

import { db } from "@/db";
import { adSlots } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { auth } from "@/auth";

export async function getActiveAds() {
  const now = new Date();
  
  const ads = await db.query.adSlots.findMany({
    where: and(
      eq(adSlots.status, 'active'),
      gt(adSlots.activeUntil, now)
    ),
    with: {
      user: true,
    },
    // Ordered by creation or activeFrom if needed, right now random or created
    orderBy: (adSlots, { asc }) => [asc(adSlots.createdAt)],
  });

  return ads.map(ad => ({
    id: ad.id,
    title: ad.title || "",
    description: ad.description || "",
    imageUrl: ad.imageUrl || "",
    linkUrl: ad.linkUrl || "",
    authorName: ad.user.name || ad.user.username || "User",
  }));
}

export async function getMyPendingAds() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const ads = await db.query.adSlots.findMany({
    where: and(
      eq(adSlots.userId, session.user.id),
      eq(adSlots.status, 'pending_input')
    ),
  });

  return ads;
}

export async function submitAdDetails(adId: string, title: string, description: string, imageUrl: string, linkUrl: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const existingAd = await db.query.adSlots.findFirst({
    where: and(
      eq(adSlots.id, adId),
      eq(adSlots.userId, session.user.id),
      eq(adSlots.status, 'pending_input')
    ),
  });

  if (!existingAd) {
    throw new Error("Ad slot not found or not in pending input state");
  }

  await db.update(adSlots).set({
    title,
    description,
    imageUrl,
    linkUrl,
    status: 'active',
    activeFrom: new Date(),
    updatedAt: new Date()
  }).where(eq(adSlots.id, adId));

  return { success: true };
}
