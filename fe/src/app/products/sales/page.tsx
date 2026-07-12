import { getProductSalesStatsAction, getWithdrawalHistoryAction } from "@/actions/product.actions";
import { SalesDashboard } from "@/components/products/SalesDashboard";

export default async function SalesPage() {
  const [stats, history] = await Promise.all([
    getProductSalesStatsAction(),
    getWithdrawalHistoryAction(),
  ]);

  if (!stats) {
    return (
      <div className="flex flex-col h-full w-full justify-center items-center p-8">
        <h2 className="text-xl font-bold mb-2">Error Loading Sales</h2>
        <p className="text-muted-foreground">Unable to fetch your product sales statistics.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto">
      <div className="max-w-4xl w-full mx-auto p-4 sm:p-6 md:p-8">
        <h1 className="text-2xl font-bold mb-6">Product Sales Dashboard</h1>
        <SalesDashboard stats={stats} initialHistory={history || []} />
      </div>
    </div>
  );
}
