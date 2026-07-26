"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function MonetizationTabs() {
  const pathname = usePathname();
  
  return (
    <div className="flex space-x-1 border-b border-border/40 mb-6 pb-px">
      <Link 
        href="/products/sales"
        className={cn(
          "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
          pathname === "/products/sales" 
            ? "border-primary text-foreground" 
            : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
        )}
      >
        Product Sales
      </Link>
      <Link 
        href="/products/ads"
        className={cn(
          "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
          pathname === "/products/ads" 
            ? "border-primary text-foreground" 
            : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
        )}
      >
        Advertising
      </Link>
    </div>
  );
}
