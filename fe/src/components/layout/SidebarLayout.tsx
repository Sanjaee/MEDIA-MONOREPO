"use client";

import { usePathname } from "next/navigation";

interface SidebarLayoutProps {
  navbar: React.ReactNode;
  leftSidebar: React.ReactNode;
  rightSidebar: React.ReactNode;
  children: React.ReactNode;
}

export function SidebarLayout({ navbar, leftSidebar, rightSidebar, children }: SidebarLayoutProps) {
  const pathname = usePathname();

  // Show sidebars and navbar only on these main app routes
  const mainRoutes = ["/", "/trending", "/search", "/notifications", "/messages", "/settings", "/bookmarks", "/news"];
  const isPostDetail = pathname.includes("/status/");
  const showSidebars = mainRoutes.includes(pathname) || isPostDetail;

  if (pathname === "/premium" || pathname.startsWith("/admin")) {
    return <>{children}</>;
  }

  if (!showSidebars) {
    // For profile pages (or any other full-width pages), hide the sidebars but KEEP the navbar
    return (
      <div className="flex flex-col min-h-screen bg-[#111111]">
        {navbar}
        <div className="flex w-full min-h-screen justify-center flex-1">
          <div className="flex w-full max-w-[1600px] px-2 md:px-8 py-6">
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {navbar}
      <div className="flex w-full max-w-7xl mx-auto justify-center flex-1">
        {leftSidebar}
        <div className="flex w-full max-w-2xl min-w-0">
          {children}
        </div>
        {rightSidebar}
      </div>
    </div>
  );
}
