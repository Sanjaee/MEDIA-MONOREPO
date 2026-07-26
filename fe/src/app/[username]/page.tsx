import { getUserProfileByUsername } from "@/actions/user.actions";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Star, Home, Settings, Megaphone, Check } from "lucide-react";
import { getRoleBadge, getRoleNameClass, getRoleDisplayName } from "@/utils/roleStyles";
import { FollowButton } from "@/components/FollowButton";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { EditableProfileHeader } from "@/components/profile/EditableProfileHeader";

interface PageProps {
  params: {
    username: string;
  };
}

export default async function UserProfilePage({ params }: PageProps) {
  const { username } = await params;
  const user = await getUserProfileByUsername(username);

  if (!user) {
    notFound();
  }

  // Determine VIP or normal status for colors
  const isVip = user.role === "admin" || user.role === "vip";
  const nameColor = isVip ? "text-[#00ff00]" : "text-[#aaaaaa]";
  const borderBadgeColor = isVip ? "border-[#00ff00]" : "border-[#aaaaaa]";

  const joinedDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })
    : "Unknown";

  // Fetch the user data again because TS needs to know `recentPosts` exists, but we know it does from user.actions.ts
  const profileUser = user as any; // Cast since the interface wasn't exported
  const recentPosts = profileUser.recentPosts || [];

  const cookieStore = await cookies();
  const token = cookieStore.get("jwt")?.value || "";
  const session = await auth();

  return (
    <main className="w-full flex flex-col bg-[#111111] text-[#cccccc] min-h-screen font-sans text-sm ">
      {/* Top Breadcrumb */}
      <div className="flex items-center gap-2 p-3 bg-[#1b1b1b] border-b border-[#21425e]/30 text-xs">
        <Home size={14} className="text-[#888]" />
        <Link href="/" className="hover:text-white transition-colors">Home</Link>
        <span className="text-[#555]">&gt;</span>
        <span className="font-semibold text-white">Profile of {user.name}</span>
      </div>

      {/* Profile Header Banner */}
      <div className="w-full bg-[#21425e] border border-[#333] p-4 flex gap-4 mt-4 shadow-sm">
        <EditableProfileHeader 
          user={user} 
          isOwner={(session as any)?.user?.id === user.id} 
        />

        <div className="flex flex-col justify-end ml-auto">
          <div className="text-[11px] mt-1 flex flex-wrap items-center gap-2" style={{ textShadow: "1px 1px 1px #000" }}>
            <div>
              <span className="text-white">Status:</span> <span className="text-[#00ff00] font-semibold">Online</span> <span className="text-white">(Reading Thread Simple-ish questions @ 09:20 AM)</span>
            </div>
            {!user.isBanned && (session as any)?.user?.id !== user.id && (
              <>
                <Link href={`/messages?userId=${user.id}`} className="bg-primary/20 text-primary border border-primary px-2 py-0.5 rounded shadow hover:bg-primary hover:text-black transition">
                  Send Message
                </Link>
                <FollowButton targetUserId={user.id} initialIsFollowing={false} token={token} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Banned Notice Box */}
      {user.isBanned && (
        <fieldset className="mt-4 border border-[#cc0000] p-3 text-xs shadow-sm">
          <legend className="text-white font-bold px-1 ml-2 text-sm">This forum account is currently banned.</legend>
          <div className="flex flex-col gap-1.5 mt-1">
            <div className="text-[#cccccc] italic">
              Ban Reason: Potential Bot
            </div>
            <div className="text-white">
              <span className="font-bold">Banned By:</span> Admin — <span className="font-bold">Ban Length:</span> Permanent (N/A remaining)
            </div>
          </div>
        </fieldset>
      )}

      {/* Main 3 Columns */}
      <div className="flex flex-col md:flex-row gap-2 mt-4">

        {/* Column 1: Forum Info */}
        <div className="flex flex-col w-full md:w-[30%] bg-[#1b1b1b] border border-[#333]">
          <div className="bg-[#21425e] text-white p-2 text-xs font-semibold">
            {user.name}'s Forum Info
          </div>
          <div className="p-4 flex flex-col gap-5 text-xs">
            {!user.isBanned && (
              <div className={`border w-full py-2 text-center font-bold tracking-widest ${borderBadgeColor} ${nameColor}`}>
                {user.role === "admin" ? "ADMIN" : isVip ? "VIP" : "MEMBER"}
              </div>
            )}

            <div>
              <div className="text-[#888] mb-0.5">Joined:</div>
              <div className="text-[#ccc]">{joinedDate}</div>
            </div>

            <div>
              <div className="text-[#888] mb-0.5">Time Spent Online:</div>
              <div className="text-[#ccc]">Active recently</div>
            </div>

            <div>
              <div className="text-[#888] mb-0.5">User Identifier:</div>
              <div className="text-[#ccc] flex flex-wrap items-center gap-1">
                {user.id.substring(0, 8)}
                <button className="text-[#4a90e2] font-semibold hover:underline whitespace-nowrap">[Copy Profile Permalink]</button>
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Forum Statistics */}
        <div className="flex flex-col w-full md:w-[40%] bg-[#1b1b1b] border border-[#333]">
          <div className="bg-[#21425e] text-white p-2 text-xs font-semibold">
            {user.name}'s Forum Statistics
          </div>
          <div className="p-4 flex flex-col gap-5 text-xs">
            <div>
              <div className="text-[#888] mb-0.5">Total Threads:</div>
              <div className="text-[#ccc]">{user.stats.totalThreads} <span className="text-[#888]"></span></div>
            </div>

            <div>
              <div className="text-[#888] mb-0.5">Total Posts:</div>
              <div className="text-[#ccc]">{user.stats.totalPosts} <span className="text-[#888]"></span></div>
            </div>

            <div>
              <div className="text-[#888] mb-0.5">Reputation:</div>
              <div className="flex justify-between items-center text-[#ccc]">
                <span>{user.stats.reputation}</span>
                <button className="flex items-center gap-1 text-[#4a90e2] hover:underline font-semibold">
                  <Settings size={12} /> Details
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Awards & Activities */}
        <div className="flex flex-col w-full md:w-[30%] bg-[#1b1b1b] border border-[#333]">
          <div className="bg-[#21425e] text-white p-2 text-xs font-semibold">
            {user.name}'s awards.
          </div>
          <div className="p-4 flex flex-col gap-4 text-xs">
            <div className="text-[#888]">
              This user has no awards at this time
            </div>

            <div className="mt-2 flex flex-col gap-2">
              {recentPosts.length > 0 ? (
                recentPosts.map((post: any) => (
                  <div key={post.id} className="bg-[#1b1b1b] border border-[#333] p-3 flex flex-col gap-1">
                    <div className="bg-[#21425e] w-max text-white text-[10px] px-1.5 py-0.5 font-bold rounded-sm shadow-sm">
                      New Thread
                    </div>
                    <div className="text-white font-bold truncate mt-1">
                      {post.content && post.content.length > 40 ? post.content.substring(0, 40) + "..." : (post.content || "Attached media")}
                    </div>
                    <div className="text-[#888] text-[10px]">
                      In Introductions
                    </div>
                    <div className="text-[#888] text-[10px] mt-0.5 flex items-center gap-1">
                      <span>{new Date(post.createdAt).toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })} at {new Date(post.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span>💬 {post.stats?.replies || 0}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-[#888] mt-4">
                  No activities found from this user.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

    </main>
  );
}
