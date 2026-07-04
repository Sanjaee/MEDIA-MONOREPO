"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createCommentSchema, CreateCommentInput } from "@/lib/validations/comment";
import { createCommentAction } from "@/actions/comment.actions";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSession } from "next-auth/react";

interface CommentFormProps {
  postId: string;
  parentCommentId?: string;
  onSuccess?: () => void;
  autoFocus?: boolean;
}

export function CommentForm({ postId, parentCommentId, onSuccess, autoFocus }: CommentFormProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const form = useForm<CreateCommentInput>({
    resolver: zodResolver(createCommentSchema),
    defaultValues: {
      postId,
      parentCommentId: parentCommentId || null,
      content: "",
    },
  });

  const mutation = useMutation({
    mutationFn: createCommentAction,
    onSuccess: () => {
      form.reset();
      if (parentCommentId) {
        queryClient.invalidateQueries({ queryKey: ["replies", parentCommentId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["comments", postId] });
      }
      onSuccess?.();
    },
    onError: (error) => {
      console.error("Failed to post comment:", error);
      toast.error("Failed to post comment");
    }
  });

  const onSubmit = (data: CreateCommentInput) => {
    mutation.mutate(data);
  };

  if (!session?.user) return null;

  return (
    <div className="flex gap-3 px-4 py-3 ">
      <Avatar className="w-10 h-10 shrink-0">
        <AvatarImage src={session.user.image ?? ""} alt={session.user.name ?? ""} />
        <AvatarFallback>{session.user.name?.charAt(0) || "U"}</AvatarFallback>
      </Avatar>
      
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex items-end gap-2">
        <div className="flex-1 bg-muted/20 border border-border/50 rounded-2xl flex flex-col focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary/50 transition-all overflow-hidden">
          <Textarea 
            {...form.register("content")}
            placeholder="Post your reply"
            className="min-h-[40px] border-none shadow-none focus-visible:ring-0 text-[15px] resize-none py-2.5 px-4 bg-transparent overflow-hidden"
            autoFocus={autoFocus}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "40px";
              target.style.height = `${target.scrollHeight}px`;
            }}
          />
          {form.formState.errors.content && (
            <div className="text-sm text-red-500 px-4 pb-2">
              {form.formState.errors.content.message}
            </div>
          )}
        </div>
        
        <Button 
          type="submit" 
          disabled={mutation.isPending || !form.watch("content")?.trim()}
          className="rounded-full px-5 h-[40px] font-bold shrink-0 mb-[1px]"
        >
          Reply
        </Button>
      </form>
    </div>
  );
}
