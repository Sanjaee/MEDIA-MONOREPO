import { NextResponse, NextRequest } from "next/server";
import { auth, unstable_update } from "@/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("order_id");

    if (!orderId) {
      return NextResponse.json({ success: false, error: "Missing order_id" }, { status: 400 });
    }

    const backendUrl = process.env.BACKEND_API_URL || "http://127.0.0.1:8080/api";
    
    const backendRes = await fetch(`${backendUrl}/payment/crypto/verify?order_id=${orderId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": session.user.id || "",
      },
    });

    const data = await backendRes.json();
    
    if (!backendRes.ok) {
      return NextResponse.json({ success: false, error: data.error || "Backend error" }, { status: backendRes.status });
    }

    // Update the session if the payment was successful and role has changed
    const payment = data?.data?.payment;
    if (data?.data?.status === "success" && payment?.ItemType === "role") {
      try {
        await unstable_update({ user: { role: payment.ItemID } as any });
      } catch (err) {
        console.error("Session update failed:", err);
      }
    }

    // Remove sensitive data before sending to client
    if (data?.data?.payment) {
      delete data.data.payment.CryptoOrderID;
      delete data.data.payment.CryptoTxnID;
      delete data.data.payment.InvoiceURL;
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Payment verify error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
