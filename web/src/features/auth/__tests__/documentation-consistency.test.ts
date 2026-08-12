import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(process.cwd(), "..");

function repositoryFile(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), "utf8");
}

describe("current Auth documentation", () => {
  it("documents the deployed fixed demo login contract instead of the retired OTP flow", () => {
    const contract = repositoryFile("contracts/api-contracts.md");

    expect(contract).toContain("POST /api/auth/demo-login");
    expect(contract).toContain("DEMO_AUTH_EMAIL");
    expect(contract).toContain("DEMO_AUTH_PASSWORD");
    expect(contract).toContain("666666");
    expect(contract).not.toContain("POST /api/auth/otp/send");
    expect(contract).not.toContain("POST /api/auth/otp/verify");
    expect(contract).not.toContain("AUTH_ALLOWED_EMAIL");
  });

  it("keeps public project descriptions aligned with the Production Auth evidence", () => {
    for (const path of [
      "README.md",
      "web/README.md",
      "docs/17-beginner-learning-path.md",
    ]) {
      const content = repositoryFile(path);
      expect(content, path).toContain("固定演示码");
      expect(content, path).toContain("Production");
      expect(content, path).not.toMatch(
        /Production[^\n]{0,40}OTP[^\n]{0,40}(?:未|待)/i,
      );
    }
  });

  it("keeps the interview demo on the custom domain and fixed demo code", () => {
    const demoScript = repositoryFile("qa/demo-script.md");

    expect(demoScript).toContain("https://xiaozhi.zaneyang.xyz");
    expect(demoScript).toContain("666666");
    expect(demoScript).toContain("共享演示账号");
    expect(demoScript).not.toContain("xiaozhi-local-life.vercel.app");
    expect(demoScript).not.toContain("白名单邮箱");
  });

  it("makes the current first-party RAG material answer with the fixed demo account boundary", () => {
    const content = repositoryFile(
      "knowledge-base/portfolio-first-party/account-and-memory-boundary.md",
    );

    expect(content).toContain("666666");
    expect(content).toContain("共享");
    expect(content).toContain("Supabase Session");
    expect(content).toContain("RLS");
    expect(content).not.toContain("登录采用 Supabase Auth 邮箱 OTP");
    expect(content).not.toContain("仍是明确待办");
  });
});
