"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Copy, Check, ArrowLeft, Clock, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useWebSocket } from "@/components/providers/WebSocketProvider";

interface WhiteLabelInvoice {
  wallet_hash: string;
  qr_code: string;
  amount: string;
  currency: string;
  status: string;
  expected_confirmations: string;
  pending_amount: string;
  invoice_sum: string;
  crypto_received_amount?: string;
}

export default function CustomInvoicePage() {
  const { orderId } = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<WhiteLabelInvoice | null>(null);
  const [timeLeft, setTimeLeft] = useState(24 * 60 * 60);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);

  const [isSuccess, setIsSuccess] = useState(false);
  const [isPending, setIsPending] = useState(false);
  
  const [redirectUrl, setRedirectUrl] = useState("/");
  const [redirectCountdown, setRedirectCountdown] = useState(5);

  const { notifications } = useWebSocket();

  useEffect(() => {
    const dataStr = sessionStorage.getItem(`invoice_${orderId}`);
    if (dataStr) {
      try {
        const data = JSON.parse(dataStr);
        setInvoice(data);
      } catch (err) {
        toast.error("Invalid invoice data");
        router.push("/");
      }
    } else {
      toast.error("Invoice not found");
      router.push("/");
    }
  }, [orderId, router]);

  useEffect(() => {
    if (!invoice || isSuccess) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [invoice, isSuccess]);

  const [pageLoadTime] = useState(() => Date.now());

  const checkStatusManual = async (isAutoPoll = false) => {
    try {
      const res = await fetch(`/api/payment/crypto/verify?order_id=${orderId}`);
      const data = await res.json();
      
      const payment = data?.data?.payment;
      if (payment?.crypto_pending_amount) {
        setInvoice((prev) => prev ? { ...prev, pending_amount: payment.crypto_pending_amount } : prev);
      }

      if (data?.data?.status === "success") {
        setIsSuccess(true);
        setIsPending(false);
        
        // Determine redirect url based on item_type
        const type = data.data.payment?.ItemType;
        const iId = data.data.payment?.ItemID;
        if (type === 'product') {
          setRedirectUrl(`/post/${iId}`);
        } else if (type === 'ad') {
          setRedirectUrl('/ads');
        } else {
          setRedirectUrl('/');
        }

        if (!isAutoPoll) toast.success("Payment successful!");
      } else if (data?.data?.status === "pending") {
        if (payment?.crypto_pending_amount && Number(payment.crypto_pending_amount) > 0) {
          setIsPending(false);
          if (!isAutoPoll) toast.info("Partial payment received. Please send the remaining amount.");
        } else {
          setIsPending(true);
          if (!isAutoPoll) toast.info("Payment is processing.");
        }
      } else {
        if (!isAutoPoll) toast.info("Payment not detected yet. Please try again later.");
      }
    } catch (err) {
      if (!isAutoPoll) toast.error("Failed to check payment status");
    }
  };

  useEffect(() => {
    if (!invoice || isSuccess) return;
    
    // Find the first notification that arrived after this page was loaded
    const recentNotif = notifications.find(n => new Date(n.timestamp).getTime() > pageLoadTime);
    if (recentNotif) {
      if (recentNotif.actionText === "Payment Successful") {
        // Just trigger a manual check, do NOT eagerly set success
        // because the notification might be for a different payment.
        checkStatusManual(true);
      } else if (recentNotif.actionText === "Payment Pending") {
        checkStatusManual(true);
      }
    }
  }, [notifications, invoice, isSuccess, pageLoadTime]);

  useEffect(() => {
    if (!invoice || isSuccess) return;
    const pollTimer = setInterval(() => {
      checkStatusManual(true);
    }, 3000);
    return () => clearInterval(pollTimer);
  }, [invoice, isSuccess, orderId]);

  // Handle countdown logic for redirect
  useEffect(() => {
    if (isSuccess && redirectCountdown > 0) {
      const timer = setTimeout(() => setRedirectCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    } else if (isSuccess && redirectCountdown === 0) {
      window.location.href = redirectUrl;
    }
  }, [isSuccess, redirectCountdown, redirectUrl]);

  const copyToClipboard = (text: string, type: 'address' | 'amount') => {
    navigator.clipboard.writeText(text);
    if (type === 'address') {
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
      toast.success("Wallet address copied!");
    } else {
      setCopiedAmount(true);
      setTimeout(() => setCopiedAmount(false), 2000);
      toast.success("Amount copied!");
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          <p className="text-white font-medium tracking-wide">Loading invoice...</p>
        </div>
      </div>
    );
  }

  const amountDisplay = `${invoice.invoice_sum || invoice.amount} ${invoice.currency}`;
  const cryptoIcon = `/crypto-icons/${invoice.currency.toUpperCase()}.svg`;

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-4 font-sans text-white">
        <div className="w-full max-w-sm bg-[#16181c] text-white rounded-3xl overflow-hidden shadow-2xl p-10 flex flex-col items-center justify-center text-center border border-white/10">
          <div className="w-24 h-24 bg-black border border-white/10 text-white rounded-full flex items-center justify-center mb-6 shadow-xl">
            <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={2} />
          </div>
          <h2 className="text-2xl font-bold mb-2 uppercase tracking-wide">Payment Successful!</h2>
          <p className="text-gray-400 mb-8 font-medium">
            Your payment of <span className="text-white font-bold">{amountDisplay}</span> has been received.
          </p>
          <div className="flex flex-col items-center w-full gap-4">
            <div className="flex items-center gap-3 text-sm text-gray-400 font-medium">
              <Loader2 className="w-4 h-4 animate-spin" />
              Redirecting automatically in {redirectCountdown} seconds...
            </div>
            <Link href={redirectUrl} className="w-full bg-white hover:bg-gray-200 text-black font-bold py-3 rounded-xl transition-colors uppercase text-sm tracking-wider shadow-lg">
              Continue Now
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-4 font-sans text-white">
        <div className="w-full max-w-sm bg-[#16181c] text-white rounded-3xl overflow-hidden shadow-2xl p-10 flex flex-col items-center justify-center text-center relative border border-white/10">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-black overflow-hidden">
            <div className="h-full bg-white w-1/2 animate-[slide_1.5s_ease-in-out_infinite]" />
          </div>
          <div className="w-24 h-24 bg-black border border-white/10 text-white rounded-full flex items-center justify-center mb-6 shadow-xl">
            <Clock className="w-12 h-12 animate-pulse text-white" strokeWidth={2} />
          </div>
          <h2 className="text-2xl font-bold mb-2 uppercase tracking-wide">Awaiting Confirmation</h2>
          <p className="text-gray-400 font-medium leading-relaxed">
            Payment detected. Please wait for blockchain confirmation. You can close this page, we will process it automatically.
          </p>
        </div>
        <style jsx global>{`
          @keyframes slide {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-4 font-sans text-white">
      <div className="w-full max-w-xs flex flex-col items-center gap-2 mt-4">
        
        {/* Countdown Timer (Moved to top, no label) */}
        <div className="flex flex-col items-center mb-2">
          <div className="flex items-center gap-2 text-white bg-white/5 px-4 py-2 rounded-xl border border-white/10 shadow-inner">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="font-mono text-lg font-bold tracking-wider">{formatTime(timeLeft)}</span>
          </div>
        </div>

        {/* Amount Section */}
        <div className="flex flex-col items-center gap-1 mb-2">
          {invoice.pending_amount && Number(invoice.pending_amount) > 0 && Number(invoice.pending_amount) < Number(invoice.invoice_sum || invoice.amount) ? (
            <>
              <span className="text-gray-400 text-sm mt-2 text-center text-[#999]">Original Amount: <span className="text-white font-bold">{amountDisplay}</span></span>
              
              {invoice.crypto_received_amount ? (
                 <span className="text-gray-400 text-sm mt-1 text-center text-[#999]">We have received: <span className="text-white font-bold">{invoice.crypto_received_amount} {invoice.currency}</span></span>
              ) : (
                 <span className="text-gray-400 text-sm mt-1 text-center text-[#999]">We have received: <span className="text-white font-bold">{(Number(invoice.invoice_sum || invoice.amount) - (Number(invoice.pending_amount)/1.05)).toFixed(8)} {invoice.currency}</span></span>
              )}

              <span className="text-gray-400 text-sm mt-1 text-[#8b91a7]">To complete your payment, please send</span>
              <div 
                className="font-bold text-2xl text-red-500 animate-pulse cursor-pointer hover:text-red-400 transition-colors flex items-center justify-center gap-2 group w-full px-2 mt-1" 
                onClick={() => copyToClipboard(invoice.pending_amount, 'amount')}
              >
                <span className="text-center">{invoice.pending_amount} {invoice.currency}</span>
                {copiedAmount ? <Check className="w-5 h-5 text-green-400 flex-shrink-0" /> : <Copy className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0" />}
              </div>
              <span className="text-gray-400 text-sm mb-2 text-[#8b91a7]">to the address below:</span>
            </>
          ) : (
            <>
              <span className="text-gray-400 text-sm">Amount to Pay</span>
              <div 
                className="font-bold text-2xl text-white cursor-pointer hover:text-gray-300 transition-colors flex items-center justify-center gap-2 group w-full px-2" 
                onClick={() => copyToClipboard(invoice.invoice_sum || invoice.amount, 'amount')}
              >
                <span className="text-center">{amountDisplay}</span>
                {copiedAmount ? <Check className="w-5 h-5 text-green-400 flex-shrink-0" /> : <Copy className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0" />}
              </div>
            </>
          )}
        </div>

        {/* QR Code Section */}
        <div className="bg-white p-3 rounded-xl mb-2 relative inline-block mx-auto">
          <img
            src={invoice.qr_code}
            alt="Payment QR Code"
            className="w-48 h-48 object-contain"
          />
          {/* Center Logo Overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center p-1 border-2 border-black">
              <img src={cryptoIcon} alt={invoice.currency} className="w-full h-full object-contain" />
            </div>
          </div>
        </div>

        <h3 className="font-bold text-[17px] text-white tracking-wide mt-2">
          {invoice.currency.charAt(0).toUpperCase() + invoice.currency.slice(1)} Address
        </h3>

        {/* Wallet Address - No Background, Inline Copy */}
        <div 
          className="flex items-center justify-center gap-2 w-full cursor-pointer group px-2 mt-1"
          onClick={() => copyToClipboard(invoice.wallet_hash, 'address')}
        >
          <p className="font-bold text-white text-[17px] break-all text-center leading-relaxed">
            {invoice.wallet_hash}
          </p>
          {copiedAddress ? <Check className="w-5 h-5 text-green-400 flex-shrink-0" /> : <Copy className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0" />}
        </div>

      </div>

      <div className="mt-8">
        <Link href="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">
          <ArrowLeft className="w-4 h-4" />
          Cancel Payment
        </Link>
      </div>
    </div>
  );
}
