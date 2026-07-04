import { auth } from "@/auth";
import { getNewsFeedAction } from "@/actions/news.actions";
import { NewsFeed } from "@/components/news/NewsFeed";
import { Newspaper } from "lucide-react";

export const metadata = {
  title: "News | AntiGravity",
  description: "Latest news and updates",
};

export const revalidate = 0; // Disable caching

export default async function NewsPage() {
  const session = await auth();
  
  const initialNews = await getNewsFeedAction({ limit: 10 });

  return (
    <main className="flex w-full max-w-2xl flex-col border-x min-h-screen">
      <div className="sticky top-0 z-10 flex items-center gap-4 bg-background/80 px-4 py-3 backdrop-blur-md border-b">
        <Newspaper className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold">News</h1>
      </div>
      <div className="flex-1 min-h-screen">
        <NewsFeed initialData={initialNews} />
      </div>
    </main>
  );
}
