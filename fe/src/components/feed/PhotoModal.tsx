"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { PostWithRelations } from "@/store/usePostStore";
import { X, MessageCircle, Repeat2, Heart, BarChart2, Bookmark, Share, ChevronLeft, ChevronRight, Copy, ThumbsUp } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getCloudinaryUrl } from "@/lib/utils";
import { CommentFeed } from "@/components/comment/CommentFeed";
import { UserNameWithRole } from "@/components/ui/UserNameWithRole";
import { useState } from "react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { toggleLikeAction, toggleBookmarkAction } from "@/actions/post.actions";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function PhotoModal({ post, photoId }: { post: PostWithRelations, photoId: string }) {
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleDismiss = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      router.back();
    }
  };

  const currentIndex = post.media?.findIndex(m => m.id === photoId) ?? -1;
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex !== -1 && post.media && currentIndex < post.media.length - 1;

  const handlePrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasPrevious) {
      const prevId = post.media![currentIndex - 1].id;
      router.replace(`/${post.author.username || 'user'}/status/${post.id}/photo/${prevId}`, { scroll: false });
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasNext) {
      const nextId = post.media![currentIndex + 1].id;
      router.replace(`/${post.author.username || 'user'}/status/${post.id}/photo/${nextId}`, { scroll: false });
    }
  };

  const photoUrl = post.media?.find(m => m.id === photoId)?.url;

  if (!photoUrl) return null;

  const queryClient = useQueryClient();
  const { data: session } = useSession();
  
  const [isLiked, setIsLiked] = useState(post.hasLiked ?? false);
  const [likeCount, setLikeCount] = useState(post.stats?.likes ?? 0);
  const [isLiking, setIsLiking] = useState(false);

  const [isBookmarked, setIsBookmarked] = useState(post.hasBookmarked ?? false);
  const [isBookmarking, setIsBookmarking] = useState(false);

  const clickCountRef = useRef(0);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync state if post prop changes
  useEffect(() => {
    setIsLiked(post.hasLiked ?? false);
    setLikeCount(post.stats?.likes ?? 0);
    setIsBookmarked(post.hasBookmarked ?? false);
  }, [post]);

  const handleLike = () => {
    if (!session?.user) {
      toast.error("Please login to like posts");
      return;
    }

    const prevLiked = isLiked;
    const prevCount = Math.max(0, likeCount);

    setIsLiked(!prevLiked);
    setLikeCount(Math.max(0, prevCount + (prevLiked ? -1 : 1)));

    clickCountRef.current += 1;
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);

    debounceTimeoutRef.current = setTimeout(async () => {
      const clicks = clickCountRef.current;
      clickCountRef.current = 0;

      if (clicks % 2 !== 0) {
        setIsLiking(true);
        try {
          const result = await toggleLikeAction(post.id);
          if (result && typeof result.likeCount === 'number') {
            setIsLiked(result.isLiked || false);
            setLikeCount(Math.max(0, result.likeCount));
            queryClient.invalidateQueries({ queryKey: ['feed'] });
            router.refresh();
          }
        } catch (e) {
          setIsLiked(prevLiked);
          setLikeCount(prevCount);
          toast.error("Failed to like post");
        } finally {
          setIsLiking(false);
        }
      }
    }, 500);
  };

  const handleBookmark = async () => {
    if (!session?.user) {
      toast.error("Please login to bookmark posts");
      return;
    }
    if (isBookmarking) return;

    setIsBookmarking(true);
    const prevBookmarked = isBookmarked;
    setIsBookmarked(!prevBookmarked);

    try {
      const result = await toggleBookmarkAction(post.id);
      setIsBookmarked(result.bookmarked);
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      router.refresh();
      if (result.bookmarked) {
        toast.success("Post bookmarked!");
      } else {
        toast.success("Post removed from bookmarks.");
      }
    } catch (e) {
      setIsBookmarked(prevBookmarked);
      toast.error("Failed to bookmark post");
    } finally {
      setIsBookmarking(false);
    }
  };

  const handleShare = () => {
    setShowShareDialog(true);
  };

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/${post.author.username || 'user'}/status/${post.id}/photo/${photoId}` : '';

  const copyToClipboard = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied to clipboard!");
      setShowShareDialog(false);
    }
  };

  return (
    <div 
      ref={overlayRef}
      onClick={handleDismiss}
      className="fixed inset-0 z-50 flex bg-black/90 backdrop-blur-sm"
    >
      {/* Close Button */}
      <button 
        onClick={() => router.back()}
        className="absolute top-4 left-4 z-50 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
      >
        <X size={20} />
      </button>

      {/* Left side: Photo */}
      <div className="flex-1 relative flex items-center justify-center p-4 lg:p-12 pointer-events-none group">
        
        {hasPrevious && (
          <button 
            onClick={handlePrevious}
            className="absolute left-4 lg:left-8 z-50 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors pointer-events-auto opacity-0 group-hover:opacity-100"
          >
            <ChevronLeft size={24} />
          </button>
        )}

        <div className="relative w-full h-full max-h-screen pointer-events-auto flex items-center justify-center">
          <Image 
            src={getCloudinaryUrl(photoUrl, "f_auto,q_auto,w_1920,c_limit")} 
            alt="Post image" 
            fill 
            className="object-contain"
            priority
          />
        </div>

        {hasNext && (
          <button 
            onClick={handleNext}
            className="absolute right-4 lg:right-8 z-50 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors pointer-events-auto opacity-0 group-hover:opacity-100"
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>

      {/* Right side: Sidebar (Post details) */}
      <div className="w-full max-w-sm bg-background border-l flex flex-col overflow-y-auto hidden md:flex h-full pointer-events-auto">
        <div className="p-4 border-b">
           {/* Post details here... similar to PostCard but vertical */}
           <div className="flex items-center gap-3">
             <Avatar className="w-10 h-10">
               <AvatarImage src={post.author.image ?? ""} alt={post.author.name ?? ""} />
               <AvatarFallback>{post.author.name?.charAt(0)}</AvatarFallback>
             </Avatar>
             <div>
               <div className="flex items-center gap-1">
                 <UserNameWithRole displayName={post.author.name || ""} role={post.author.role} className="mb-0 text-sm" />
                 {post.author.isVerified && <span className="text-primary text-[10px] bg-primary/10 rounded-full w-4 h-4 flex items-center justify-center">✓</span>}
               </div>
               <div className="text-sm text-muted-foreground">@{post.author.username}</div>
             </div>
           </div>
           
           <div className="mt-3 text-[15px] whitespace-pre-wrap break-words pr-8">
             {post.content}
           </div>

           <div className="mt-3 text-sm text-muted-foreground">
             {post.createdAt ? new Date(post.createdAt).toLocaleDateString("en-US", { hour: 'numeric', minute: 'numeric', month: "short", day: "numeric", year: "numeric" }) : ""}
           </div>

           <div className="flex justify-between items-center mt-4 pt-4 border-t text-muted-foreground">
             <button 
               onClick={handleLike}
               className="flex-1 flex justify-center items-center gap-2 py-1.5 hover:bg-muted/50 rounded-md transition-colors text-[13px] font-medium"
             >
               <ThumbsUp 
                 size={18} 
                 className={isLiked ? "fill-red-500 text-red-500" : ""} 
               />
               <span className={isLiked ? "text-red-500" : ""}>{Math.max(0, likeCount) || "Like"}</span>
             </button>
             
             <button 
               onClick={() => {
                  const input = document.querySelector('input[name="content"], textarea[name="content"]') as HTMLInputElement | null;
                  if (input) input.focus();
               }}
               className="flex-1 flex justify-center items-center gap-2 py-1.5 hover:bg-muted/50 rounded-md transition-colors text-[13px] font-medium"
             >
               <MessageCircle size={18} />
               <span>{post.stats?.replies || "Comment"}</span>
             </button>

             <button 
               onClick={handleBookmark}
               className="flex-1 flex justify-center items-center gap-2 py-1.5 hover:bg-muted/50 rounded-md transition-colors text-[13px] font-medium"
             >
               <Bookmark 
                 size={18} 
                 className={isBookmarked ? "fill-primary text-primary" : ""} 
               />
               <span className={isBookmarked ? "text-primary" : ""}>Bookmark</span>
             </button>

             <div className="flex-1 flex justify-center items-center gap-2 py-1.5 text-[13px] font-medium cursor-default">
               <BarChart2 size={18} />
               <span>{post.stats?.views || 0}</span>
             </div>

             <button 
               onClick={handleShare}
               className="flex-1 flex justify-center items-center gap-2 py-1.5 hover:bg-muted/50 rounded-md transition-colors text-[13px] font-medium"
             >
               <Share size={18} />
               <span>Share</span>
             </button>
           </div>
        </div>
        
        {/* Comments Section */}
        <div className="flex-1 overflow-y-auto">
          <CommentFeed postId={post.id} />
        </div>
      </div>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share Photo</DialogTitle>
            <DialogDescription>
              Anyone with this link will be able to view this photo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2 mt-4">
            <div className="grid flex-1 gap-2">
              <Input
                readOnly
                value={shareUrl}
                className="w-full text-sm text-muted-foreground"
              />
            </div>
            <Button size="icon" onClick={copyToClipboard} className="px-3 shrink-0">
              <span className="sr-only">Copy</span>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
