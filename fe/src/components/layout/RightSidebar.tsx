"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getActiveAds } from "@/actions/ads.actions";
import { getRecentRoleBuyers } from "@/actions/roles.actions";
import { UserNameWithRole } from "@/components/ui/UserNameWithRole";
import { useSession } from "next-auth/react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, EffectFade } from "swiper/modules";
import "swiper/css";
import "swiper/css/effect-fade";
import { motion, AnimatePresence } from "framer-motion";

export function RightSidebar() {
  const { data: session } = useSession();
  const [ads, setAds] = useState<any[]>([]);
  const [buyers, setBuyers] = useState<any[]>([]);

  useEffect(() => {
    const fetchAds = () => getActiveAds().then(setAds).catch(console.error);
    const fetchBuyers = () => getRecentRoleBuyers().then(setBuyers).catch(console.error);
    
    // Initial fetch
    fetchAds();
    fetchBuyers();
    
    // Listen for WebSocket updates
    const handleUpdate = () => fetchBuyers();
    window.addEventListener('topLarpUpdate', handleUpdate);
    
    return () => {
      window.removeEventListener('topLarpUpdate', handleUpdate);
    };
  }, []);

  return (
    <aside className="hidden lg:flex flex-col w-80 sticky top-16 h-[calc(100vh-64px)] overflow-y-auto p-4 gap-4">
      <div className="bg-muted/50 rounded-xl p-4 flex flex-col">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold text-lg">Sponsored</h2>
          <Link href="/ads" className="text-xs text-primary hover:underline font-medium">Buy Ad Slot</Link>
        </div>
        
        {ads.length === 0 ? (
          <div className="flex flex-col item6justify-center p-6 border-2 border-dashed rounded-lg text-center gap-2">
            <span className="text-sm text-muted-foreground">No active ads right now.</span>
            <Link href="/ads" className="text-sm font-bold text-primary hover:underline">Be the first!</Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2 relative">
            <Swiper
              modules={[Autoplay, EffectFade]}
              effect="fade"
              fadeEffect={{ crossFade: true }}
              autoplay={{ delay: 5000, disableOnInteraction: false }}
              loop={ads.length > 1}
              className="w-full"
            >
              {ads.map((ad, index) => (
                <SwiperSlide key={ad.id || index}>
                  <div className="flex flex-col gap-2">
                    <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer" className="group flex flex-col gap-2 block">
                      <div className="aspect-video bg-muted rounded-lg overflow-hidden relative border">
                        {ad.imageUrl ? (
                          ad.mediaType === "video" ? (
                            <video src={ad.imageUrl} autoPlay muted loop className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          ) : (
                            <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          )
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">Ad Media</div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 group-hover:underline">{ad.title}</p>
                    </a>
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        )}
      </div>

      <div className="bg-muted/50 rounded-xl p-4">
        <h2 className="font-bold text-lg mb-4">Top Larp</h2>
        <div className="flex flex-col gap-4">
          {buyers.length === 0 ? (
            <p className="text-xs text-muted-foreground">No recent role upgrades yet.</p>
          ) : (
            <AnimatePresence mode="popLayout">
              {buyers.map((buyer) => (
                <motion.div 
                  key={buyer.username} 
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-3"
                >
                  <img 
                    src={buyer.image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${buyer.username}`} 
                    alt={buyer.username} 
                    className="w-10 h-10 rounded-full bg-background border object-cover" 
                  />
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center justify-between w-full">
                      <UserNameWithRole 
                        displayName={buyer.name || buyer.username}
                        role={buyer.role}
                        className="text-sm"
                      />
                      {buyer.totalSpend > 0 && (
                        <span className="text-xs font-bold text-green-500 whitespace-nowrap ml-2">
                          +${(buyer.totalSpend / 100).toFixed(2)}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground truncate max-w-[150px]">@{buyer.username}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </aside>
  );
}
