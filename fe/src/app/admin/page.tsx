import { ChartAreaInteractive } from "@/components/admin/chart-area-interactive"
import { DataTable } from "@/components/admin/data-table"
import { SectionCards } from "@/components/admin/section-cards"

import { getNewUserRegistrations, getAllUsers } from "@/actions/admin.actions"

export default async function Page() {
  const chartData = await getNewUserRegistrations()
  const usersData = await getAllUsers()

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <SectionCards />
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive chartData={chartData} />
      </div>
      <DataTable data={usersData as any} />
    </div>
  )
}
