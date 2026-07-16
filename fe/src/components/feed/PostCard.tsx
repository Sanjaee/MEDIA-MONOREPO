"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, Bookmark, Share, Trash2, MoreHorizontal, Edit, UserPlus, Ban, Flag, ThumbsUp, Copy, BarChart2, X, Loader2, Search } from "lucide-react";
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
import { useSession } from "next-auth/react";
import { deletePostAction, toggleLikeAction, toggleBookmarkAction } from "@/actions/post.actions";
import { useState, useEffect, useRef } from "react";
import { CommentForm } from "@/components/comment/CommentForm";
import { CommentFeed } from "@/components/comment/CommentFeed";
import { UserNameWithRole } from "@/components/ui/UserNameWithRole";
import { toast } from "sonner";
import axios from "axios";
import { EditPostModal } from "./EditPostModal";

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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  const [showCryptoModal, setShowCryptoModal] = useState(false);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [isBuying, setIsBuying] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

  const [isOnCooldown, setIsOnCooldown] = useState(false);

  const handleLike = () => {
    if (!session?.user) {
      toast.error("Please login to like posts");
      return;
    }
    
    if (isOnCooldown) {
      toast.error("Please wait a few seconds before liking again (Rate limit)");
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
          // Activate 5-second cooldown after sending a request
          setIsOnCooldown(true);
          setTimeout(() => setIsOnCooldown(false), 5000);
        }
      }
    }, 1000); // 1s debounce

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

  const [isAccessing, setIsAccessing] = useState(false);

  const handleAccessProduct = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAccessing) return;
    
    setIsAccessing(true);
    try {
      const res = await axios.post(`/api/products/${post.id}/access-token`);
      if (res.data.accessToken) {
        window.open(`/api/products/download?token=${res.data.accessToken}`, "_blank");
      } else {
        toast.error("Failed to generate access token");
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to access product");
    } finally {
      setIsAccessing(false);
    }
  };

  const handleBuyProductClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!session?.user) {
      toast.error("Please login to buy products");
      return;
    }
    setIsBuying(true);
    try {
      const res = await axios.get("/api/payment/plisio/currencies");
      if (res.data.success) {
        setCurrencies(res.data.data);
        setShowCryptoModal(true);
      } else {
        toast.error(res.data.error || "Failed to load currencies");
      }
    } catch (error: any) {
      toast.error("Error loading crypto options");
    } finally {
      setIsBuying(false);
    }
  };

  const handleCurrencySelect = async (currency: string) => {
    setIsBuying(true);
    try {
      const res = await axios.post("/api/payment/plisio/product", {
        postId: post.id,
        amount: (post.productPrice || 0) / 100, // convert back to dollars
        currency
      });
      if (res.data.success && res.data.data) {
        if (res.data.data.whiteLabel) {
          // Save white-label invoice data in sessionStorage so the custom page can render it
          sessionStorage.setItem(`invoice_${res.data.data.order_id}`, JSON.stringify(res.data.data.whiteLabel));
          window.location.href = `/payment/invoice/${res.data.data.order_id}`;
        } else if (res.data.data.hostedUrl) {
          window.location.href = res.data.data.hostedUrl;
        }
      } else {
        toast.error(res.data.error || "Failed to create invoice");
        setIsBuying(false);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to create invoice");
      setIsBuying(false);
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
                  <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => setIsEditModalOpen(true)}>
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
                      src={media.url} 
                      alt="Post media" 
                      width={media.width || 1200}
                      height={media.height || 800}
                      className="w-full h-auto block"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 70vw, 800px"
                      priority={priority}
                    />
                  ) : (
                    <Image 
                      src={media.url} 
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

        {/* Product Box */}
        {post.isProduct && (
          <div className="mt-4 p-4 border rounded-xl bg-muted/30">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-semibold text-lg">Digital Product</h4>
                <p className="text-xl font-bold text-primary">${((post.productPrice || 0) / 100).toFixed(2)}</p>
              </div>
              <div>
                {(post.hasBought || session?.user?.id === post.author?.id) ? (
                  <Button onClick={handleAccessProduct} disabled={isAccessing} className="rounded-full px-6 font-semibold">
                    {isAccessing ? "Opening..." : "Access Product"}
                  </Button>
                ) : (
                  <Button onClick={handleBuyProductClick} disabled={isBuying} className="rounded-full px-6 font-semibold bg-green-600 hover:bg-green-700 text-white">
                    {isBuying ? "Processing..." : "Buy Product"}
                  </Button>
                )}
              </div>
            </div>
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

      {/* Crypto Selection Modal */}
      <Dialog open={showCryptoModal} onOpenChange={(open) => { if (!isBuying) setShowCryptoModal(open); }}>
        <DialogContent className="sm:max-w-md bg-[#16181c] border-[#333] text-white" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Select Crypto</DialogTitle>
            <DialogDescription className="text-gray-400">
              Choose your preferred cryptocurrency to complete the payment for the digital product.
            </DialogDescription>
          </DialogHeader>

          {currencies.length > 0 && (
            <div className="mt-4 px-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input 
                  type="text" 
                  placeholder="Search cryptocurrency..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-[#202327] border border-[#333] rounded-xl text-sm outline-none focus:border-[#1d9bf0] transition-colors text-white"
                />
              </div>
            </div>
          )}

          {isBuying && !currencies.length ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-white" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar mt-4">
              {currencies
                .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.currency.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(c => (
                <button
                  key={c.cid}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCurrencySelect(c.currency);
                  }}
                  disabled={isBuying}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-[#333] hover:border-[#1d9bf0] hover:bg-[#1d9bf0]/10 transition-all disabled:opacity-50"
                >
                  <img src={c.icon} alt={c.name} className="w-8 h-8" />
                  <span className="text-sm font-semibold">{c.name}</span>
                  <span className="text-xs text-gray-500">{c.currency}</span>
                </button>
              ))}
            </div>
          )}
          
          {isBuying && currencies.length > 0 && (
            <div className="absolute inset-0 bg-[#16181c]/80 flex flex-col items-center justify-center rounded-2xl z-10">
              <Loader2 className="w-10 h-10 animate-spin text-[#1d9bf0] mb-4" />
              <span className="font-medium text-white">Preparing checkout...</span>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <EditPostModal 
        post={post}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={(newContent) => {
          setPost(p => ({...p, content: newContent}));
          setIsEditModalOpen(false);
          toast.success("Post updated successfully!");
        }}
      />
    </article>
  );
}
