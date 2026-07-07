"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useSession } from "next-auth/react";
import { getUnreadCountAction } from "@/actions/chat.actions";

interface ChatContextType {
  unreadCount: number;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  refreshUnreadCount: () => Promise<void>;
  ws: WebSocket | null;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const [ws, setWs] = useState<WebSocket | null>(null);

  const refreshUnreadCount = async () => {
    if (!session?.user?.id) return;
    try {
      const count = await getUnreadCountAction(session.user.id as string);
      setUnreadCount(count);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (session?.user?.id) {
      refreshUnreadCount();

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/ws?userId=${session.user.id}`;
      
      const socket = new WebSocket(wsUrl);
      
      socket.onopen = () => console.log("Global WS connected");
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "new_message") {
            const msg = typeof data.payload === "string" ? JSON.parse(data.payload) : data.payload;
            // Only increment if we are not the sender
            if (msg.senderId !== session.user?.id) {
               setUnreadCount(prev => prev + 1);
            }
          }
        } catch (err) {
          console.error("Failed to parse WS message", err);
        }
      };
      
      setWs(socket);

      return () => {
        socket.close();
      };
    }
  }, [session?.user?.id]);

  return (
    <ChatContext.Provider value={{ unreadCount, setUnreadCount, refreshUnreadCount, ws }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
}
