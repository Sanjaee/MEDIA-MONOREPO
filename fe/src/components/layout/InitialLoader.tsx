"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export function InitialLoader() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    // Sembunyikan loading logo setelah aplikasi pertama kali dimuat (mount)
    const timer = setTimeout(() => {
      setShow(false);
    }, 300); // Sedikit delay agar terasa mulus
    
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] min-h-[100dvh] flex flex-col items-center justify-center bg-[#111111] w-full transition-opacity duration-300">
      <div className="relative w-20 h-20 animate-pulse">
        <Image
          src="/logo.png"
          alt="Loading..."
          fill
          className="object-contain"
          priority
        />
      </div>
    </div>
  );
}
