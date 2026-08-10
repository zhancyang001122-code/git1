import { notFound } from "next/navigation";

import { ChatExperience } from "@/components/chat/chat-experience";
import { DetailShell } from "@/components/layout/detail-shell";

const ids = [
  "demo-housing",
  "demo-refund",
  "demo-grocery",
  "demo-nearby",
] as const;

export function generateStaticParams() {
  return ids.map((conversationId) => ({ conversationId }));
}

export default async function ExistingChatRoute({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  if (!ids.includes(conversationId as (typeof ids)[number])) notFound();
  return (
    <DetailShell title="演示会话" backHref="/xiaozhi/history">
      <ChatExperience
        conversationId={conversationId}
        initialContext={{ debug: false }}
      />
    </DetailShell>
  );
}
