import { DiscoverPage } from "@/components/pages/discover-page";
import { createRepositories } from "@/features/repositories";

export default async function Page() {
  const repositories = await createRepositories();
  const posts = await repositories.business.listCommunityPosts({ limit: 24 });
  return <DiscoverPage posts={posts.items} mode={repositories.mode} />;
}
