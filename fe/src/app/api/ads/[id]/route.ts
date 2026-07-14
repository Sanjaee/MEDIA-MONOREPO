import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const API_URL = process.env.BACKEND_API_URL || "http://127.0.0.1:8080/api";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    const token = (session as any)?.accessToken;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: adId } = await params;
    if (!adId) {
      return NextResponse.json({ error: "Missing Ad ID" }, { status: 400 });
    }

    const formData = await req.formData();
    
    // Pass the multipart/form-data directly to the backend
    const response = await fetch(`${API_URL}/ads/${adId}`, {
      method: "PUT",
      body: formData,
      headers: {
        "Authorization": `Bearer ${token}`
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ error: `Backend Error: ${response.statusText}`, details: text }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("API proxy error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    const token = (session as any)?.accessToken;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: adId } = await params;
    if (!adId) {
      return NextResponse.json({ error: "Missing Ad ID" }, { status: 400 });
    }
    
    const response = await fetch(`${API_URL}/ads/${adId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${token}`
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ error: `Backend Error: ${response.statusText}`, details: text }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("API proxy error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
