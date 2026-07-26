"use client";

import { useState, useEffect } from "react";
import { MonetizationTabs } from "@/components/layout/MonetizationTabs";
import { SalesDashboard } from "@/components/products/SalesDashboard";
import { AdsDashboard } from "@/components/monetization/AdsDashboard";

interface MonetizationDashboardProps {
  initialTab?: "sales" | "ads";
  salesStats: any;
  salesHistory: any[];
}

export function MonetizationDashboard({ initialTab = "sales", salesStats, salesHistory }: MonetizationDashboardProps) {
  const [activeTab, setActiveTab] = useState<"sales" | "ads">(initialTab);

  // Sync with URL hash or param if needed, but for SPA feel we just keep state
  useEffect(() => {
    // optional: update URL without reload
    window.history.replaceState(null, "", `/products/monetization?tab=${activeTab}`);
  }, [activeTab]);

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto">
      <div className="max-w-4xl w-full mx-auto p-4 sm:p-6 md:p-8 pt-12 pb-24">
        <MonetizationTabs activeTab={activeTab} setActiveTab={setActiveTab} />
        
        {activeTab === "sales" && (
          <div>
            <h1 className="text-2xl font-bold mb-6">Product Sales Dashboard</h1>
            {salesStats ? (
              <SalesDashboard stats={salesStats} initialHistory={salesHistory} />
            ) : (
              <div className="flex flex-col w-full justify-center items-center p-8">
                <h2 className="text-xl font-bold mb-2">Error Loading Sales</h2>
                <p className="text-muted-foreground">Unable to fetch your product sales statistics.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "ads" && (
          <AdsDashboard />
        )}
      </div>
    </div>
  );
}
