"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { PremiumCards } from "./PremiumCards";

export function PremiumModal({ userName }: { userName: string }) {
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleDismiss = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      router.back();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[99] bg-black sm:bg-black/90 backdrop-blur-sm" />
      <div 
        ref={overlayRef}
        onClick={handleDismiss}
        className="fixed inset-0 z-[100] flex p-4 overflow-y-auto"
      >
        <div className="relative w-full max-w-[1200px] m-auto bg-black min-h-[80vh] rounded-2xl border border-[#333] shadow-2xl flex flex-col items-center pb-24 pt-8 px-4">
          {/* Close Button */}
          <div className="absolute top-4 left-4 z-50">
            <button 
              onClick={() => router.back()}
              className="p-2 bg-transparent hover:bg-white/10 rounded-full transition-colors flex items-center justify-center"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>

          <PremiumCards userName={userName} />
        </div>
      </div>
    </>
  );
}
