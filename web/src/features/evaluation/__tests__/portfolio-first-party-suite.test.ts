import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  evaluatePortfolioGeneration,
  evaluatePortfolioRetrieval,
  portfolioEvaluationSuiteSchema,
  portfolioMaterialManifestSchema,
} from "@/features/evaluation/portfolio-first-party-suite";

const knowledgeDirectory = resolve(
  process.cwd(),
  "../knowledge-base/portfolio-first-party",
);
const repositoryRoot = resolve(process.cwd(), "..");

function loadJson(name: string): unknown {
  return JSON.parse(
    readFileSync(resolve(knowledgeDirectory, name), "utf8"),
  ) as unknown;
}

describe("portfolio first-party knowledge suite", () => {
  it("contains public, source-labelled materials without secret-shaped content", () => {
    const manifest = portfolioMaterialManifestSchema.parse(
      loadJson("manifest.json"),
    );

    expect(manifest.materialSet).toBe("portfolio_first_party");
    expect(manifest.materials.length).toBeGreaterThanOrEqual(4);
    expect(new Set(manifest.materials.map((item) => item.id)).size).toBe(
      manifest.materials.length,
    );

    for (const material of manifest.materials) {
      const content = readFileSync(
        resolve(knowledgeDirectory, material.file),
        "utf8",
      );
      expect(content).toContain("资料性质：作品集首方公开说明");
      expect(content.length).toBeGreaterThanOrEqual(300);
      expect(material.draft.title).toContain("作品集");
      expect(material.draft.sourceReference).toBe(
        `knowledge-base/portfolio-first-party/${material.file}`,
      );
      expect(content).not.toMatch(/\b(?:sb_secret_|sbp_|sk-[A-Za-z0-9_-]{12})/);
    }
  });

  it("contains twenty unique, traceable retrieval cases", () => {
    const manifest = portfolioMaterialManifestSchema.parse(
      loadJson("manifest.json"),
    );
    const suite = portfolioEvaluationSuiteSchema.parse(
      loadJson("evaluation-cases.json"),
    );
    const titles = new Set(
      manifest.materials.map((material) => material.draft.title),
    );
    const currentVersions = new Map(
      manifest.materials.map((material) => [
        material.draft.title,
        material.draft.versionLabel,
      ]),
    );

    expect(suite.materialSet).toBe("portfolio_first_party");
    expect(suite.cases).toHaveLength(20);
    expect(new Set(suite.cases.map((item) => item.id)).size).toBe(20);
    expect(
      suite.cases.filter((item) => item.category === "no_answer"),
    ).toHaveLength(4);
    expect(suite.cases.filter((item) => item.generation)).toHaveLength(4);
    expect(
      suite.cases
        .filter((item) => item.generation)
        .every(
          (item) => (item.expected.generationRequiredConcepts?.length ?? 0) > 0,
        ),
    ).toBe(true);

    for (const evaluationCase of suite.cases) {
      expect(evaluationCase.id).toMatch(/^portfolio-first-party-/);
      if (evaluationCase.category === "rag") {
        expect(evaluationCase.expected.requiredTitles.length).toBeGreaterThan(
          0,
        );
        for (const title of evaluationCase.expected.requiredTitles) {
          expect(titles.has(title)).toBe(true);
          expect(evaluationCase.expected.requiredVersionLabel).toBe(
            currentVersions.get(title),
          );
        }
      }
    }
  });

  it("keeps the public Production evidence aligned with four generation cases", () => {
    for (const path of [
      "README.md",
      "web/README.md",
      "docs/10-interview-guide.md",
      "docs/11-acceptance-criteria.md",
      "docs/15-knowledge-material-intake.md",
      "docs/task-reports/2026-08-13-portfolio-first-party-rag.md",
    ]) {
      const content = readFileSync(resolve(repositoryRoot, path), "utf8");
      expect(content, path).toContain("4/4");
      expect(content, path).not.toContain("3/3");
    }
  });

  it("scores citation provenance, concepts and no-answer behavior deterministically", () => {
    const positive = evaluatePortfolioRetrieval(
      {
        id: "portfolio-first-party-test",
        category: "rag",
        input: {
          query: "房源数据是哪年的？",
          domain: "housing",
          category: "portfolio_housing_boundary",
          city: null,
          topK: 5,
        },
        expected: {
          requiredTitles: ["小智作品集：历史房源数据边界"],
          requiredVersionLabel: "2026.08.1",
          requiredConcepts: ["2024-11", "不代表当前可租"],
          requireCitation: true,
          requireNonDemo: true,
          requireHighConfidence: true,
          expectNoCitations: false,
        },
      },
      {
        chunks: [
          {
            title: "小智作品集：历史房源数据边界",
            versionLabel: "2026.08.1",
            content: "数据周期为 2024-11，不代表当前可租。",
            isDemo: false,
            materialKind: "portfolio_first_party",
          },
        ],
        citations: [
          {
            title: "小智作品集：历史房源数据边界",
            versionLabel: "2026.08.1",
            isDemo: false,
            materialKind: "portfolio_first_party",
          },
        ],
        lowConfidence: false,
        conflict: false,
        isDemo: false,
      },
    );
    expect(positive).toMatchObject({ passed: true, score: 1, failures: [] });

    const noAnswer = evaluatePortfolioRetrieval(
      {
        id: "portfolio-first-party-no-answer-test",
        category: "no_answer",
        input: {
          query: "平台是否承诺所有商家倒闭三倍赔偿？",
          domain: "platform",
          category: "portfolio_unknown",
          city: null,
          topK: 5,
        },
        expected: {
          requiredTitles: [],
          requiredVersionLabel: "2026.08.1",
          requiredConcepts: [],
          requireCitation: false,
          requireNonDemo: true,
          requireHighConfidence: false,
          expectNoCitations: true,
        },
      },
      {
        chunks: [],
        citations: [],
        lowConfidence: true,
        conflict: false,
        isDemo: false,
      },
    );
    expect(noAnswer).toMatchObject({ passed: true, score: 1, failures: [] });
  });

  it("accepts explicit wording alternatives without weakening generation facts", () => {
    const result = evaluatePortfolioGeneration(
      {
        id: "portfolio-first-party-generation-alternative-test",
        category: "rag",
        input: {
          query: "千问负责什么？",
          domain: "platform",
          category: "portfolio_evidence_governance",
          city: null,
          topK: 5,
        },
        expected: {
          requiredTitles: ["小智作品集：AI 事实来源与知识治理"],
          requiredVersionLabel: "2026.08.1",
          requiredConcepts: ["规划工具调用"],
          generationRequiredConcepts: ["工具", ["事实来源", "事实的来源"]],
          requireCitation: true,
          requireNonDemo: true,
          requireHighConfidence: true,
          expectNoCitations: false,
        },
      },
      {
        assistantText: "千问会调用工具，但不是事实的来源。",
        toolSucceeded: true,
        citations: [
          {
            title: "小智作品集：AI 事实来源与知识治理",
            versionLabel: "2026.08.1",
            isDemo: false,
            materialKind: "portfolio_first_party",
          },
        ],
        errorCode: null,
      },
    );

    expect(result).toMatchObject({ passed: true, failures: [] });
  });
});
