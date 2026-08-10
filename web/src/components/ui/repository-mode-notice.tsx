import { DemoNotice } from "@/components/ui/demo-notice";
import type { RepositoryMode } from "@/features/repositories";

export function RepositoryModeNotice({
  className,
  mode,
}: {
  className?: string;
  mode: RepositoryMode;
}) {
  if (mode.mode === "supabase") return null;
  return (
    <DemoNotice className={className}>
      {mode.reason ?? "当前使用演示数据"}
    </DemoNotice>
  );
}
