import { create } from "zustand";

export interface PostWithRelations {
  id: string;
  content: string | null;
  createdAt: Date | null;
  author: {
    id: string;
    name: string | null;
    username: string | null;
    image: string | null;
    isVerified: boolean | null;
    role: string | null;
  };
  media: {
    id: string;
    type: string;
    url: string;
    publicId: string | null;
    width?: number | null;
    height?: number | null;
    thumbnailUrl?: string | null;
  }[];
  stats: {
    replies: number;
    reposts: number;
    likes: number;
    views: number;
  };
  hasLiked?: boolean;
  hasBookmarked?: boolean;
  isProduct?: boolean;
  productTitle?: string;
  productPrice?: number;
  productUrl?: string;
  hasBought?: boolean;
  authorId?: string;
}

interface PostState {
  posts: PostWithRelations[];
  setPosts: (posts: PostWithRelations[]) => void;
  addPost: (post: PostWithRelations) => void;
  deletePost: (postId: string) => void;
}

export const usePostStore = create<PostState>((set) => ({
  posts: [],
  setPosts: (posts) => set({ posts }),
  addPost: (post) => set((state) => ({ posts: [post, ...state.posts] })),
  deletePost: (postId) => set((state) => ({ 
    posts: state.posts.filter((p) => p.id !== postId) 
  })),
}));
