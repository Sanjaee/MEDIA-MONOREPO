"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getActiveAds } from "@/actions/ads.actions";
import { UserNameWithRole } from "@/components/ui/UserNameWithRole";
import { getTopLarp } from "@/actions/user.actions";
import { useSession } from "next-auth/react";
import EmblaCarousel from "@/components/ui/embla/EmblaCarousel";
import { motion, AnimatePresence } from "framer-motion";

export function RightSidebar() {
  const { data: session } = useSession();
  const [ads, setAds] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    const fetchAds = () => getActiveAds().then(setAds).catch(console.error);
    const fetchTopLarp = async () => {
      try {
        const data = await getTopLarp();
        setUsers(data || []);
      } catch (err) {
        console.error(err);
      }
    };
    
    // Initial fetch
    fetchAds();
    fetchTopLarp();
    
    // Listen for WebSocket updates
    const handleUpdate = () => fetchTopLarp();
    window.addEventListener('topLarpUpdate', handleUpdate);
    
    return () => {
      window.removeEventListener('topLarpUpdate', handleUpdate);
    };
  }, []);

  return (
    <aside className="hidden lg:flex flex-col w-80 sticky top-16 h-[calc(100vh-64px)] overflow-y-auto p-4 gap-4">
      <div className="flex flex-col">
        {ads.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg text-center gap-2">
            <span className="text-sm text-muted-foreground">No active ads right now.</span>
            <Link href="/products/monetization?tab=ads" className="text-sm font-bold text-primary hover:underline">Be the first!</Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2 relative">
            <EmblaCarousel slides={ads} options={{ loop: true }} />
          </div>
        )}
      </div>

      <div className="bg-muted/50 rounded-xl p-4">
        <h2 className="font-bold text-lg mb-4">Top Larp</h2>
        
        <div className="flex flex-col gap-4">
          {users.length === 0 ? (
            <p className="text-xs text-muted-foreground">No data available yet.</p>
          ) : (
            <AnimatePresence mode="popLayout">
              {users.map((user) => (
                <Link href={`/${user.username}`} key={user.username} className="block group">
                  <motion.div 
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    <img 
                      src={user.image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} 
                      alt={user.username} 
                      className="w-10 h-10 rounded-full bg-background border object-cover" 
                    />
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center justify-between w-full">
                        <UserNameWithRole 
                          displayName={user.name || user.username}
                          role={user.role}
                          className="text-sm"
                        />
                        {user.total_amount > 0 && (
                          <span className="text-xs font-bold text-green-500 whitespace-nowrap ml-2">
                            +${(user.total_amount / 100).toFixed(2)}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground truncate max-w-[150px]">@{user.username}</span>
                    </div>
                  </motion.div>
                </Link>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </aside>
  );
}
