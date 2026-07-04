"use client";

import { Bell } from "lucide-react";
import { useWebSocket } from "@/components/providers/WebSocketProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { formatShortTime } from "@/utils/timeUtils";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function NotificationDropdown() {
  const { notifications, unreadCount, markAsRead } = useWebSocket();
  const router = useRouter();

  return (
    <DropdownMenu onOpenChange={(open) => open && markAsRead()}>
      <DropdownMenuTrigger className="relative flex items-center justify-center rounded-full w-10 h-10 hover:bg-muted/50 focus:outline-none">
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[400px] overflow-y-auto">
        <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground font-bold flex justify-between items-center">
          <span>Notifications</span>
          <span className="text-xs font-normal text-muted-foreground">{notifications.length} total</span>
        </div>
        <DropdownMenuSeparator />
        
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No new notifications
          </div>
        ) : (
          notifications.map((notif, index) => 
            notif.postId ? (
              <DropdownMenuItem 
                key={index} 
                className="flex flex-col items-start w-full p-3 focus:bg-muted/50 cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  setTimeout(() => {
                    if (notif.postId) {
                      router.push(`/post/${notif.postId}`);
                    }
                  }, 100);
                }}
              >
                <div className="flex w-full justify-between items-center mb-1">
                  <span className="font-semibold text-sm">{notif.title}</span>
                  <span className="text-xs text-muted-foreground">{formatShortTime(notif.timestamp)}</span>
                </div>
                <span className="text-sm text-muted-foreground line-clamp-2">{notif.message}</span>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem 
                key={index} 
                className="flex flex-col items-start w-full p-3 focus:bg-muted/50 cursor-pointer"
              >
                <div className="flex w-full justify-between items-center mb-1">
                  <span className="font-semibold text-sm">{notif.title}</span>
                  <span className="text-xs text-muted-foreground">{formatShortTime(notif.timestamp)}</span>
                </div>
                <span className="text-sm text-muted-foreground line-clamp-2">{notif.message}</span>
              </DropdownMenuItem>
            )
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
