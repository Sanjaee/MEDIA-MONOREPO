import { getAdminTransactionsAction } from "@/actions/admin.actions";
import { PaymentClient } from "./payment-client";

export default async function AdminPaymentPage() {
  const transactions = await getAdminTransactionsAction();

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Payments</h2>
        <p className="text-muted-foreground text-sm mt-2">
          View all user transactions for ads and products.
        </p>
      </div>

      <PaymentClient initialData={transactions} />
    </div>
  );
}
