"use client";

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { usePathname } from "next/navigation"

export function SiteHeader() {
  const pathname = usePathname();
  let title = "Dashboard";
  if (pathname.includes("/admin/payment")) title = "Payments";
  else if (pathname.includes("/admin/news")) title = "News Management";

  return (
    <header className="flex h-[calc(var(--spacing)*12)] shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-[calc(var(--spacing)*12)]">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{title}</h1>
        <div className="ml-auto flex items-center gap-2">
          <a
            href="/"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "hidden sm:flex dark:text-foreground"
            )}
          >
            Back to App
          </a>
        </div>
      </div>
    </header>
  )
}
