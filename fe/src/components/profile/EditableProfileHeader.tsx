"use client";

import { useState } from "react";
import Image from "next/image";
import { EditProfileModal } from "./EditProfileModal";
import { getRoleBadge, getRoleNameClass, getRoleDisplayName } from "@/utils/roleStyles";

interface EditableProfileHeaderProps {
  user: any;
  isOwner: boolean;
}

export function EditableProfileHeader({ user, isOwner }: EditableProfileHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div 
        className={`flex gap-4 ${isOwner ? 'cursor-pointer hover:opacity-80 transition group' : ''}`}
        onClick={() => { if (isOwner) setIsOpen(true); }}
      >
        <div className="shrink-0 relative">
          <div className="w-16 h-16 bg-black overflow-hidden border border-[#111]">
            {user.image ? (
              <Image
                src={user.image}
                alt={user.name || "User"}
                width={64}
                height={64}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl bg-slate-800 text-white font-bold">
                {user.name?.charAt(0).toUpperCase() || "U"}
              </div>
            )}
          </div>
          {isOwner && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-white text-[10px] font-bold">Edit</span>
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center gap-0.5">
          <div className="flex items-center gap-1.5">
            {!user.isBanned && user.role && (
              <span className={getRoleBadge(user.role)} style={{ transform: "scale(1.2)", transformOrigin: "left center" }} />
            )}
            <h1 className={`text-xl font-bold shadow-sm flex items-center gap-2 ${user.isBanned ? 'text-white' : getRoleNameClass(user.role || 'member')}`} style={{ textShadow: "1px 1px 1px #000" }}>
              {user.name}
              {isOwner && <span className="text-[#888] text-[10px] opacity-0 group-hover:opacity-100 transition">(Click to edit)</span>}
            </h1>
          </div>
          <div className="text-[11px] text-[#ccc] font-semibold mt-0.5" style={{ textShadow: "1px 1px 1px #000" }}>
            {user.isBanned ? "Banned" : getRoleDisplayName(user.role || 'member')}
          </div>
        </div>
      </div>

      {isOpen && (
        <EditProfileModal user={user} onClose={() => setIsOpen(false)} />
      )}
    </>
  );
}
