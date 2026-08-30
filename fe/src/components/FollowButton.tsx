"use client";

import { useState, useEffect } from "react";
import { UserPlus, UserMinus, UserCheck, Clock, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { getSocialStatusAction, toggleFriendAction, FriendStatus } from "@/actions/social.actions";
import { useSession } from "next-auth/react";

interface FollowButtonProps {
  targetUserId: string;
  initialIsFollowing?: boolean;
  token?: string;
}

export function FollowButton({ targetUserId }: FollowButtonProps) {
  const [status, setStatus] = useState<FriendStatus>("none");
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();

  useEffect(() => {
    async function fetchStatus() {
      if (session?.user) {
        try {
          const res = await getSocialStatusAction(targetUserId);
          setStatus(res.friendStatus);
        } catch (e) {
          console.error(e);
        }
      }
      setIsLoading(false);
    }
    fetchStatus();
  }, [targetUserId, session]);

  const handleConfirmAction = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const res = await toggleFriendAction(targetUserId);
      setStatus(res.status);
      
      if (res.status === "accepted") {
        toast.success("Friend request accepted! You are now friends.");
      } else if (res.status === "pending") {
        toast.success("Friend request sent!");
      } else {
        toast.info("Friend removed / Request cancelled.");
      }
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to update friend status");
    } finally {
      setIsProcessing(false);
      setIsDialogOpen(false);
    }
  };

  if (!session?.user || session.user.id === targetUserId) {
    return null;
  }

  const getButtonConfig = () => {
    if (isLoading) return { label: "Loading...", icon: <Loader2 className="animate-spin" size={14} />, class: "bg-[#333] border-[#555] text-white opacity-50" };
    
    switch (status) {
      case "accepted":
        return { label: "Unfriend", icon: <UserMinus size={14} />, class: "bg-[#333] border border-[#555] text-white hover:bg-[#444]" };
      case "pending":
        return { label: "Cancel Request", icon: <Clock size={14} />, class: "bg-[#333] border border-[#555] text-white hover:bg-[#444]" };
      case "incoming_request":
        return { label: "Accept Request", icon: <UserCheck size={14} />, class: "bg-green-600 border border-green-700 text-white hover:bg-green-700" };
      default: // none
        return { label: "Add Friend", icon: <UserPlus size={14} />, class: "bg-[#4a90e2] border border-[#3b73b5] text-white hover:bg-[#5ca0eb]" };
    }
  };

  const getDialogConfig = () => {
    switch (status) {
      case "accepted":
        return { title: "Unfriend User?", desc: "Are you sure you want to remove this user from your friends list?" };
      case "pending":
        return { title: "Cancel Request?", desc: "Are you sure you want to cancel your friend request?" };
      case "incoming_request":
        return { title: "Accept Request?", desc: "Do you want to accept this user's friend request?" };
      default:
        return { title: "Add Friend?", desc: "Send a friend request to this user?" };
    }
  };

  const btn = getButtonConfig();
  const dialog = getDialogConfig();

  return (
    <>
      <button 
        onClick={() => setIsDialogOpen(true)}
        disabled={isLoading || isProcessing}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-bold transition shadow ${btn.class} ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {btn.icon}
        <span>{btn.label}</span>
      </button>

      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{dialog.desc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAction} disabled={isProcessing} className={status === "accepted" || status === "pending" ? "bg-red-500 hover:bg-red-600" : ""}>
              {isProcessing ? "Processing..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
