import { PhotoModal } from "@/components/feed/PhotoModal";
import { getPostById } from "@/actions/post.actions";
import { notFound } from "next/navigation";

export default async function PhotoModalInterceptedPage({
  params,
}: {
  params: Promise<{ postId: string; photoId: string }>;
}) {
  const { postId, photoId } = await params;
  const post = await getPostById(postId);

  if (!post) {
    notFound();
  }

  return <PhotoModal post={post} photoId={photoId} />;
}
