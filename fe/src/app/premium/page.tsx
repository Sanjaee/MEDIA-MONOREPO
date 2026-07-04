import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { X } from "lucide-react";
import Link from "next/link";
import { PremiumCards } from "@/components/premium/PremiumCards";

export default async function PremiumPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  const userName = session.user.name || "User";

  return (
    <div className="w-full flex flex-col items-center min-h-screen bg-black text-white pb-24 pt-8 px-4 font-sans relative">
      
      {/* Close Button */}
      <div className="absolute top-4 left-4 z-50">
        <Link href="/" className="p-2 bg-transparent hover:bg-white/10 rounded-full transition-colors flex items-center justify-center">
          <X className="w-6 h-6 text-white" />
        </Link>
      </div>

      <PremiumCards userName={userName} />

    </div>
  );
}
