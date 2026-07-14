import { NextResponse, NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    const backendUrl = process.env.BACKEND_API_URL || "http://127.0.0.1:8080/api";
    
    // We don't need auth here because the token itself acts as auth and is one-time use
    const backendRes = await fetch(`${backendUrl}/products/download?token=${token}`, {
      method: "GET",
      redirect: "manual", // So we can capture the redirect location
    });

    if (backendRes.status === 307 || backendRes.status === 302 || backendRes.status === 308 || backendRes.status === 301) {
        const location = backendRes.headers.get("location");
        if (location) {
            try {
                // If it's an absolute URL, this will succeed
                new URL(location);
                return NextResponse.redirect(location);
            } catch {
                // If it's a relative URL, resolve it against the request URL
                return NextResponse.redirect(new URL(location, req.url));
            }
        }
    }

    if (!backendRes.ok) {
      const text = await backendRes.text();
      return new NextResponse(text, { status: backendRes.status });
    }

    return new NextResponse("Unexpected response", { status: 500 });
  } catch (error: any) {
    console.error("Download proxy error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
