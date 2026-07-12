"use client";

import { useState } from "react";
import { ProductSalesStats, SoldProduct, WithdrawalHistoryItem } from "@/actions/product.actions";
import { DollarSign, ShoppingCart, Users, ArrowRight, Wallet, History, AlertCircle } from "lucide-react";
import { formatShortTime } from "@/utils/timeUtils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { WithdrawModal } from "./WithdrawModal";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export function SalesDashboard({ stats, initialHistory }: { stats: ProductSalesStats, initialHistory: WithdrawalHistoryItem[] }) {
  const [selectedProduct, setSelectedProduct] = useState<SoldProduct | null>(null);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);

  // Fallback styling and calculation
  const totalEarned = stats.totalRevenue / 100;
  const availableBalance = stats.availableBalance / 100;
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
          <h3 className="text-3xl font-bold z-10">${availableBalance.toFixed(2)}</h3>
          <button
            onClick={() => setIsWithdrawModalOpen(true)}
            className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-full text-sm font-semibold hover:bg-primary/90 transition-all shadow-md z-10"
          >
            Withdraw Funds
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Tabs for Products & Withdrawals */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="products" className="w-full flex flex-col">
            <TabsList className="inline-flex flex-row w-fit justify-start bg-muted p-1 rounded-lg mb-4">
              <TabsTrigger value="products" className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Sold Products
              </TabsTrigger>
              <TabsTrigger value="withdrawals" className="flex items-center gap-2">
                <History className="w-4 h-4" />
                Withdrawal History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="m-0 mt-0">
              {(!stats.products || stats.products.length === 0) ? (
                <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground">
                  You haven't sold any products yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {stats.products.map((product) => (
                    <div
                      key={product.postId}
                      onClick={() => setSelectedProduct(product)}
                      className={`bg-card border rounded-xl p-4 cursor-pointer transition-all hover:border-primary/50 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between ${selectedProduct?.postId === product.postId ? "ring-2 ring-primary border-transparent" : ""
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
            </TabsContent>

            <TabsContent value="withdrawals" className="m-0 mt-0">
              <div className="bg-card border rounded-xl overflow-hidden">
                <div className="p-6">
                  {(!initialHistory || initialHistory.length === 0) ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <Wallet className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>You have not made any withdrawals yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {initialHistory.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-4 rounded-lg border bg-background/50 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-full ${item.status === 'completed' ? 'bg-green-500/10 text-green-500' : item.status === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                              <Wallet className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-medium">Withdraw to {item.currency}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-xs">{item.toAddress}</p>
                              <p className="text-xs text-muted-foreground mt-1">{formatShortTime(item.createdAt)}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg">${(item.amountCents / 100).toFixed(2)}</p>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${item.status === 'completed' ? 'bg-green-500/20 text-green-600' :
                                item.status === 'error' ? 'bg-red-500/20 text-red-600' :
                                  'bg-yellow-500/20 text-yellow-600'
                              }`}>
                              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
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

      <WithdrawModal
        isOpen={isWithdrawModalOpen}
        onClose={() => setIsWithdrawModalOpen(false)}
        availableBalance={availableBalance}
      />
    </div>
  );
}
