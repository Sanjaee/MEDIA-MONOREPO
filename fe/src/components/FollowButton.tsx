"use client";

import { useState } from "react";
import { UserPlus, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";

interface FollowButtonProps {
  targetUserId: string;
  initialIsFollowing: boolean;
  token?: string;
}

export function FollowButton({ targetUserId, initialIsFollowing, token }: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleToggleFollow = async () => {
    if (!token) {
      alert("Please login to follow users.");
      return;
    }
    
    setIsLoading(true);
    try {
      const res = await fetch(`http://localhost:8080/api/users/${targetUserId}/follow`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        setIsFollowing(data.following);
        router.refresh();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error || 'Failed to toggle follow'}`);
      }
    } catch (error) {
      console.error(error);
      alert("Network error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button 
      onClick={handleToggleFollow}
      disabled={isLoading}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-bold transition shadow ${
        isFollowing 
          ? "bg-[#333] border border-[#555] text-white hover:bg-[#444]" 
          : "bg-[#4a90e2] border border-[#3b73b5] text-white hover:bg-[#5ca0eb]"
      } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {isFollowing ? (
        <>
          <UserMinus size={14} />
          <span>Unfollow</span>
        </>
      ) : (
        <>
          <UserPlus size={14} />
          <span>Follow</span>
        </>
      )}
    </button>
  );
}
