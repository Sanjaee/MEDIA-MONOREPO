"use client";

import { useState, useEffect, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Search, Edit, MoreHorizontal, Image as ImageIcon, Smile, Send } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getConversationsAction, getMessagesAction, createConversationAction, markConversationAsReadAction } from "@/actions/chat.actions";
import { searchUsersAction } from "@/actions/user.actions";
import { getCloudinaryUrl } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useVirtualizer } from '@tanstack/react-virtual';
import React, { useRef } from "react";
import { useChatContext } from "@/context/ChatContext";

function MessagesContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const userIdParam = searchParams.get('userId');
  
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversation, setActiveConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  
  const { ws, refreshUnreadCount } = useChatContext();

  // New Chat Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const searchParentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: searchResults.length,
    getScrollElement: () => searchParentRef.current,
    estimateSize: () => 64, // approximate height of user row
  });

  // Debounce search
  useEffect(() => {
    if (!isSearchOpen) return;
    
    const timer = setTimeout(() => {
      if (searchQuery.trim().length > 0) {
        setIsSearching(true);
        searchUsersAction(searchQuery).then(results => {
          setSearchResults(results);
          setIsSearching(false);
        });
      } else {
        setSearchResults([]);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery, isSearchOpen]);

  const handleStartNewChat = (user: any) => {
    // Check if conversation already exists in our list
    const existingConv = conversations.find(c => c.user1Id === user.id || c.user2Id === user.id);
    
    if (existingConv) {
      setActiveConversation(existingConv);
    } else {
      // Create a "draft" conversation
      setActiveConversation({
        id: `draft_${user.id}`, // Temporary ID
        user1Id: session?.user?.id,
        user2Id: user.id,
        user1: session?.user,
        user2: user,
        messages: [],
        isDraft: true
      });
    }
    
    setIsSearchOpen(false);
    setSearchQuery("");
  };

  // Fetch conversations on load
  useEffect(() => {
    if (session?.user?.id) {
      getConversationsAction(session.user.id).then(data => {
        setConversations(data);
        
        // Handle userId param
        if (userIdParam) {
          const existingConv = data.find((c: any) => c.user1Id === userIdParam || c.user2Id === userIdParam);
          if (existingConv) {
            setActiveConversation(existingConv);
          } else {
            // Need to create conversation
            createConversationAction(session!.user!.id as string, userIdParam).then(newConv => {
              if (newConv) {
                setConversations(prev => [newConv, ...prev]);
                setActiveConversation(newConv);
              }
            });
          }
        }
      });
    }
  }, [session?.user, userIdParam]);

  // Fetch messages when active conversation changes
  useEffect(() => {
    if (activeConversation && !activeConversation.isDraft) {
      getMessagesAction(activeConversation.id).then(data => {
        // Reverse because API returns descending by default
        setMessages(data.reverse());
      });
      
      // Mark conversation as read
      if (session?.user?.id) {
        markConversationAsReadAction(activeConversation.id, session.user.id as string).then(success => {
          if (success) {
            refreshUnreadCount();
          }
        });
      }
    } else if (activeConversation?.isDraft) {
      setMessages([]);
    }
  }, [activeConversation, session?.user?.id]);

  // Remove local ws connection as it's now handled by ChatContext globally
  useEffect(() => {
    if (!ws) return;
    
    // We can add a local listener to the global WS if needed, 
    // but React doesn't let us easily add multiple onmessage listeners.
    // Instead, we can just intercept or rely on a global state.
    // A better approach is to wrap this in an event emitter, but for now we'll overwrite it.
    
    const originalOnMessage = ws.onmessage;
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "new_message") {
          const msg = typeof data.payload === "string" ? JSON.parse(data.payload) : data.payload;
          
          // If the message belongs to our active conversation, add it to the view
          if (activeConversation && (activeConversation.id === msg.conversationId || msg.senderId === activeConversation.user1Id || msg.senderId === activeConversation.user2Id)) {
            setMessages(prev => {
              if (prev.find(m => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            
            // Mark as read immediately if it's the active conversation
            if (session?.user?.id && msg.senderId !== session.user.id) {
              // Add small delay to let backend save the message first
              setTimeout(() => {
                markConversationAsReadAction(msg.conversationId, session.user!.id as string).then(() => {
                  refreshUnreadCount();
                });
              }, 500);
            }
          }
        }
      } catch (err) {
        console.error("Failed to parse WS message", err);
      }
      
      // Call original if it exists
      if (originalOnMessage) {
        originalOnMessage.call(ws, event);
      }
    };
    
    return () => {
      ws.onmessage = originalOnMessage;
    };
  }, [ws, activeConversation, session?.user?.id]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !ws || !activeConversation) return;

    // Determine receiver ID
    const receiverId = activeConversation.user1Id === session?.user?.id 
      ? activeConversation.user2Id 
      : activeConversation.user1Id;

    const payload = {
      type: "chat_message",
      payload: {
        receiverId,
        content: newMessage
      }
    };

    if (activeConversation.isDraft) {
      // Need to create it on the backend first
      createConversationAction(session!.user!.id as string, receiverId).then(newConv => {
        if (newConv) {
          // Replace draft with real conv
          setConversations(prev => [newConv, ...prev]);
          setActiveConversation(newConv);
          
          // Send the message
          ws.send(JSON.stringify(payload));
          setNewMessage("");
        }
      });
    } else {
      ws.send(JSON.stringify(payload));
      setNewMessage("");
    }
  };

  if (!session?.user) return <div className="p-4 text-center">Loading...</div>;

  return (
    <>
      <div className="flex h-[calc(100vh-56px)] w-full bg-black text-white overflow-hidden border-x border-gray-800">
        {/* Left Sidebar - Chat List */}
        <div className="w-[350px] border-r border-gray-800 flex flex-col shrink-0">
          <div className="p-4 flex items-center justify-between">
            <h1 className="text-xl font-bold">Chat</h1>
            <div className="flex gap-2">
              <button 
                onClick={() => setIsSearchOpen(true)}
                className="w-8 h-8 rounded-full hover:bg-gray-800 flex items-center justify-center transition"
              >
                <Edit className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="px-4 pb-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input 
                type="text" 
                placeholder="Search" 
                className="w-full bg-gray-900 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                No conversations yet.
              </div>
            ) : (
              conversations.map(conv => {
                if (conv.isDraft) return null; // Don't show drafts in the list

                // Determine the other user
                const otherUser = conv.user1Id === session?.user?.id ? conv.user2 : conv.user1;
                const lastMessage = conv.messages?.[0];
                
                return (
                  <div 
                    key={conv.id} 
                    className={`flex items-center gap-3 p-4 cursor-pointer transition border-b border-gray-800/50 ${activeConversation?.id === conv.id ? 'bg-gray-900 border-r-2 border-r-primary' : 'hover:bg-gray-900/50'}`}
                    onClick={() => setActiveConversation(conv)}
                  >
                    <div className="w-12 h-12 rounded-full bg-gray-800 shrink-0 overflow-hidden relative">
                      {otherUser?.image ? (
                        <Image src={getCloudinaryUrl(otherUser.image, "")} alt={otherUser.name || "User"} fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold">{otherUser?.name?.charAt(0)}</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold truncate">{otherUser?.name || "User"}</span>
                        {lastMessage && (
                          <span className="text-xs text-gray-500">
                            {new Date(lastMessage.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 truncate">{lastMessage?.content || "No messages yet"}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane - Chat Window */}
        <div className="flex-1 flex flex-col min-w-0">
          {!activeConversation ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="w-16 h-16 rounded-full bg-gray-900 flex items-center justify-center mb-4">
                <span className="text-2xl">💬</span>
              </div>
              <h2 className="text-2xl font-bold mb-2">Start Conversation</h2>
              <p className="text-gray-500 mb-6">Choose from your existing conversations, or start a new one.</p>
              <button 
                onClick={() => setIsSearchOpen(true)}
                className="bg-white text-black px-6 py-2 rounded-full font-bold hover:bg-gray-200 transition"
              >
                New chat
              </button>
            </div>
          ) : (
            (() => {
              const otherUser = activeConversation.user1Id === session?.user?.id ? activeConversation.user2 : activeConversation.user1;
              return (
                <>
                  {/* Chat Header */}
                  <div className="h-[60px] border-b border-gray-800 flex items-center justify-between px-4 shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-800 overflow-hidden relative">
                        {otherUser?.image ? (
                          <Image src={getCloudinaryUrl(otherUser.image, "")} alt={otherUser.name || "User"} fill className="object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-bold text-sm">{otherUser?.name?.charAt(0)}</div>
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm">{otherUser?.name || "User"}</h3>
                      </div>
                    </div>
                    <button className="w-8 h-8 rounded-full hover:bg-gray-800 flex items-center justify-center transition">
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Messages Area */}
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                     {/* User Profile Summary inside chat */}
                     <div className="flex flex-col items-center justify-center py-8 border-b border-gray-800 mb-4">
                       <div className="w-20 h-20 rounded-full bg-gray-800 mb-2 relative overflow-hidden">
                         {otherUser?.image ? (
                           <Image src={getCloudinaryUrl(otherUser.image, "")} alt={otherUser.name || "User"} fill className="object-cover" />
                         ) : (
                           <div className="w-full h-full flex items-center justify-center font-bold text-2xl">{otherUser?.name?.charAt(0)}</div>
                         )}
                       </div>
                       <h2 className="font-bold text-lg">{otherUser?.name || "User"}</h2>
                       <p className="text-gray-500">@{otherUser?.username || "user"}</p>
                       <Link href={`/${otherUser?.username || "user"}`} className="mt-4 bg-white text-black px-4 py-1.5 rounded-full font-bold text-sm hover:bg-gray-200 transition">
                         View Profile
                       </Link>
                     </div>

                     {/* Messages */}
                     {messages.map((msg, i) => {
                       const isMe = msg.senderId === session?.user?.id;
                       return (
                         <div key={msg.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                           <div className={`max-w-[70%] px-4 py-2 rounded-2xl ${isMe ? 'bg-[#1d9bf0] text-white rounded-br-sm' : 'bg-gray-800 text-white rounded-bl-sm'}`}>
                             <p>{msg.content}</p>
                             <span className="text-[10px] opacity-70 mt-1 block text-right">
                               {new Date(msg.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                             </span>
                           </div>
                         </div>
                       );
                     })}
                  </div>

                  {/* Input Area */}
                  <div className="p-4 border-t border-gray-800 shrink-0">
                    <form onSubmit={handleSendMessage} className="bg-gray-900 rounded-2xl flex items-center p-2">
                      <button type="button" className="p-2 text-primary hover:bg-gray-800 rounded-full transition">
                        <ImageIcon className="w-5 h-5" />
                      </button>
                      <button type="button" className="p-2 text-primary hover:bg-gray-800 rounded-full transition">
                        <Smile className="w-5 h-5" />
                      </button>
                      <input 
                        type="text" 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Start a new message" 
                        className="flex-1 bg-transparent border-none focus:outline-none px-2 text-white"
                      />
                      <button 
                        type="submit" 
                        disabled={!newMessage.trim()}
                        className="p-2 text-primary hover:bg-gray-800 rounded-full transition disabled:opacity-50"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </form>
                  </div>
                </>
              );
            })()
          )}
        </div>
      </div>
      
      {/* New Chat Search Dialog */}
      <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <DialogContent className="sm:max-w-md bg-black text-white border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">New message</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col h-[400px]">
            <div className="relative border-b border-gray-800 pb-2 mb-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
              <input 
                type="text" 
                placeholder="Search people" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-0 text-white"
                autoFocus
              />
            </div>
            
            <div 
              ref={searchParentRef}
              className="flex-1 overflow-y-auto"
            >
              {isSearching ? (
                <div className="p-4 text-center text-sm text-gray-500">Searching...</div>
              ) : searchResults.length > 0 ? (
                <div
                  style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {virtualizer.getVirtualItems().map((virtualItem) => {
                    const user = searchResults[virtualItem.index];
                    return (
                      <div
                        key={virtualItem.key}
                        onClick={() => handleStartNewChat(user)}
                        className="absolute top-0 left-0 w-full flex items-center gap-3 p-3 hover:bg-gray-900 cursor-pointer transition rounded-xl"
                        style={{
                          height: `${virtualItem.size}px`,
                          transform: `translateY(${virtualItem.start}px)`,
                        }}
                      >
                        <div className="w-10 h-10 rounded-full bg-gray-800 overflow-hidden relative shrink-0">
                          {user.image ? (
                            <Image src={getCloudinaryUrl(user.image, "")} alt={user.name || "User"} fill className="object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-bold text-sm">{user.name?.charAt(0)}</div>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-sm truncate">{user.name}</span>
                          <span className="text-gray-500 text-sm truncate">@{user.username}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : searchQuery.trim().length > 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">No users found.</div>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading chat...</div>}>
      <MessagesContent />
    </Suspense>
  );
}
