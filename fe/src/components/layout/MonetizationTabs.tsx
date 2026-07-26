"use client";

import { cn } from "@/lib/utils";

interface MonetizationTabsProps {
  activeTab: "sales" | "ads";
  setActiveTab: (tab: "sales" | "ads") => void;
}

export function MonetizationTabs({ activeTab, setActiveTab }: MonetizationTabsProps) {
  
  return (
    <div className="flex space-x-1 border-b border-border/40 mb-6 pb-px">
      <button 
        onClick={() => setActiveTab("sales")}
        className={cn(
          "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
          activeTab === "sales"
            ? "border-primary text-foreground" 
            : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
        )}
      >
        Product Sales
      </button>
      <button 
        onClick={() => setActiveTab("ads")}
        className={cn(
          "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
          activeTab === "ads"
            ? "border-primary text-foreground" 
            : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
        )}
      >
        Advertising
      </button>
    </div>
  );
}
