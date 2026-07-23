"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { CreatePost } from "@/components/feed/CreatePost";
import { useSession } from "next-auth/react";

export function CreatePostModal() {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();

  if (!session?.user) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      // Hanya izinkan aksi membuka dialog dari trigger. 
      // Untuk menutup, hanya bisa melalui tombol X atau fungsi onSuccess.
      if (isOpen) {
        setOpen(true);
      }
    }}>
      <DialogTrigger 
        render={<Button className="rounded-full shrink-0 font-bold px-4 gap-1.5" />}
      >
        <Plus size={18} />
        Post
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-background border-border" showCloseButton={false}>
        <DialogTitle className="sr-only">Create Post</DialogTitle>
        <DialogDescription className="sr-only">Create a new post</DialogDescription>
        
        <div className="flex justify-between items-center p-2 border-b">
           <button onClick={() => setOpen(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
             <X size={20} />
           </button>
           <Button variant="ghost" className="text-blue-500 font-semibold hover:bg-blue-500/10 hover:text-blue-600">Drafts</Button>
        </div>
        
        <div className="overflow-y-auto max-h-[80vh] custom-scrollbar ">
          <CreatePost onSuccess={() => setOpen(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
