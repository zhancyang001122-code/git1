import { Heart, MapPin, MessageCircle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { BusinessCardImage } from "@/components/business/business-card-image";
import { SourceBadge } from "@/components/ui/source-badge";
import { Tag } from "@/components/ui/tag";
import type { CommunityPost } from "@/features/business/domain";

export interface CommunityPostCardProps {
  post: CommunityPost;
  actions?: ReactNode;
  eager?: boolean;
}

export function CommunityPostCard({
  actions,
  eager,
  post,
}: CommunityPostCardProps) {
  return (
    <article className="glass-panel group overflow-hidden rounded-card">
      <Link
        href={`/discover/${post.id}`}
        className="ui-interactive block border border-transparent outline-none"
      >
        <BusinessCardImage
          src={post.coverImageSrc}
          alt={`${post.title}的演示社区封面`}
          sizes="(max-width: 430px) 50vw, 215px"
          className="aspect-[4/3]"
          eager={eager}
        />
        <div className="space-y-2 p-3">
          <Tag>{post.category}</Tag>
          <h2 className="line-clamp-2 text-base font-semibold leading-6 text-text">
            {post.title}
          </h2>
          <p className="line-clamp-2 text-xs leading-5 text-text-muted">
            {post.excerpt}
          </p>
          <p className="flex items-center gap-1 text-xs text-text-subtle">
            <MapPin aria-hidden="true" className="size-3.5" />
            {post.locationLabel}
          </p>
          <div className="flex items-center justify-between gap-2 text-xs text-text-subtle">
            <span className="truncate">{post.authorName}</span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="flex items-center gap-1">
                <Heart aria-hidden="true" className="size-3.5" />
                {post.likeCount}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle aria-hidden="true" className="size-3.5" />
                {post.commentCount}
              </span>
            </span>
          </div>
          <SourceBadge source="supabase_mock" />
        </div>
      </Link>
      {actions ? (
        <div className="border-t border-border p-3">{actions}</div>
      ) : null}
    </article>
  );
}
