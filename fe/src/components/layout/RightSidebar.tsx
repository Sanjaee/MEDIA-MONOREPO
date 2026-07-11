"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getActiveAds } from "@/actions/ads.actions";
import { useSession } from "next-auth/react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, EffectFade } from "swiper/modules";
import "swiper/css";
import "swiper/css/effect-fade";

export function RightSidebar() {
  const { data: session } = useSession();
  const [ads, setAds] = useState<any[]>([]);

  useEffect(() => {
    getActiveAds().then(setAds).catch(console.error);
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
        <h2 className="font-bold text-xl mb-4">What's happening</h2>
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Trending in Indonesia</p>
            <p className="font-bold">React Next.js</p>
            <p className="text-xs text-muted-foreground">10.5K posts</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Trending in Indonesia</p>
            <p className="font-bold">Tailwind CSS</p>
            <p className="text-xs text-muted-foreground">5,234 posts</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
