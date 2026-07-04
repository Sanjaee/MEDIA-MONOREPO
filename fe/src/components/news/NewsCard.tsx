"use client";

import Image from "next/image";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserNameWithRole } from "@/components/ui/UserNameWithRole";
import { getCloudinaryUrl } from "@/lib/utils";

export function NewsCard({ post, priority = false }: { post: any, priority?: boolean }) {
  return (
    <article className="border-b px-4 py-3 hover:bg-muted/30 transition-colors flex flex-col relative">
      {/* Header Row */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex gap-2 text-sm">
          {/* Avatar (Static/Fallback for custom news authors) */}
          <div className="shrink-0">
            <Avatar className="w-10 h-10">
              <AvatarFallback>{post.author.username?.charAt(0) || "N"}</AvatarFallback>
            </Avatar>
          </div>

          {/* Name & Meta */}
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-1">
              <div className="truncate">
                <UserNameWithRole displayName={post.author.username || ""} role={post.author.role?.toLowerCase() || "admin"} className="mb-0 text-sm" />
              </div>
              <span className="text-primary text-[10px] bg-primary/10 rounded-full w-4 h-4 flex items-center justify-center">
                ✓
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground whitespace-nowrap text-xs">
                {post.createdAt ? new Date(post.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
              </span>
            </div>
            <div className="text-muted-foreground truncate text-sm">
              @{post.author.username?.toLowerCase().replace(/\s+/g, '') || "news"}
            </div>
          </div>
        </div>
      </div>

      {/* Content wrapper */}
      <div className="flex flex-col min-w-0">
        {/* Body Text */}
        <div className="text-[15px] whitespace-pre-wrap break-words mb-1">
          {post.content}
        </div>

        {/* Media */}
        {post.media && post.media.length > 0 && (
          <div className={`mt-3 rounded-2xl overflow-hidden border ${
            post.media.length === 1 ? 'flex justify-center bg-black/5 dark:bg-white/5' : 'grid grid-cols-2 gap-0.5 bg-muted'
          }`}>
            {post.media.map((media: any) => {
              const isVideo = media.type === 'video';
              const mediaContent = (
                <div className={`relative flex justify-center items-center w-full ${post.media.length > 1 ? 'aspect-square sm:aspect-[4/3]' : ''}`}>
                  {isVideo ? (
                    <video
                      src={media.url}
                      controls
                      playsInline
                      className={post.media.length === 1 ? 'max-w-full max-h-[80vh] object-contain' : 'w-full h-full absolute inset-0 object-cover bg-black'}
                      poster={media.thumbnailUrl || undefined}
                    />
                  ) : post.media.length === 1 ? (
                    <Image 
                      src={media.url.includes("res.cloudinary.com") ? getCloudinaryUrl(media.url, "f_auto,q_auto,w_1200,c_limit") : media.url} 
                      alt="News media" 
                      width={media.width || 1200}
                      height={media.height || 800}
                      className="max-w-full w-auto h-auto max-h-[80vh] object-contain"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 70vw, 800px"
                      priority={priority}
                    />
                  ) : (
                    <Image 
                      src={media.url.includes("res.cloudinary.com") ? getCloudinaryUrl(media.url, "f_auto,q_auto,w_800,c_limit") : media.url} 
                      alt="News media" 
                      fill
                      sizes="(max-width: 768px) 50vw, (max-width: 1200px) 30vw, 400px"
                      className="object-cover"
                      priority={priority}
                    />
                  )}
                </div>
              );

              return isVideo ? (
                <div key={media.id} className="block relative">
                  {mediaContent}
                </div>
              ) : (
                <div key={media.id} className="block relative">
                  {mediaContent}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </article>
  );
}
