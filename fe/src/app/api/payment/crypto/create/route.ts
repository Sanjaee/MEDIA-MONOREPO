import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { role, currency } = body;

    const backendUrl = process.env.BACKEND_API_URL || "http://127.0.0.1:8080/api";
    
    const backendRes = await fetch(`${backendUrl}/payment/crypto/role`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": session.user.id || "",
      },
      body: JSON.stringify({ role, currency })
    });

    const data = await backendRes.json();
    
    if (!backendRes.ok) {
      return NextResponse.json({ success: false, error: data.error || "Backend error" }, { status: backendRes.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Payment create error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
