"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createNewsAction } from "@/actions/news.actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function CreateNews() {
  const [content, setContent] = useState("");
  const [customUsername, setCustomUsername] = useState("Admin Team");
  const [customRole, setCustomRole] = useState("admin");
  const [mediaUrl, setMediaUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !mediaUrl.trim()) return;

    setIsSubmitting(true);
    try {
      await createNewsAction({
        customUsername,
        customRole,
        content,
        mediaUrl: mediaUrl || undefined,
      });
      toast.success("News posted successfully!");
      setContent("");
      setMediaUrl("");
      router.refresh();
      // Need a hard reload or refresh logic for feed
      window.location.reload();
    } catch (error: any) {
      toast.error(error.message || "Failed to post news");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="border-b px-4 py-4 mb-2 bg-muted/10">
      <h2 className="text-sm font-semibold text-muted-foreground mb-3">Create News (Admin Only)</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Input 
            placeholder="Custom Username (e.g., News Team)" 
            value={customUsername}
            onChange={(e) => setCustomUsername(e.target.value)}
            className="flex-1"
            required
          />
          <div className="w-[180px]">
            <Select value={customRole} onValueChange={(val) => val && setCustomRole(val)}>
              <SelectTrigger>
                <SelectValue placeholder="Select Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="mod">Moderator</SelectItem>
                <SelectItem value="mvp">MVP</SelectItem>
                <SelectItem value="god">God</SelectItem>
                <SelectItem value="vip">VIP</SelectItem>
                <SelectItem value="member">Member</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <Textarea 
          placeholder="What's the latest news?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="resize-none min-h-[80px]"
          required={!mediaUrl}
        />

        <Input 
          placeholder="Media URL (Optional)" 
          value={mediaUrl}
          onChange={(e) => setMediaUrl(e.target.value)}
        />

        <div className="flex justify-end mt-2">
          <Button 
            type="submit" 
            disabled={isSubmitting || (!content.trim() && !mediaUrl.trim())}
            className="rounded-full px-6 font-bold"
          >
            {isSubmitting ? "Posting..." : "Post News"}
          </Button>
        </div>
      </form>
    </div>
  );
}
