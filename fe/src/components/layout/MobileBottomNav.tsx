"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, TrendingUp, Newspaper, User, Mail, Plus } from "lucide-react";
import { useSession } from "next-auth/react";
import { useChatContext } from "@/context/ChatContext";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CreatePost } from "@/components/feed/CreatePost";
import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MobileBottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { unreadCount } = useChatContext();
  const [open, setOpen] = useState(false);

  const mainRoutes = ["/", "/trending", "/search", "/notifications", "/settings", "/bookmarks", "/news", "/messages", "/premium"];
  const isPostDetail = pathname?.includes("/status/");
  const showNav = mainRoutes.includes(pathname || "") || isPostDetail || pathname?.startsWith("/@") || (pathname && pathname.length > 1 && !pathname.includes("/"));

  // Hide on pages that don't need it or admin pages
  if (pathname?.startsWith("/admin") || pathname?.startsWith("/payment")) {
    return null;
  }

  if (!showNav) return null;

  return (
    <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-t border-gray-800 safe-area-bottom">
      <nav className="flex justify-around items-center h-16 px-2">
        <Link 
          href="/" 
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${pathname === "/" ? "text-white" : "text-gray-500 hover:text-gray-300"}`}
        >
          <Home className="w-6 h-6" />
        </Link>
        <Link 
          href="/trending" 
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${pathname === "/trending" ? "text-white" : "text-gray-500 hover:text-gray-300"}`}
        >
          <TrendingUp className="w-6 h-6" />
        </Link>
        <Link 
          href="/news" 
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${pathname === "/news" ? "text-white" : "text-gray-500 hover:text-gray-300"}`}
        >
          <Newspaper className="w-6 h-6" />
        </Link>
        <Link 
          href="/messages" 
          className={`relative flex flex-col items-center justify-center w-full h-full space-y-1 ${pathname === "/messages" ? "text-white" : "text-gray-500 hover:text-gray-300"}`}
        >
          <div className="relative">
            <Mail className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        </Link>
        <Link 
          href="/premium" 
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${pathname === "/premium" ? "text-white" : "text-gray-500 hover:text-gray-300"}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /><path d="M5 3v4" /><path d="M19 17v4" /><path d="M3 5h4" /><path d="M17 19h4" /></svg>
        </Link>
        <Dialog open={open} onOpenChange={(isOpen) => {
          if (isOpen) setOpen(true);
        }}>
          <DialogTrigger render={<button className="flex flex-col items-center justify-center w-full h-full space-y-1 focus:outline-none" />}>
            <div className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center">
              <Plus className="w-6 h-6" />
            </div>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-background border-border" showCloseButton={false}>
            <DialogTitle className="sr-only">Create Post</DialogTitle>
            <DialogDescription className="sr-only">Create a new post</DialogDescription>
            <div className="flex justify-between items-center p-2 border-b">
              <button onClick={() => setOpen(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
                <X size={20} />
              </button>
              <Button variant="ghost" className="text-blue-500 font-semibold hover:bg-blue-500/10 hover:text-blue-600">Drafts</Button>
            </div>
            <div>
              <CreatePost onSuccess={() => setOpen(false)} />
            </div>
          </DialogContent>
        </Dialog>
      </nav>
    </div>
  );
}
