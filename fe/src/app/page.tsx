import { getInfiniteFeedPostsAction } from "@/actions/post.actions";
import { Feed } from "@/components/feed/Feed";

export const revalidate = 0; // Disable caching

export default async function Home() {
  const initialData = await getInfiniteFeedPostsAction({ limit: 10 });

  return (
    <main className="flex w-full max-w-2xl flex-col border-x min-h-screen">


      {/* Feed */}
      <Feed initialData={initialData} />
    </main>
  );
}
