import { ChatExperience } from "@/components/chat/chat-experience";
import { DetailShell } from "@/components/layout/detail-shell";
import { DemoNotice } from "@/components/ui/demo-notice";
import { parseChatContext } from "@/features/chat/chat-context";

type Query = Record<string, string | string[] | undefined>;

export default async function NewChatRoute({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const result = parseChatContext(await searchParams);
  return (
    <DetailShell title="小智对话" backHref="/xiaozhi">
      {result.issues.length > 0 ? (
        <div className="px-4 pt-4">
          <DemoNotice>部分链接参数无效，已安全忽略。</DemoNotice>
        </div>
      ) : null}
      <ChatExperience initialContext={result.context} />
    </DetailShell>
  );
}
