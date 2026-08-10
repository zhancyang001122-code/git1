import { notFound } from "next/navigation";

import { CommunityPostDetail } from "@/components/chat/community-post-detail";
import { DetailShell } from "@/components/layout/detail-shell";
import { RepositoryModeNotice } from "@/components/ui/repository-mode-notice";
import { createRepositories } from "@/features/repositories";

export default async function CommunityPostRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repositories = await createRepositories();
  const post = await repositories.business.getCommunityPost(id);
  if (!post) notFound();
  return (
    <DetailShell title="社区详情" backHref="/discover">
      <RepositoryModeNotice className="mx-4 mt-4" mode={repositories.mode} />
      <CommunityPostDetail post={post} />
    </DetailShell>
  );
}
