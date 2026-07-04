import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { posts, postViews } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { postId } = await req.json();
    if (!postId) {
      return NextResponse.json({ error: "Missing postId" }, { status: 400 });
    }

    const userId = session.user.id;

    // Check if the view already exists
    const existingView = await db.query.postViews.findFirst({
      where: (views, { and, eq }) => and(eq(views.postId, postId), eq(views.userId, userId))
    });

    if (existingView) {
      return NextResponse.json({ success: true, message: "Already viewed" });
    }

    // Insert view
    await db.insert(postViews).values({
      postId,
      userId,
    });

    // Increment viewCount
    await db.update(posts)
      .set({ viewCount: sql`view_count + 1` })
      .where(eq(posts.id, postId));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    // If it's a unique constraint violation, it means it was inserted concurrently, safely ignore.
    if (error.code === '23505') {
      return NextResponse.json({ success: true, message: "Already viewed (concurrent)" });
    }
    
    console.error("View tracking error:", error);
    return NextResponse.json({ error: "Failed to track view" }, { status: 500 });
  }
}
