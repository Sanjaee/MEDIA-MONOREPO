import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { postId } = await params;
    const backendUrl = process.env.BACKEND_API_URL || "http://127.0.0.1:8080/api";
    
    // As per the NextAuth + JWT setup, we pass the JWT in Authorization header, 
    // or X-User-Id if we haven't fully refactored this proxy. 
    // Let's pass both.
    const jwtToken = (session as any).accessToken;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-User-Id": session.user.id || "",
    };

    if (jwtToken) {
      headers["Authorization"] = `Bearer ${jwtToken}`;
    }

    const backendRes = await fetch(`${backendUrl}/products/${postId}/access-token`, {
      method: "POST",
      headers,
    });

    const data = await backendRes.json();
    
    if (!backendRes.ok) {
      return NextResponse.json({ success: false, error: data.error || "Backend error" }, { status: backendRes.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Access token error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
