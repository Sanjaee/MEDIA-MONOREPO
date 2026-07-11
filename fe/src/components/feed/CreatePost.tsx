"use client";

import { useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Image as ImageIcon, X, Loader2 } from "lucide-react";
import { createPostAction } from "@/actions/post.actions";
import { usePostStore } from "@/store/usePostStore";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { useQueryClient } from "@tanstack/react-query";

import imageCompression from 'browser-image-compression';

export function CreatePost({ onSuccess }: { onSuccess?: () => void }) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [isProduct, setIsProduct] = useState(false);
  const [productPrice, setProductPrice] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addPost = usePostStore(state => state.addPost);

  if (!session?.user) return null;

  const MAX_VIDEO_SIZE = 20 * 1024 * 1024; // 20MB
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

  const validateFile = (file: File) => {
    if (file.type.startsWith('video/')) {
      if (file.size > MAX_VIDEO_SIZE) {
        toast.error(`Video ${file.name} is too large. Max size is 20MB.`);
        return false;
      }
    } else if (file.type.startsWith('image/')) {
      if (file.size > MAX_IMAGE_SIZE) {
        toast.error(`Image ${file.name} is too large. Max size is 5MB.`);
        return false;
      }
    }
    return true;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).filter(validateFile);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files)
        .filter(f => f.type.startsWith("image/") || f.type.startsWith("video/"))
        .filter(validateFile);
      if (files.length > 0) {
        setSelectedFiles(prev => [...prev, ...files]);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleSubmit = async () => {
    if (!content.trim() && selectedFiles.length === 0) return;
    
    setIsSubmitting(true);
    try {
      // Create FormData instead of compressing locally
      const formData = new FormData();
      formData.append("content", content);
      
      if (isProduct) {
        formData.append("isProduct", "true");
        formData.append("productPrice", String(Math.floor(parseFloat(productPrice) * 100)));
        formData.append("productUrl", productUrl);
      }

      for (const file of selectedFiles) {
        formData.append("media", file);
      }

      // Use client-side fetch to our Next.js API route proxy 
      // This avoids Next.js Server Action FormData bugs with files
      const res = await fetch("/api/posts", {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        throw new Error(`Failed to create post: ${res.statusText}`);
      }

      const newPost = await res.json();
      
      // Jika tidak ada media, post bisa langsung dimunculkan di UI
      // Tapi jika ada media, kita tidak memasukkannya ke state addPost() 
      // karena kita menunggu notifikasi WebSocket dari background worker.
      if (selectedFiles.length === 0) {
        addPost(newPost);
      }
      
      setContent("");
      setIsProduct(false);
      setProductPrice("");
      setProductUrl("");
      setSelectedFiles([]);
      
      if (selectedFiles.length > 0) {
        toast.success("Uploading media... Your post will appear shortly!");
      } else {
        toast.success("Post created successfully!");
      }

      if (onSuccess) onSuccess();
      
      if (selectedFiles.length === 0) {
        queryClient.invalidateQueries({ queryKey: ['feed'] });
      }
    } catch (e) {
      console.error("Error creating post:", e);
      toast.error("Failed to create post. Please ensure your files are not too large.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="p-4 border-b"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <div className="flex gap-3">
        <Avatar className="w-10 h-10">
          <AvatarImage src={session.user.image ?? ""} alt={session.user.name ?? ""} />
          <AvatarFallback>{session.user.name?.charAt(0)}</AvatarFallback>
        </Avatar>
        
        <div className="flex-1">
          <textarea 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What is happening?! (You can drop images here)" 
            className="w-full bg-transparent outline-none resize-none min-h-[50px] text-[15px]"
            maxLength={280}
          />
          
          {selectedFiles.length > 0 && (
            <div className={`mt-2 ${selectedFiles.length === 1 ? 'flex justify-center w-full' : 'grid grid-cols-2 gap-2'}`}>
              {selectedFiles.map((file, index) => (
                <div 
                  key={index} 
                  className={`relative rounded-xl overflow-hidden bg-muted ${
                    selectedFiles.length === 1 
                      ? 'w-full flex justify-center items-center max-h-[60vh]' 
                      : 'aspect-video'
                  }`}
                >
                  <button onClick={() => removeFile(index)} className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full z-10 hover:bg-black/70">
                    <X size={16} />
                  </button>
                  {file.type.startsWith('video/') ? (
                    <video
                      src={URL.createObjectURL(file)}
                      controls
                      className={`bg-black ${selectedFiles.length === 1 ? 'w-full max-h-[60vh] object-contain' : 'w-full h-full object-cover'}`}
                    />
                  ) : (
                    <img 
                      src={URL.createObjectURL(file)} 
                      alt="Preview" 
                      className={`bg-black ${selectedFiles.length === 1 ? 'w-full max-h-[60vh] object-contain' : 'w-full h-full object-cover'}`}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between items-center mt-3 pt-3 border-t">
            <div className="flex flex-col w-full gap-3">
              {isProduct && (
                <div className="flex flex-col gap-2 p-3 bg-muted rounded-xl">
                  <span className="text-sm font-semibold">Product Details</span>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-2 bg-background rounded-md px-2 flex-1 border">
                      <span className="text-muted-foreground">$</span>
                      <input 
                        type="number"
                        placeholder="Price (USD)"
                        value={productPrice}
                        onChange={(e) => setProductPrice(e.target.value)}
                        className="bg-transparent border-none outline-none text-sm w-full py-2"
                        min="1"
                        step="0.01"
                      />
                    </div>
                  </div>
                  <input
                    type="url"
                    placeholder="Product URL (e.g. Google Drive link)"
                    value={productUrl}
                    onChange={(e) => setProductUrl(e.target.value)}
                    className="bg-background border outline-none text-sm w-full py-2 px-3 rounded-md"
                  />
                </div>
              )}
              
              <div className="flex justify-between items-center w-full">
                <div className="flex gap-2 text-primary">
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileSelect} 
                    className="hidden" 
                    accept="image/*,video/*"
                    multiple
                  />
                  <button onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-primary/10 rounded-full transition-colors" title="Add Media">
                    <ImageIcon size={20} />
                  </button>
                  <button 
                    onClick={() => setIsProduct(!isProduct)} 
                    className={`p-2 rounded-full transition-colors ${isProduct ? 'bg-primary/20' : 'hover:bg-primary/10'}`} 
                    title="Sell a Product"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                  </button>
                </div>
                
                <Button 
                  onClick={handleSubmit} 
                  disabled={isSubmitting || (!content.trim() && selectedFiles.length === 0) || (isProduct && (!productPrice || !productUrl))}
                  className="rounded-full px-5"
                >
                  {isSubmitting ? <Loader2 className="animate-spin w-4 h-4" /> : "Post"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
