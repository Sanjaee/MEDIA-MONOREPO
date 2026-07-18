"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getNotificationsAction, markAllNotificationsAsReadAction } from "@/actions/notification.actions";

export type Notification = {
  id?: string;
  actor?: {
    username?: string;
    image?: string;
    role?: string;
  };
  actionText: string;
  message?: string;
  postId?: string;
  timestamp: Date;
  isRead?: boolean;
};

type WebSocketContextType = {
  ws: WebSocket | null;
  isConnected: boolean;
  notifications: Notification[];
  clearNotifications: () => void;
  deleteNotification: (id: string) => void;
  unreadCount: number;
  markAsRead: () => void;
};

const WebSocketContext = createContext<WebSocketContextType>({
  ws: null,
  isConnected: false,
  notifications: [],
  clearNotifications: () => {},
  deleteNotification: (id: string) => {},
  unreadCount: 0,
  markAsRead: () => {},
});

export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Initial fetch of notifications
    if (session?.user?.id) {
      getNotificationsAction().then((data) => {
        if (data && data.length > 0) {
          const mapped = data.map((n: any) => ({
            id: n.id,
            actor: {
              username: n.actor?.username || "System",
              image: (!n.actor?.username || n.actor?.username === "System") ? "/logo.png" : (n.actor?.image || null),
              role: (!n.actor?.username || n.actor?.username === "System") ? "admin" : (n.actor?.role || "user"),
          },
          actionText: n.type === "LIKE" ? "liked your post" 
                    : n.type === "SYSTEM" ? (n.message?.includes("Digital Product") ? "Payment Successful" : "Role Upgraded")
                    : n.type === "PRODUCT_SALE" ? "purchased your product"
                    : "commented",
          message: n.type === "LIKE" ? "" : (n.message || ""),
          postId: n.entityId,
          timestamp: new Date(n.createdAt),
          isRead: n.isRead,
        }));
        
        setNotifications(mapped);
        setUnreadCount(mapped.filter((n: any) => !n.isRead).length);
      }
    });
    }

    if (!session?.user?.id) return;

    let wsUrl = "";
    if (process.env.NEXT_PUBLIC_API_URL) {
      wsUrl = process.env.NEXT_PUBLIC_API_URL.replace("http", "ws").replace("/api", "/api/ws");
    } else {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      wsUrl = `${protocol}//${window.location.host}/api/ws`;
    }

    const ws = new WebSocket(`${wsUrl}?userId=${session.user.id}`);

    ws.onopen = () => {
      console.log("WebSocket connected");
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const messages = event.data.split('\n');
        for (const msg of messages) {
          if (!msg.trim()) continue;
          
          const data = JSON.parse(msg);
          if (data.type === "NOTIFICATION") {
            const payload = data.payload;
            const newNotif: Notification = {
              actor: {
                username: payload.actorUsername || "System",
                image: (!payload.actorUsername || payload.actorUsername === "System") ? "/logo.png" : (payload.actorImage || null),
                role: (!payload.actorUsername || payload.actorUsername === "System") ? "admin" : (payload.actorRole || "user"),
              },
              actionText: payload.actionText || "",
              message: payload.message || "",
              postId: payload.postId,
              timestamp: new Date(),
              isRead: false,
            };

            setNotifications((prev) => [newNotif, ...prev]);
            setUnreadCount((prev) => prev + 1);

            const displayTitle = `${newNotif.actor?.username} ${newNotif.actionText}`;

            if (data.payload.type === "SYSTEM") {
              const isSystemUpgrade = newNotif.actionText === "Role Upgraded";
              const isProductPayment = newNotif.actionText === "Payment Successful";
              
              if (isSystemUpgrade) {
                queryClient.invalidateQueries({ queryKey: ["user"] });
                queryClient.invalidateQueries({ queryKey: ["feed"] });
              } else if (isProductPayment) {
                queryClient.invalidateQueries({ queryKey: ["purchases"] });
                queryClient.invalidateQueries({ queryKey: ["feed"] });
              }
            }
            
            const isSystemUpgrade = newNotif.actionText === "Role Upgraded";

            toast(displayTitle, {
              description: payload.message,
              style: isSystemUpgrade ? {
                background: "linear-gradient(to bottom right, #2a2105, #000000)",
                border: "1px solid #d4af37",
                color: "#f3e5ab",
                boxShadow: "0 0 20px rgba(212, 175, 55, 0.3)",
              } : undefined,
            });

            // Invalidate query to refetch feed when a post with media finishes uploading
            if (payload.actionText && payload.actionText.includes("uploading")) {
              queryClient.invalidateQueries({ queryKey: ["feed"] });
            }
          }
        }
      } catch (err) {
        console.error("Failed to parse websocket message", err);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
      setIsConnected(false);
      // Implement robust reconnection logic here if needed
    };

    return () => {
      ws.close();
    };
  }, [session?.user?.id]);

  const clearNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
  };
  
  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };
  
  const markAsRead = () => {
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    markAllNotificationsAsReadAction();
  };

  return (
    <WebSocketContext.Provider value={{ ws, isConnected, notifications, clearNotifications, deleteNotification, markAsRead, unreadCount }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
}
