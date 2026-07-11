"use client";

import { useState } from "react";
import { ProductSalesStats, SoldProduct } from "@/actions/product.actions";
import { DollarSign, ShoppingCart, Users, ArrowRight, Wallet } from "lucide-react";
import { formatShortTime } from "@/utils/timeUtils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function SalesDashboard({ stats }: { stats: ProductSalesStats }) {
  const [selectedProduct, setSelectedProduct] = useState<SoldProduct | null>(null);

  // Fallback styling and calculation
  const totalEarned = stats.totalRevenue / 100;
  const totalSales = stats.totalTransactions;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border rounded-xl p-6 shadow-sm flex flex-col items-center justify-center text-center transition-all hover:shadow-md">
          <div className="p-3 bg-green-500/10 text-green-500 rounded-full mb-4">
            <DollarSign className="w-6 h-6" />
          </div>
          <p className="text-sm text-muted-foreground mb-1">Total Revenue</p>
          <h3 className="text-3xl font-bold">${totalEarned.toFixed(2)}</h3>
        </div>
        
        <div className="bg-card border rounded-xl p-6 shadow-sm flex flex-col items-center justify-center text-center transition-all hover:shadow-md">
          <div className="p-3 bg-blue-500/10 text-blue-500 rounded-full mb-4">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <p className="text-sm text-muted-foreground mb-1">Total Sales</p>
          <h3 className="text-3xl font-bold">{totalSales}</h3>
        </div>

        <div className="bg-card border border-primary/20 rounded-xl p-6 shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-50"></div>
          <div className="p-3 bg-primary/20 text-primary rounded-full mb-4 z-10">
            <Wallet className="w-6 h-6" />
          </div>
          <p className="text-sm text-muted-foreground mb-1 z-10">Available to Withdraw</p>
          <h3 className="text-3xl font-bold z-10">${totalEarned.toFixed(2)}</h3>
          <button className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-full text-sm font-semibold hover:bg-primary/90 transition-all shadow-md z-10">
            Withdraw Funds
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-muted-foreground" />
            Sold Products
          </h2>
          
          {stats.products.length === 0 ? (
            <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground">
              You haven't sold any products yet.
            </div>
          ) : (
            <div className="space-y-3">
              {stats.products.map((product) => (
                <div 
                  key={product.postId}
                  onClick={() => setSelectedProduct(product)}
                  className={`bg-card border rounded-xl p-4 cursor-pointer transition-all hover:border-primary/50 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between ${
                    selectedProduct?.postId === product.postId ? "ring-2 ring-primary border-transparent" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground line-clamp-1 mb-1">{product.content || "Product Post"}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {product.salesCount} sold</span>
                      <span className="font-semibold text-green-500">${(product.price / 100).toFixed(2)} each</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm text-muted-foreground">Earned</p>
                    <p className="text-xl font-bold">${(product.totalEarned / 100).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Buyers Details */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Users className="w-5 h-5 text-muted-foreground" />
            Buyer Details
          </h2>
          
          <div className="bg-card border rounded-xl overflow-hidden h-[500px] flex flex-col">
            {!selectedProduct ? (
              <div className="flex-1 flex items-center justify-center p-6 text-center text-muted-foreground">
                Select a product from the list to view who bought it.
              </div>
            ) : (
              <>
                <div className="p-4 border-b bg-muted/30">
                  <h3 className="font-semibold line-clamp-1">{selectedProduct.content || "Product"}</h3>
                  <p className="text-sm text-muted-foreground">{selectedProduct.salesCount} Purchases</p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {selectedProduct.buyers.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground mt-4">No buyers yet.</p>
                  ) : (
                    selectedProduct.buyers.map((buyer, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-background/50 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <Avatar className="w-10 h-10 border shadow-sm">
                            <AvatarImage src={buyer.avatarUrl || ""} />
                            <AvatarFallback>{buyer.username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{buyer.username}</p>
                            <p className="text-xs text-muted-foreground">{formatShortTime(buyer.purchasedAt)}</p>
                          </div>
                        </div>
                        <div className="text-right font-bold text-green-500 text-sm whitespace-nowrap">
                          +${(buyer.amount / 100).toFixed(2)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
