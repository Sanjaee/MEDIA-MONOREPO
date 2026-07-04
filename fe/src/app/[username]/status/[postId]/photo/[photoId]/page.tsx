import { PhotoModal } from "@/components/feed/PhotoModal";
import { getPostById } from "@/actions/post.actions";
import { notFound } from "next/navigation";

export default async function PhotoPage({
  params,
}: {
  params: Promise<{ postId: string; photoId: string }>;
}) {
  const { postId, photoId } = await params;
  const post = await getPostById(postId);

  if (!post) {
    notFound();
  }

  return (
    <div className="h-screen w-full bg-black">
      <PhotoModal post={post} photoId={photoId} />
    </div>
  );
}
