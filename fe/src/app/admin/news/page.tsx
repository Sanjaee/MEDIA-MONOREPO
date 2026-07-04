import { auth } from "@/auth";
import { getNewsFeedAction } from "@/actions/news.actions";
import { CreateNews } from "@/components/news/CreateNews";
import { NewsFeed } from "@/components/news/NewsFeed";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Admin - News Management | AntiGravity",
  description: "Manage news posts",
};

export const revalidate = 0; // Disable caching

export default async function AdminNewsPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const isAdminOrOwner = role === "admin" || role === "owner";
  
  if (!isAdminOrOwner) {
    redirect("/");
  }
  
  const initialNews = await getNewsFeedAction({ limit: 10 });

  return (
    <div className="flex w-full flex-col p-6 max-w-4xl mx-auto gap-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">News Management</h1>
        <p className="text-muted-foreground">Create and preview news posts here.</p>
      </div>
      
      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <CreateNews />
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">Live Preview</h2>
        <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
          <NewsFeed initialData={initialNews} />
        </div>
      </div>
    </div>
  );
}
