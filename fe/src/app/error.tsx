"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="fixed inset-0 z-[9999] min-h-[100dvh] flex flex-col items-center justify-center bg-[#111111] text-white w-full p-4">
      <div className="max-w-md w-full border border-[#333] bg-[#1b1b1b] p-8 text-center flex flex-col items-center shadow-lg">
        <div className="w-16 h-16 bg-[#cc0000]/20 text-[#cc0000] flex items-center justify-center rounded-full mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
        </div>
        <h2 className="text-xl font-bold mb-2">Something went wrong!</h2>
        <p className="text-[#888] mb-6 text-sm">{error.message || "An unexpected error occurred."}</p>
        
        <div className="flex gap-3 w-full justify-center">
          <Button
            onClick={() => router.back()}
            variant="outline"
            className="border-[#444] text-white bg-transparent hover:bg-[#333] px-6"
          >
            Go Back
          </Button>
          <Button
            onClick={() => reset()}
            className="bg-[#21425e] text-white hover:bg-[#1a354b] px-6"
          >
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
