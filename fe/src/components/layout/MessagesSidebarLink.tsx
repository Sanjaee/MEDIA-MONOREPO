"use client";

import Link from "next/link";
import { Mail } from "lucide-react";
import { useChatContext } from "@/context/ChatContext";

export function MessagesSidebarLink() {
  const { unreadCount } = useChatContext();

  return (
    <Link href="/messages" className="flex items-center gap-4 p-3 w-fit rounded-full hover:bg-accent transition relative">
      <div className="relative">
        <Mail className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </div>
      <span className="text-xl hidden xl:block">Messages</span>
    </Link>
  );
}
