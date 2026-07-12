import React, { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import axios from "axios";
import { toast } from "sonner";
import Image from "next/image";
import { PostWithRelations } from "@/store/usePostStore";
import { X, Image as ImageIcon } from "lucide-react";

interface EditPostModalProps {
  post: PostWithRelations;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedContent: string) => void;
}

export function EditPostModal({ post, isOpen, onClose, onSuccess }: EditPostModalProps) {
  const [content, setContent] = useState(post.content || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      toast.error("Content cannot be empty");
      return;
    }

    setIsSubmitting(true);
    try {
      await axios.put(`/api/posts/${post.id}`, { content });
      onSuccess(content);
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.error || "Failed to edit post");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/* Hide the default close button of DialogContent by omitting DialogHeader or hiding it via CSS, but DialogContent has a built-in X. We can hide it using [&>button]:hidden */}
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden rounded-2xl bg-background border-border [&>button]:hidden">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
            <X size={20} />
          </button>
          <span className="text-primary font-bold text-sm mr-2 cursor-pointer hover:underline">Drafts</span>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="px-4 pb-2 flex gap-3">
            <Avatar className="w-10 h-10 shrink-0">
              <AvatarImage src={post.author.image || ""} alt={post.author.username || ""} />
              <AvatarFallback>{post.author.username?.charAt(0) || "U"}</AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full bg-transparent outline-none resize-none min-h-[80px] text-[15px] pt-2"
                placeholder="What is happening?!"
                maxLength={280}
                autoFocus
              />
              
              {post.media && post.media.length > 0 && (
                <div className="mt-2 space-y-2 mb-4">
                  <div className={`rounded-xl overflow-hidden ${
                    post.media.length === 1 ? 'block' : 'grid grid-cols-2 gap-1'
                  }`}>
                    {post.media.map((media, index) => {
                      const isVideo = media.type === 'video';
                      return (
                        <div key={index} className={`relative ${post.media.length > 1 ? 'aspect-square' : 'w-full'}`}>
                          {isVideo ? (
                            <video
                              src={media.url}
                              className={post.media.length === 1 ? 'w-full h-auto max-h-[300px] bg-black rounded-xl' : 'w-full h-full object-cover bg-black'}
                            />
                          ) : (
                            <Image 
                              src={media.url} 
                              alt="Media preview" 
                              width={500}
                              height={500}
                              className={post.media.length === 1 ? 'w-full h-auto max-h-[300px] object-cover rounded-xl' : 'w-full h-full object-cover'}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="px-4 mb-3">
             <hr className="border-border" />
          </div>

          <div className="px-4 pb-4 pt-1 flex justify-between items-center">
            <div className="flex gap-2 text-primary">
              <button type="button" className="p-2 hover:bg-primary/10 rounded-full transition-colors opacity-50 cursor-not-allowed" title="Editing media is not supported yet">
                <ImageIcon size={20} />
              </button>
              <button type="button" className="p-2 rounded-full hover:bg-primary/10 transition-colors opacity-50 cursor-not-allowed" title="Editing product is not supported yet">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              </button>
            </div>
            
            <Button 
              type="submit" 
              disabled={isSubmitting || !content.trim() || content === post.content}
              className="rounded-full px-6 font-bold"
            >
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
