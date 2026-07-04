import { NextResponse } from "next/server";
import { getMediaFeedAction } from "@/actions/feed.actions";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cursorParam = searchParams.get("cursor");
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    let cursor = null;
    if (cursorParam) {
      cursor = JSON.parse(cursorParam);
    }

    const result = await getMediaFeedAction({ cursor, limit });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Media Feed Error:", error);
    return NextResponse.json({ error: "Failed to fetch media feed" }, { status: 500 });
  }
}
