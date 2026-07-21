 "use client";

import { useEffect, useState } from "react";
import { PostWithRelations } from "@/store/usePostStore";
import { PostCard } from "./PostCard";
import { PostSkeleton } from "./PostSkeleton";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { getInfiniteFeedPostsAction } from "@/actions/post.actions";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useSession } from "next-auth/react";
import { ArrowUp } from "lucide-react";

export function Feed({ initialData }: { initialData: { posts: PostWithRelations[], nextCursor: string | null } }) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [newPosts, setNewPosts] = useState<any[]>([]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: async ({ pageParam }) => {
      return getInfiniteFeedPostsAction({ cursor: pageParam as string | null, limit: 10 });
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    initialData: {
      pages: [initialData],
      pageParams: [null],
    },
    staleTime: Infinity, // Prevent background refetch on back navigation
  });

  const allPosts = data ? data.pages.flatMap((page) => page.posts) : initialData.posts;

  const virtualizer = useWindowVirtualizer({
    count: hasNextPage ? allPosts.length + 1 : allPosts.length,
    estimateSize: () => 300, // estimated height of a post card
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    const handleNewPost = (e: Event) => {
      const customEvent = e as CustomEvent;
      const payload = customEvent.detail;
      
      // Don't show for our own posts
      if (session?.user?.id && payload.authorId === session.user.id) {
        return;
      }
      
      setNewPosts((prev) => {
        // Prevent duplicates
        if (prev.some(p => p.postId === payload.postId)) return prev;
        return [payload, ...prev];
      });
    };
    
    window.addEventListener('newPost', handleNewPost);
    return () => window.removeEventListener('newPost', handleNewPost);
  }, [session?.user?.id]);

  const handleShowNewPosts = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setNewPosts([]);
    queryClient.invalidateQueries({ queryKey: ['feed'] });
  };

  useEffect(() => {
    const [lastItem] = [...virtualItems].reverse();

    if (!lastItem) {
      return;
    }

    if (
      lastItem.index >= allPosts.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [
    hasNextPage,
    fetchNextPage,
    allPosts.length,
    isFetchingNextPage,
    virtualItems,
  ]);

  return (
    <div className="flex flex-col pb-20 w-full relative">
      {newPosts.length > 0 && (
        <div className="absolute top-4 left-0 right-0 z-50 flex justify-center w-full pointer-events-none">
          <button
            onClick={handleShowNewPosts}
            className="pointer-events-auto flex items-center gap-2 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white px-4 py-1.5 rounded-full font-bold shadow-md transition-colors text-sm"
          >
            <ArrowUp className="w-4 h-4" />
            <div className="flex -space-x-1.5">
              {newPosts.slice(0, 3).map((p, i) => (
                <img
                  key={p.postId}
                  src={p.actorImage || "/logo.png"}
                  alt={p.actorUsername}
                  className="w-6 h-6 rounded-full border-2 border-[#1d9bf0] object-cover"
                />
              ))}
            </div>
            <span>posted</span>
          </button>
        </div>
      )}

      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const isLoaderRow = virtualItem.index > allPosts.length - 1;
          const post = allPosts[virtualItem.index];

          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {isLoaderRow ? (
                <PostSkeleton />
              ) : (
                <PostCard post={post} priority={virtualItem.index < 4} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
