"use client";

import { Bell, User } from "lucide-react";
import { useWebSocket } from "@/components/providers/WebSocketProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatShortTime } from "@/utils/timeUtils";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { UserNameWithRole } from "@/components/ui/UserNameWithRole";

export function NotificationDropdown() {
  const { notifications, unreadCount, markAsRead } = useWebSocket();
  const router = useRouter();
  const [parentRef, setParentRef] = useState<HTMLDivElement | null>(null);

  const virtualizer = useVirtualizer({
    count: notifications.length,
    getScrollElement: () => parentRef,
    estimateSize: () => 76,
    overscan: 5,
  });

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
      <DropdownMenuContent align="end" className="w-80 p-0 overflow-hidden">
        <div className="px-3 py-2 text-xs font-medium text-muted-foreground font-bold flex justify-between items-center border-b">
          <span>Notifications</span>
          <span className="text-xs font-normal text-muted-foreground">{notifications.length} total</span>
        </div>
        
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No new notifications
          </div>
        ) : (
          <div ref={setParentRef} className="max-h-[400px] overflow-y-auto w-full relative">
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const notif = notifications[virtualItem.index];
                return (
                  <div
                    key={virtualItem.key}
                    data-index={virtualItem.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <div 
                      role="menuitem"
                      className="flex items-start w-full h-full p-3 hover:bg-muted/50 focus:bg-muted/50 cursor-pointer rounded-none border-b border-border/50 outline-none"
                      onClick={(e) => {
                        e.preventDefault();
                        if (notif.postId) {
                          setTimeout(() => {
                            router.push(`/post/${notif.postId}`);
                          }, 100);
                        }
                      }}
                      tabIndex={0}
                    >
                      <div className="flex w-full pointer-events-none gap-3">
                        <div className="flex-shrink-0">
                          {notif.actor?.image ? (
                            <img src={notif.actor.image} alt={notif.actor.username || "User"} className="w-10 h-10 rounded-full object-cover bg-muted" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                              <User className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col w-full overflow-hidden">
                          <div className="flex justify-between items-start w-full">
                            <span className="text-sm leading-tight pr-2 flex items-center flex-wrap gap-1">
                              <UserNameWithRole 
                                displayName={notif.actor?.username || "Someone"} 
                                role={notif.actor?.role} 
                                className="inline-flex" 
                              />
                              <span className="text-muted-foreground">{notif.actionText}</span>
                            </span>
                            <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 mt-0.5">
                              {formatShortTime(notif.timestamp)}
                            </span>
                          </div>
                          {notif.message && (
                            <span className="text-sm text-muted-foreground line-clamp-5 mt-1">{notif.message}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

