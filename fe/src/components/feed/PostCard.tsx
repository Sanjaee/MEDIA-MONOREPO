"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, Bookmark, Share, Trash2, MoreHorizontal, Edit, UserPlus, Ban, Flag, ThumbsUp, Copy, BarChart2 } from "lucide-react";
import { useInView } from "react-intersection-observer";
import { PostWithRelations, usePostStore } from "@/store/usePostStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getCloudinaryUrl } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { deletePostAction, toggleLikeAction, toggleBookmarkAction } from "@/actions/post.actions";
import { useState, useEffect, useRef } from "react";
import { CommentForm } from "@/components/comment/CommentForm";
import { CommentFeed } from "@/components/comment/CommentFeed";
import { UserNameWithRole } from "@/components/ui/UserNameWithRole";
import { toast } from "sonner";

export function PostCard({ post: initialPost, priority = false }: { post: PostWithRelations, priority?: boolean }) {
  const router = useRouter();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const deletePost = usePostStore(state => state.deletePost);
  const [post, setPost] = useState(initialPost);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

  const [isLiked, setIsLiked] = useState(post.hasLiked ?? false);
  const [likeCount, setLikeCount] = useState(post.stats?.likes ?? 0);
  const [isLiking, setIsLiking] = useState(false);

  const [isBookmarked, setIsBookmarked] = useState(post.hasBookmarked ?? false);
  const [isBookmarking, setIsBookmarking] = useState(false);

  // Sync local state if parent passes new props (e.g. from background refetch)
  useEffect(() => {
    setIsLiked(initialPost.hasLiked ?? false);
    setLikeCount(initialPost.stats?.likes ?? 0);
    setIsBookmarked(initialPost.hasBookmarked ?? false);
    setPost(initialPost);
  }, [initialPost]);

  const clickCountRef = useRef(0);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { ref, inView } = useInView({
    threshold: 0.5,
    triggerOnce: true,
  });

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (inView && session?.user && session.user.id !== post.author.id) {
      timeout = setTimeout(() => {
        fetch('/api/posts/view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postId: post.id })
        }).catch(console.error);
      }, 3000);
    }
    return () => clearTimeout(timeout);
  }, [inView, session?.user, post.id, post.author.id]);

  const handleLike = () => {
    if (!session?.user) {
      toast.error("Please login to like posts");
      return;
    }

    const prevLiked = isLiked;
    const prevCount = Math.max(0, likeCount);

    // Optimistic UI updates instantly
    setIsLiked(!prevLiked);
    setLikeCount(Math.max(0, prevCount + (prevLiked ? -1 : 1)));

    // Track clicks for debounce (Anti-Spam)
    clickCountRef.current += 1;

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(async () => {
      const clicks = clickCountRef.current;
      clickCountRef.current = 0; // reset for next batch

      // Only send to backend if there's a net change (odd number of clicks)
      if (clicks % 2 !== 0) {
        setIsLiking(true);
        try {
          const result = await toggleLikeAction(post.id);
          // Sync with real exact data from backend
          if (result && typeof result.likeCount === 'number') {
            setIsLiked(result.isLiked || false);
            setLikeCount(Math.max(0, result.likeCount));
            
            // Sync React Query Feed Cache globally
            queryClient.setQueryData(['feed'], (oldData: any) => {
              if (!oldData || !oldData.pages) return oldData;
              return {
                ...oldData,
                pages: oldData.pages.map((page: any) => ({
                  ...page,
                  posts: page.posts.map((p: any) => {
                    if (p.id === post.id) {
                      return {
                        ...p,
                        hasLiked: result.isLiked,
                        stats: { ...p.stats, likes: result.likeCount }
                      };
                    }
                    return p;
                  })
                }))
              };
            });
            
            // Force Next.js to invalidate Server Components (Detail Page)
            router.refresh();
          }
        } catch (e) {
          // Revert to known previous state on error
          setIsLiked(prevLiked);
          setLikeCount(prevCount);
          toast.error("Failed to like post");
        } finally {
          setIsLiking(false);
        }
      }
    }, 500); // 500ms debounce
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
      
      // Sync React Query Cache for Bookmarks too
      queryClient.setQueryData(['feed'], (oldData: any) => {
        if (!oldData || !oldData.pages) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            posts: page.posts.map((p: any) => {
              if (p.id === post.id) {
                return { ...p, hasBookmarked: result.bookmarked };
              }
              return p;
            })
          }))
        };
      });
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

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/${post.author.username || 'user'}/status/${post.id}` : '';

  const copyToClipboard = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied to clipboard!");
      setShowShareDialog(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      // Optimistically update React Query cache for instant UI feedback
      queryClient.setQueryData(['feed'], (oldData: any) => {
        if (!oldData || !oldData.pages) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            posts: page.posts.filter((p: any) => p.id !== post.id)
          }))
        };
      });
      deletePost(post.id); // Zustand fallback

      await deletePostAction(post.id);
      
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      toast.success("Post deleted successfully!");
      setShowDeleteAlert(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete post. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const isOwner = session?.user?.id === post.author.id;

  const handleArticleClick = (e: React.MouseEvent) => {
    // Prevent navigation if any dialog is currently open
    if (showCommentForm || showShareDialog || showDeleteAlert) return;

    // Ignore clicks on links, buttons, or interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('a, button, [role="menuitem"], [role="dialog"], input, textarea')) {
      return;
    }
    
    // Prevent default text selection from triggering navigation (optional but good practice)
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      return;
    }

    router.push(`/${post.author.username || 'user'}/status/${post.id}`);
  };

  return (
    <article 
      ref={ref}
      onClick={handleArticleClick}
      className="border-b px-4 py-3 hover:bg-muted/30 transition-colors flex flex-col relative cursor-pointer"
    >
      {/* Header Row */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex gap-2 text-sm">
          {/* Avatar */}
          <Link href={`/${post.author.username || 'user'}`} className="shrink-0">
            <Avatar className="w-10 h-10">
              <AvatarImage src={post.author.image ?? ""} alt={post.author.name ?? ""} />
              <AvatarFallback>{post.author.name?.charAt(0)}</AvatarFallback>
            </Avatar>
          </Link>

          {/* Name & Meta */}
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-1">
              <Link href={`/${post.author.username || 'user'}`} className="truncate">
                <UserNameWithRole displayName={post.author.name || ""} role={post.author.role} className="mb-0 text-sm" />
              </Link>
              {post.author.isVerified && (
                <span className="text-primary text-[10px] bg-primary/10 rounded-full w-4 h-4 flex items-center justify-center">
                  ✓
                </span>
              )}
              <span className="text-muted-foreground">·</span>
              <Link href={`/${post.author.username || 'user'}/status/${post.id}`} className="text-muted-foreground hover:underline whitespace-nowrap text-xs">
                {post.createdAt ? new Date(post.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
              </Link>
            </div>
            <Link href={`/${post.author.username || 'user'}`} className="text-muted-foreground truncate text-sm">
              @{post.author.username}
            </Link>
          </div>
        </div>

        {/* Options Dropdown */}
        <div className="-mt-1">
          <DropdownMenu>
            <DropdownMenuTrigger render={
              <button className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors" />
            }>
              <MoreHorizontal size={18} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {isOwner ? (
                <>
                  <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => toast.info("Edit feature coming soon!")}>
                    <Edit size={16} />
                    <span>Edit</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="cursor-pointer text-red-500 focus:text-red-500 focus:bg-red-500/10 gap-2" 
                    onClick={(e) => {
                      e.preventDefault();
                      setShowDeleteAlert(true);
                    }} 
                    disabled={isDeleting}
                  >
                    <Trash2 size={16} />
                    <span>Delete</span>
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => toast.info("Add Friend feature coming soon!")}>
                    <UserPlus size={16} />
                    <span>Add Friend</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer text-yellow-600 focus:text-yellow-600 focus:bg-yellow-500/10 gap-2" onClick={() => toast.info("Block feature coming soon!")}>
                    <Ban size={16} />
                    <span>Block @{post.author.username}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer text-red-500 focus:text-red-500 focus:bg-red-500/10 gap-2" onClick={() => toast.info("Report feature coming soon!")}>
                    <Flag size={16} />
                    <span>Report</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
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
          <div className={`mt-3 -mx-4 sm:mx-0 rounded-none sm:rounded-2xl overflow-hidden border-y sm:border ${
            post.media.length === 1 ? 'block bg-black/5 dark:bg-white/5' : 'grid grid-cols-2 gap-0.5 bg-muted'
          }`}>
            {post.media.map((media) => {
              const isVideo = media.type === 'video';
              const mediaContent = (
                <div className={`relative w-full ${post.media.length > 1 ? 'flex justify-center items-center aspect-square sm:aspect-[4/3]' : 'block'}`}>
                  {isVideo ? (
                    <video
                      src={media.url}
                      controls
                      playsInline
                      className={post.media.length === 1 ? 'w-full h-auto block' : 'w-full h-full absolute inset-0 object-cover bg-black'}
                      poster={media.thumbnailUrl || undefined}
                    />
                  ) : post.media.length === 1 ? (
                    <Image 
                      src={getCloudinaryUrl(media.url, "f_auto,q_auto,w_1200,c_limit")} 
                      alt="Post media" 
                      width={media.width || 1200}
                      height={media.height || 800}
                      className="w-full h-auto block"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 70vw, 800px"
                      priority={priority}
                    />
                  ) : (
                    <Image 
                      src={getCloudinaryUrl(media.url, "f_auto,q_auto,w_800,c_limit")} 
                      alt="Post media" 
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
                <Link 
                  key={media.id} 
                  href={`/${post.author.username || 'user'}/status/${post.id}/photo/${media.id}`}
                  scroll={false}
                  className="block relative"
                >
                  {mediaContent}
                </Link>
              );
            })}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between items-center mt-3 text-muted-foreground">
          <button 
            onClick={handleLike}
            className="flex-1 flex justify-center items-center gap-2 py-1.5 hover:bg-muted/50 rounded-md transition-colors text-[13px] font-medium"
          >
            <ThumbsUp 
              size={18} 
              className={isLiked ? "fill-red-500 text-red-500" : ""} 
            />
            <span className={isLiked ? "text-red-500" : ""}>{Math.max(0, likeCount) || 0}</span>
          </button>
          
          <button 
            onClick={() => setShowCommentForm(!showCommentForm)}
            className="flex-1 flex justify-center items-center gap-2 py-1.5 hover:bg-muted/50 rounded-md transition-colors text-[13px] font-medium"
          >
            <MessageCircle size={18} />
            <span>{post.stats?.replies || 0}</span>
          </button>

          <button 
            onClick={handleBookmark}
            className="flex-1 flex justify-center items-center gap-2 py-1.5 hover:bg-muted/50 rounded-md transition-colors text-[13px] font-medium"
          >
            <Bookmark 
              size={18} 
              className={isBookmarked ? "fill-primary text-primary" : ""} 
            />
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
          </button>
        </div>

        {/* Reply Modal */}
        <Dialog open={showCommentForm} onOpenChange={setShowCommentForm} disablePointerDismissal>
          <DialogContent 
            className="sm:max-w-[700px] p-0 border border-border/50 bg-background shadow-xl rounded-2xl h-[85vh] max-h-[800px] flex flex-col overflow-hidden"
          >
            <div className="border-b px-4 py-4 shrink-0 relative flex items-center justify-center">
              <DialogTitle className="font-bold text-lg m-0">Post {post.author.name}</DialogTitle>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pt-2">
              <CommentFeed postId={post.id} hideHeader hideForm />
            </div>

            <div className="p-3 border-t shrink-0 bg-background">
              <CommentForm 
                postId={post.id} 
                onSuccess={() => {}} 
                autoFocus 
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your post.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
                setShowDeleteAlert(false);
              }}
              className="bg-red-500 hover:bg-red-600 focus:ring-red-500"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Post"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share Post</DialogTitle>
            <DialogDescription>
              Anyone with this link will be able to view this post.
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
    </article>
  );
}
