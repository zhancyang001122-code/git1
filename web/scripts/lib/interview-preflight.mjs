export function assertBranchDeployment({
  localCommit,
  remoteCommit,
  statuses,
}) {
  if (localCommit !== remoteCommit) {
    throw new Error("Local commit does not match the remote interview branch");
  }
  const vercel = statuses.find((status) => status.context === "Vercel");
  if (vercel?.state !== "success") {
    throw new Error(
      "Vercel deployment is not successful for the current commit",
    );
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

export function expectedBackupFiles() {
  return [
    "index.html",
    "production-qr.png",
    "recording-evidence.json",
    "screens/index.html",
    "videos/01-housing-amap.webm",
    "videos/02-first-party-rag.webm",
    "videos/03-commerce-preference.webm",
  ];
}
