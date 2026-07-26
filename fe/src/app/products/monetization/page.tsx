import { getProductSalesStatsAction, getWithdrawalHistoryAction } from "@/actions/product.actions";
import { MonetizationDashboard } from "@/components/monetization/MonetizationDashboard";

export default async function MonetizationPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const { tab } = await searchParams;
  const initialTab = tab === "ads" ? "ads" : "sales";

  // Fetch sales data server-side
  const [stats, history] = await Promise.all([
    getProductSalesStatsAction(),
    getWithdrawalHistoryAction(),
  ]);

  return (
    <MonetizationDashboard 
      initialTab={initialTab}
      salesStats={stats} 
      salesHistory={history || []} 
    />
  );
}
