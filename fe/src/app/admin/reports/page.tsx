import { getAdminReportsAction } from "@/actions/admin.actions";
import { ReportsClient } from "./reports-client";

export default async function AdminReportsPage() {
  const reports = await getAdminReportsAction("all");

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Reports</h2>
        <p className="text-muted-foreground text-sm mt-2">
          Review reports submitted by users and take action.
        </p>
      </div>

      <ReportsClient initialData={reports} />
    </div>
  );
}