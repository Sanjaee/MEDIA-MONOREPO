"use client";

import Link from "next/link";
import { XCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function FailedContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order_id");

  return (
    <div className="min-h-screen flex items-center justify-center bg-black w-full">
      <div className="bg-[#16181c] p-10 rounded-2xl border border-[#333] flex flex-col items-center max-w-md w-full text-center mx-4">
        <XCircle className="w-20 h-20 text-red-500 mb-6" />
        <h1 className="text-3xl font-bold text-white mb-4">Payment Failed!</h1>
        <p className="text-gray-400 mb-2">
          Unfortunately, your payment could not be processed.
        </p>
        <p className="text-sm text-gray-500 mb-8 break-all">
          Order ID: {orderId}
        </p>
        <div className="flex w-full gap-4">
          <Link 
            href="/premium"
            className="flex-1 bg-[#333c45] hover:bg-[#434e5a] text-white font-bold py-3 px-6 rounded-full transition-colors"
          >
            Try Again
          </Link>
          <Link 
            href="/"
            className="flex-1 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-bold py-3 px-6 rounded-full transition-colors"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PaymentFailedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black text-white">Loading...</div>}>
      <FailedContent />
    </Suspense>
  );
}
