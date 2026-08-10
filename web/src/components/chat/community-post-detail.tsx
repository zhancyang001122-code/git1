import { Bot, Heart, MapPin, MessageCircle } from "lucide-react";
import Link from "next/link";

import { BusinessCardImage } from "@/components/business/business-card-image";
import { DemoNotice } from "@/components/ui/demo-notice";
import { SourceBadge } from "@/components/ui/source-badge";
import { Tag } from "@/components/ui/tag";
import type { CommunityPost } from "@/features/business/domain";
import { buildChatHref } from "@/features/chat/chat-context";

export function CommunityPostDetail({ post }: { post: CommunityPost }) {
  const chatHref = buildChatHref({
    prompt: `请结合这篇社区内容给我建议：${post.title}`,
    source: "community_post",
    entityId: post.id,
    debug: false,
  });
  return (
    <div className="space-y-5 pb-6">
      <BusinessCardImage
        src={post.coverImageSrc}
        alt={`${post.title}的演示封面`}
        sizes="430px"
        className="aspect-[16/10]"
        eager
      />
      <div className="space-y-5 px-4">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <Tag>{post.category}</Tag>
            <SourceBadge source="supabase_mock" />
          </div>
          <h2 className="text-2xl font-semibold leading-8 text-text">
            {post.title}
          </h2>
          <p className="text-sm text-text-muted">
            {post.authorName} · <MapPin className="inline size-3.5" />{" "}
            {post.locationLabel}
          </p>
          <p className="text-base leading-7 text-text">{post.content}</p>
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
          <p className="flex gap-4 text-xs text-text-subtle">
            <span className="flex items-center gap-1">
              <Heart className="size-3.5" />
              {post.likeCount}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="size-3.5" />
              {post.commentCount}
            </span>
          </p>
        </section>
        <DemoNotice>
          这是社区演示内容，不能作为实时路况、商家状态或正式政策依据。
        </DemoNotice>
        <Link
          href={chatHref}
          aria-label="带着这篇内容问小智"
          className="flex min-h-12 items-center justify-center gap-2 rounded-control bg-brand px-4 text-sm font-semibold text-white"
        >
          <Bot className="size-4" />
          带着这篇内容问小智
        </Link>
      </div>
    </div>
  );
}
