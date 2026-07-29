"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { SearchFeed } from "@/components/feed/SearchFeed";
import { UserSearchFeed } from "@/components/feed/UserSearchFeed";

interface SearchTabsWrapperProps {
  q: string;
  initialData: any;
  initialUsers: any[];
}

export function SearchTabsWrapper({ q, initialData, initialUsers }: SearchTabsWrapperProps) {
  const [activeTab, setActiveTab] = useState<"posts" | "users">("posts");

  return (
    <div className="flex flex-col w-full">
      <div className="flex w-full border-b border-border/40">
        <button 
          onClick={() => setActiveTab("posts")}
          className={cn(
            "flex-1 py-4 text-sm font-medium border-b-2 transition-colors",
            activeTab === "posts"
              ? "border-primary text-foreground" 
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border/80"
          )}
        >
          Posts
        </button>
        <button 
          onClick={() => setActiveTab("users")}
          className={cn(
            "flex-1 py-4 text-sm font-medium border-b-2 transition-colors",
            activeTab === "users"
              ? "border-primary text-foreground" 
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border/80"
          )}
        >
          Users
        </button>
      </div>

      <div className="w-full">
        {activeTab === "posts" && (
          <SearchFeed q={q} initialData={initialData} />
        )}
        {activeTab === "users" && (
          <UserSearchFeed q={q} initialUsers={initialUsers} />
        )}
      </div>
    </div>
  );
}
