import { notFound } from "next/navigation";

import { CommunityPostDetail } from "@/components/chat/community-post-detail";
import { DetailShell } from "@/components/layout/detail-shell";
import { demoCommunityPosts } from "@/features/business/demo-data";

export function generateStaticParams() {
  return demoCommunityPosts.map((post) => ({ id: post.id }));
}

export default async function CommunityPostRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = demoCommunityPosts.find((item) => item.id === id);
  if (!post) notFound();
  return (
    <DetailShell title="社区详情" backHref="/discover">
      <CommunityPostDetail post={post} />
    </DetailShell>
  );
}
