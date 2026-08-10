import Image from "next/image";

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
  return (
    <div className={cn("relative overflow-hidden bg-surface-tint", className)}>
      <Image
        fill
        src={src}
        alt={alt}
        sizes={sizes}
        loading={eager ? "eager" : "lazy"}
        className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
      />
    </div>
  );
}
