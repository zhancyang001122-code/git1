import { ConversationHistory } from "@/components/chat/conversation-history";
import { DetailShell } from "@/components/layout/detail-shell";

export default function XiaozhiHistoryPage() {
  return (
    <DetailShell title="对话历史" backHref="/xiaozhi">
      <ConversationHistory />
    </DetailShell>
  );
}
