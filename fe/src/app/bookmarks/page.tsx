import { getInfiniteBookmarkedPostsAction } from "@/actions/post.actions";
import { BookmarksFeed } from "@/components/feed/BookmarksFeed";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const metadata: Metadata = {
  title: "Bookmarks",
};

export const revalidate = 0; // Disable caching

export default async function BookmarksPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  const initialData = await getInfiniteBookmarkedPostsAction({ limit: 10 });

  return (
    <main className="flex w-full max-w-2xl flex-col border-x min-h-screen">
      <div className="sticky top-0 z-10 border-b bg-background/80 px-4 py-3 backdrop-blur-md">
        <h1 className="text-xl font-bold">Bookmarks</h1>
      </div>
      <BookmarksFeed initialData={initialData} />
    </main>
  );
}
