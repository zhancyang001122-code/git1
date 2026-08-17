export const PRODUCTION_INTERVIEW_URL = "https://xiaozhi.zaneyang.xyz";

const requiredServices = ["supabase", "qwen", "amap", "housing"];

export function assertLiveHealth(health) {
  const valid =
    health?.app === "xiaozhi" &&
    health?.mode === "live" &&
    requiredServices.every(
      (service) => health?.services?.[service] === "configured",
    );
  if (!valid) {
    throw new Error("Production Live health is not fully configured");
  }
}

export function assertBranchDeployment({ localCommit, deployedCommit }) {
  if (localCommit !== deployedCommit) {
    throw new Error("Production deployment does not match the current commit");
  }
}

export function assertInvalidRequestBoundary({ status, errorCode, body }) {
  if (
    status !== 400 ||
    errorCode !== "INVALID_CHAT_REQUEST" ||
    body?.error?.code !== "INVALID_CHAT_REQUEST"
  ) {
    throw new Error("Production invalid request boundary is unstable");
  }
}

export function assertFirstPartyRag(result) {
  const citations = result?.citations ?? [];
  const valid =
    result?.toolSucceeded === true &&
    result?.errorCode === null &&
    result?.assistantText?.includes("工具") &&
    /事实(?:的)?来源/.test(result.assistantText) &&
    citations.length > 0 &&
    citations.every(
      (citation) =>
        citation.materialKind === "portfolio_first_party" &&
        typeof citation.versionLabel === "string" &&
        citation.versionLabel.length > 0 &&
        typeof citation.effectiveFrom === "string" &&
        citation.effectiveFrom.length > 0,
    ) &&
    citations.some(
      (citation) => citation.title === "小智作品集：AI 事实来源与知识治理",
    );
  if (!valid) {
    throw new Error("Production first-party RAG evidence is incomplete");
  }
}

export function assertLiveAmap({ status, body }) {
  const valid =
    status === 200 &&
    body?.mode === "live" &&
    body?.data?.name === "武林广场" &&
    Number.isFinite(body?.data?.point?.longitude) &&
    Number.isFinite(body?.data?.point?.latitude);
  if (!valid) {
    throw new Error("Production AMap probe did not return a Live location");
  }
}
