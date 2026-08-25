"use client";

import { ImageOff } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/cn";

export interface BusinessCardImageProps {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  eager?: boolean;
}

export function BusinessCardImage({
  alt,
  className,
  eager = false,
  sizes,
  src,
}: BusinessCardImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={`${alt}（图片暂不可用）`}
        className={cn(
          "flex items-center justify-center overflow-hidden bg-surface-tint text-text-subtle",
          className,
        )}
      >
        <ImageOff aria-hidden="true" className="size-6" />
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden bg-surface-tint", className)}>
      <Image
        fill
        src={src}
        alt={alt}
        sizes={sizes}
        loading={eager ? "eager" : "lazy"}
        unoptimized
        onError={() => setFailed(true)}
        className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
      />
    </div>
  );
}
