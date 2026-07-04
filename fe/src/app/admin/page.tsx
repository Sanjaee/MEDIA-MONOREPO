import { AppSidebar } from "@/components/admin/app-sidebar"
import { ChartAreaInteractive } from "@/components/admin/chart-area-interactive"
import { DataTable } from "@/components/admin/data-table"
import { SectionCards } from "@/components/admin/section-cards"
import { SiteHeader } from "@/components/admin/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

import { getNewUserRegistrations, getAllUsers } from "@/actions/admin.actions"

export default async function Page() {
  const chartData = await getNewUserRegistrations()
  const usersData = await getAllUsers()

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards />
              <div className="px-4 lg:px-6">
                <ChartAreaInteractive chartData={chartData} />
              </div>
              <DataTable data={usersData as any} />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
