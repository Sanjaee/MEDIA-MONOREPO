"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, Suspense, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import axios from "axios";

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order_id");
  const { data: session, update } = useSession();
  const [verifying, setVerifying] = useState(true);

  const hasVerified = useRef(false);

  useEffect(() => {
    const verifyPayment = async () => {
      if (!orderId || !session?.user?.id || hasVerified.current) return;
      hasVerified.current = true;
      
      try {
        await axios.get(`/api/payment/plisio/verify?order_id=${orderId}`, {
          headers: {
            Authorization: `Bearer ${session.user.id}`
          }
        });
        // Force refresh the session to get the updated user role
        await update();
        
        // Automatically redirect to home and force a hard refresh
        window.location.href = "/";
      } catch (error) {
        console.error("Failed to verify order:", error);
      } finally {
        setVerifying(false);
      }
    };

    verifyPayment();
  }, [orderId, session?.user?.id]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black w-full">
      <div className="bg-[#16181c] p-10 rounded-2xl border border-[#333] flex flex-col items-center max-w-md w-full text-center mx-4">
        <CheckCircle2 className="w-20 h-20 text-green-500 mb-6" />
        <h1 className="text-3xl font-bold text-white mb-4">Payment Successful!</h1>
        <p className="text-gray-400 mb-2">
          Your payment has been successfully processed by Plisio.
        </p>
        <p className="text-sm text-gray-500 mb-8 break-all">
          Order ID: {orderId}
        </p>
        <p className="text-sm text-yellow-500 mb-8">
          Note: Please allow 1-5 minutes for the cryptocurrency network to confirm the transaction and for your role to be updated.
        </p>
        <a 
          href="/"
          className="w-full bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-bold py-3 px-6 rounded-full transition-colors block text-center"
        >
          Return to Home
        </a>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black text-white">Loading...</div>}>
      <SuccessContent />
    </Suspense>
  );
}
