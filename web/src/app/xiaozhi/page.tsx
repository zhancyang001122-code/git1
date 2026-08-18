import { XiaozhiWelcomePage } from "@/components/pages/xiaozhi-welcome-page";
import { publicEnv } from "@/lib/env";

export default function Page() {
  const mode = publicEnv().NEXT_PUBLIC_DEMO_MODE ? "demo" : "live";
  return <XiaozhiWelcomePage mode={mode} />;
}
