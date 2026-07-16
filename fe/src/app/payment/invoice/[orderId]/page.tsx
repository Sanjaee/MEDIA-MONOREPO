"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Copy, CheckCircle2 } from "lucide-react";
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
}

export default function CustomInvoicePage() {
  const { orderId } = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<WhiteLabelInvoice | null>(null);
  const [timeLeft, setTimeLeft] = useState(24 * 60 * 60); // 24 hours in seconds (fallback)
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);

  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    // Retrieve invoice data from sessionStorage
    const dataStr = sessionStorage.getItem(`invoice_${orderId}`);
    if (dataStr) {
      try {
        const data = JSON.parse(dataStr);
        setInvoice(data);
      } catch (err) {
        console.error("Failed to parse invoice data");
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
    
    // Timer countdown
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [invoice, isSuccess]);

  const { notifications } = useWebSocket();
  const [initialNotifCount, setInitialNotifCount] = useState(-1);
  const [isPending, setIsPending] = useState(false);

  // Set the initial notification count so we only react to NEW notifications
  useEffect(() => {
    if (initialNotifCount === -1 && notifications.length >= 0) {
      setInitialNotifCount(notifications.length);
    }
  }, [notifications.length, initialNotifCount]);

  // Listen for WebSocket notifications indicating payment success
  useEffect(() => {
    if (!invoice || isSuccess || initialNotifCount === -1) return;

    if (notifications.length > initialNotifCount) {
      const latestNotif = notifications[0];
      if (latestNotif) {
        if (latestNotif.actionText === "Payment Successful") {
          setIsSuccess(true);
          setIsPending(false);
          toast.success("Pembayaran berhasil!");
          setTimeout(() => {
            router.push("/");
          }, 3000);
        } else if (latestNotif.actionText === "Payment Pending") {
          setIsPending(true);
        }
      }
    }
  }, [notifications, invoice, isSuccess, initialNotifCount, router]);

  const checkStatusManual = async (isAutoPoll = false) => {
    try {
      const res = await fetch(`/api/payment/plisio/verify?order_id=${orderId}`);
      const data = await res.json();
      if (data?.data?.status === "success") {
        setIsSuccess(true);
        setIsPending(false);
        toast.success("Pembayaran berhasil!");
        setTimeout(() => {
          router.push("/");
        }, 3000);
      } else if (data?.data?.status === "pending") {
        setIsPending(true);
        if (!isAutoPoll) toast.info("Pembayaran sedang diproses.");
      } else {
        if (!isAutoPoll) toast.info("Pembayaran belum terdeteksi. Silakan coba lagi nanti.");
      }
    } catch (err) {
      console.error("Status check failed", err);
      if (!isAutoPoll) toast.error("Gagal mengecek status pembayaran");
    }
  };

  // Auto-polling fallback (every 15 seconds) in case Webhook/WebSocket fails
  useEffect(() => {
    if (!invoice || isSuccess) return;
    
    const pollTimer = setInterval(() => {
      checkStatusManual(true);
    }, 15000);

    return () => clearInterval(pollTimer);
  }, [invoice, isSuccess, orderId]);

  const copyToClipboard = (text: string, type: 'address' | 'amount') => {
    navigator.clipboard.writeText(text);
    if (type === 'address') {
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
      toast.success("Alamat dompet disalin!");
    } else {
      setCopiedAmount(true);
      setTimeout(() => setCopiedAmount(false), 2000);
      toast.success("Jumlah disalin!");
    }
  };

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0a0a]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };




  const amountDisplay = `${invoice.invoice_sum || invoice.amount} ${invoice.currency}`;

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#1c1c1e] flex flex-col items-center justify-center p-4 font-sans text-gray-900 dark:text-gray-100">
        <div className="w-full max-w-md bg-white dark:bg-white rounded-2xl overflow-hidden shadow-2xl p-10 flex flex-col items-center justify-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Pembayaran Berhasil!</h2>
          <p className="text-gray-500 text-center mb-6">
            Terima kasih, pembayaran Anda sebesar {amountDisplay} telah kami terima.
          </p>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            Mengarahkan kembali...
          </div>
        </div>
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="min-h-screen bg-[#1c1c1e] flex flex-col items-center justify-center p-4 font-sans text-gray-900 dark:text-gray-100">
        <div className="w-full max-w-md bg-white dark:bg-white rounded-2xl overflow-hidden shadow-2xl p-10 flex flex-col items-center justify-center">
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mb-6">
            <Loader2 className="w-12 h-12 text-yellow-500 animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Menunggu Konfirmasi...</h2>
          <p className="text-gray-500 text-center mb-6">
            Pembayaran telah terdeteksi dan sedang menunggu konfirmasi dari jaringan blockchain. Harap tunggu sebentar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1c1c1e] flex flex-col items-center justify-center p-4 font-sans text-gray-900 dark:text-gray-100">
      <div className="w-full max-w-md bg-white dark:bg-white text-gray-900 rounded-2xl overflow-hidden shadow-2xl">
        
        {/* Header Bar */}
        <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin opacity-80" />
            <span className="text-sm font-semibold tracking-wide">Menunggu Pembayaran...</span>
          </div>
          <div className="text-sm font-bold tracking-wider font-mono">
            {formatTime(timeLeft)}
          </div>
        </div>

        {/* Brand & Amount Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="flex bg-gradient-to-br from-blue-400 to-purple-500 text-white font-bold text-xl w-10 h-10 items-center justify-center rounded-lg shadow-sm">
              LM
            </div>
            <span className="font-bold text-gray-800 text-lg">Store</span>
          </div>
          <div className="text-right">
            <div className="font-bold text-xl text-gray-900">{amountDisplay}</div>
          </div>
        </div>

        {/* QR Code Section */}
        <div className="p-8 flex flex-col items-center bg-white">
          <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 mb-6 relative">
            <img 
              src={invoice.qr_code} 
              alt="Payment QR Code" 
              className="w-64 h-64 object-contain"
            />
            {/* Center Logo Overlay (Optional, simulating the SOL logo in the middle) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center p-1 shadow-sm">
                <div className="w-full h-full bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  {invoice.currency}
                </div>
              </div>
            </div>
          </div>

          <div className="text-center space-y-4 max-w-sm">
            <p className="text-gray-500 font-medium leading-relaxed">
              Untuk menyelesaikan pembayaran Anda, kirimkan <br/>
              <span className="text-gray-900 font-bold">{amountDisplay}</span> ke alamat di bawah ini:
            </p>

            <div className="mt-4 break-all text-center font-bold text-gray-900 text-lg px-2">
              {invoice.wallet_hash}
            </div>
            
            <div className="pt-2">
              <span className="inline-block px-4 py-1.5 bg-blue-500 text-white text-sm font-bold rounded-full shadow-sm">
                {invoice.currency}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-6 py-6 bg-gray-50 flex flex-col items-center justify-center gap-4 border-t border-gray-100">
          <div className="flex w-full items-center justify-center gap-6">
            <button 
              onClick={() => copyToClipboard(invoice.wallet_hash, 'address')}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-bold transition-colors group"
            >
              {copiedAddress ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5 group-hover:scale-110 transition-transform" />}
              <span>Salin alamat</span>
            </button>
            
            <button 
              onClick={() => copyToClipboard(invoice.invoice_sum || invoice.amount, 'amount')}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-bold transition-colors group"
            >
              {copiedAmount ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5 group-hover:scale-110 transition-transform" />}
              <span>Salin jumlah</span>
            </button>
          </div>
          
          <button 
            onClick={() => checkStatusManual(false)}
            className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-colors"
          >
            Cek Status Pembayaran
          </button>
        </div>
        
      </div>
      
      <div className="mt-6">
        <Link href="/" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">
          ← Kembali ke beranda
        </Link>
      </div>
    </div>
  );
}
