import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const API_URL = process.env.BACKEND_API_URL || "http://127.0.0.1:8080/api";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const token = (session as any)?.accessToken;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const response = await fetch(`${API_URL}/posts`, {
      method: "POST",
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
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("API proxy error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
