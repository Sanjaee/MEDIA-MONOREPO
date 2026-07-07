"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getNotificationsAction, markAllNotificationsAsReadAction } from "@/actions/notification.actions";

type Notification = {
  id?: string;
  title: string;
  message: string;
  postId?: string;
  timestamp: Date;
  isRead?: boolean;
};

interface WebSocketContextType {
  isConnected: boolean;
  notifications: Notification[];
  clearNotifications: () => void;
  markAsRead: () => void;
  unreadCount: number;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) {
      return;
    }

    // Fetch initial notifications
    getNotificationsAction().then((data) => {
      if (data && data.length > 0) {
        const mapped = data.map((n: any) => ({
          id: n.id,
          title: n.type === "LIKE" ? "New Like" : n.type === "COMMENT" ? "New Comment" : "Notification",
          message: n.message || (n.type === "LIKE" ? "Someone liked your post" : ""),
          postId: n.entityId,
          timestamp: new Date(n.createdAt),
          isRead: n.isRead,
        }));
        setNotifications(mapped);
        setUnreadCount(mapped.filter((n: any) => !n.isRead).length);
      }
    });

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
              title: payload.title,
              message: payload.message,
              postId: payload.postId,
              timestamp: new Date(),
              isRead: false,
            };

            setNotifications((prev) => [newNotif, ...prev]);
            setUnreadCount((prev) => prev + 1);

            toast(payload.title, {
              description: payload.message,
            });

            // Invalidate query to refetch feed when a post with media finishes uploading
            if (payload.title === "Post Uploaded") {
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
  }, [session, status]);

  const clearNotifications = () => setNotifications([]);
  const markAsRead = () => {
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    markAllNotificationsAsReadAction();
  };

  return (
    <WebSocketContext.Provider value={{ isConnected, notifications, clearNotifications, markAsRead, unreadCount }}>
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
