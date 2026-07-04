"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function BackButton() {
  const router = useRouter();

  const handleBack = () => {
    // Check if we can go back, otherwise go to home
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <button 
      onClick={handleBack} 
      className="hover:bg-muted/50 p-2 rounded-full transition-colors -ml-2"
      aria-label="Go back"
    >
      <ArrowLeft size={20} />
    </button>
  );
}
