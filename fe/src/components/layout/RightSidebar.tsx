"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getActiveAds } from "@/actions/ads.actions";

export function RightSidebar() {
  const [ads, setAds] = useState<any[]>([]);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);

  useEffect(() => {
    getActiveAds().then(setAds).catch(console.error);
  }, []);

  useEffect(() => {
    if (ads.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentAdIndex((prev) => (prev + 1) % ads.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [ads.length]);

  const currentAd = ads[currentAdIndex];

  return (
    <aside className="hidden lg:flex flex-col w-80 sticky top-16 h-[calc(100vh-64px)] overflow-y-auto p-4 gap-4">
      <div className="bg-muted/50 rounded-xl p-4 flex flex-col">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold text-lg">Sponsored</h2>
          <Link href="/ads" className="text-xs text-primary hover:underline font-medium">Buy Ad Slot</Link>
        </div>
        
        {ads.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg text-center gap-2">
            <span className="text-sm text-muted-foreground">No active ads right now.</span>
            <Link href="/ads" className="text-sm font-bold text-primary hover:underline">Be the first!</Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2 relative">
            <a href={currentAd.linkUrl} target="_blank" rel="noopener noreferrer" className="group flex flex-col gap-2 block">
              <div className="aspect-video bg-muted rounded-lg overflow-hidden relative border">
                {currentAd.imageUrl ? (
                  <img src={currentAd.imageUrl} alt={currentAd.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">Ad Media</div>
                )}
              </div>
              <p className="font-bold text-sm leading-tight group-hover:underline">{currentAd.title}</p>
              {currentAd.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{currentAd.description}</p>
              )}
            </a>
            
            {ads.length > 1 && (
              <div className="flex justify-center gap-1 mt-2">
                {ads.map((_, i) => (
                  <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === currentAdIndex ? 'w-4 bg-primary' : 'w-1.5 bg-muted-foreground/30'}`} />
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-2 text-right">Sponsored by {currentAd.authorName}</p>
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
