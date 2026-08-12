import { z } from "zod";

const isoDate = z.iso.date();
const materialSet = z.literal("portfolio_first_party");
const knowledgeDomains = [
  "housing",
  "group_buy",
  "market",
  "platform",
] as const;

const materialDraftSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    changeSummary: z.string().trim().min(2).max(500),
    sourceReference: z.string().trim().min(3).max(500),
    owner: z.string().trim().min(2).max(120),
    domain: z.enum(knowledgeDomains),
    category: z
      .string()
      .trim()
      .regex(/^[a-z][a-z0-9_-]{1,79}$/),
    versionLabel: z.string().trim().min(1).max(80),
    effectiveFrom: isoDate,
    effectiveUntil: isoDate.optional(),
  })
  .strict();

export const portfolioMaterialManifestSchema = z
  .object({
    materialSet,
    version: z.string().trim().min(1).max(40),
    public: z.literal(true),
    owner: z.string().trim().min(2).max(120),
    materials: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z][a-z0-9_-]{2,79}$/),
            file: z.string().regex(/^[a-z0-9][a-z0-9-]*\.md$/),
            question: z.string().trim().min(2).max(500),
            draft: materialDraftSchema,
          })
          .strict(),
      )
      .min(4)
      .max(20),
  })
  .strict();

const retrievalInputSchema = z
  .object({
    query: z.string().trim().min(2).max(500),
    domain: z.enum(knowledgeDomains).nullable(),
    category: z.string().trim().min(1).max(80).nullable(),
    city: z.string().trim().min(1).max(40).nullable(),
    topK: z.number().int().min(1).max(8),
  })
  .strict();

const retrievalExpectationSchema = z
  .object({
    requiredTitles: z.array(z.string().trim().min(2).max(160)).max(8),
    requiredVersionLabel: z.string().trim().min(1).max(80),
    requiredConcepts: z.array(z.string().trim().min(1).max(160)).max(20),
    generationRequiredConcepts: z
      .array(
        z.union([
          z.string().trim().min(1).max(160),
          z.array(z.string().trim().min(1).max(160)).min(2).max(6),
        ]),
      )
      .max(12)
      .optional(),
    requireCitation: z.boolean(),
    requireNonDemo: z.boolean(),
    requireHighConfidence: z.boolean(),
    expectNoCitations: z.boolean(),
  })
  .strict();

const portfolioEvaluationCaseSchema = z
  .object({
    id: z.string().regex(/^portfolio-first-party-[a-z0-9-]{3,80}$/),
    category: z.enum(["rag", "no_answer"]),
    input: retrievalInputSchema,
    expected: retrievalExpectationSchema,
    generation: z.boolean().optional(),
  })
  .strict();

export const portfolioEvaluationSuiteSchema = z
  .object({
    materialSet,
    version: z.string().trim().min(1).max(40),
    cases: z.array(portfolioEvaluationCaseSchema).min(20).max(40),
  })
  .strict();

const retrievedChunkSchema = z
  .object({
    title: z.string(),
    versionLabel: z.string(),
    content: z.string(),
    isDemo: z.boolean().default(false),
    materialKind: z
      .enum(["demo", "portfolio_first_party", "external_authorized"])
      .optional(),
  })
  .passthrough();
const retrievedCitationSchema = z
  .object({
    title: z.string(),
    versionLabel: z.string(),
    isDemo: z.boolean().default(false),
    materialKind: z
      .enum(["demo", "portfolio_first_party", "external_authorized"])
      .optional(),
  })
  .passthrough();

export const portfolioKnowledgeSearchResultSchema = z
  .object({
    chunks: z.array(retrievedChunkSchema),
    citations: z.array(retrievedCitationSchema),
    lowConfidence: z.boolean(),
    conflict: z.boolean(),
    isDemo: z.boolean(),
  })
  .passthrough();

export type PortfolioMaterialManifest = z.infer<
  typeof portfolioMaterialManifestSchema
>;
export type PortfolioEvaluationSuite = z.infer<
  typeof portfolioEvaluationSuiteSchema
>;
export type PortfolioEvaluationCase = z.infer<
  typeof portfolioEvaluationCaseSchema
>;
export type PortfolioKnowledgeSearchResult = z.infer<
  typeof portfolioKnowledgeSearchResultSchema
>;

export interface PortfolioEvaluationResult {
  passed: boolean;
  score: number;
  failures: string[];
  checks: Readonly<Record<string, boolean>>;
}

function containsConcept(content: string, concept: string): boolean {
  return content
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .includes(concept.normalize("NFKC").toLocaleLowerCase("zh-CN"));
}

function containsRequiredConcept(
  content: string,
  requirement: string | readonly string[],
): boolean {
  return typeof requirement === "string"
    ? containsConcept(content, requirement)
    : requirement.some((concept) => containsConcept(content, concept));
}

export function evaluatePortfolioRetrieval(
  evaluationCase: PortfolioEvaluationCase,
  actualInput: PortfolioKnowledgeSearchResult,
): PortfolioEvaluationResult {
  const actual = portfolioKnowledgeSearchResultSchema.parse(actualInput);
  const expected = evaluationCase.expected;
  const chunkContent = actual.chunks.map((chunk) => chunk.content).join("\n");
  const chunkTitles = new Set(actual.chunks.map((chunk) => chunk.title));
  const citationTitles = new Set(
    actual.citations.map((citation) => citation.title),
  );
  const matchingVersions = [
    ...actual.chunks.filter((chunk) =>
      expected.requiredTitles.includes(chunk.title),
    ),
    ...actual.citations.filter((citation) =>
      expected.requiredTitles.includes(citation.title),
    ),
  ].map((item) => item.versionLabel);

  const checks: Record<string, boolean> = {
    requiredTitles: expected.requiredTitles.every((title) =>
      chunkTitles.has(title),
    ),
    requiredVersion:
      expected.requiredTitles.length === 0 ||
      (matchingVersions.length > 0 &&
        matchingVersions.every(
          (version) => version === expected.requiredVersionLabel,
        )),
    requiredConcepts: expected.requiredConcepts.every((concept) =>
      containsConcept(chunkContent, concept),
    ),
    citation:
      !expected.requireCitation ||
      (actual.citations.length > 0 &&
        expected.requiredTitles.every((title) => citationTitles.has(title))),
    sourceScope:
      actual.chunks.every((chunk) =>
        expected.requiredTitles.includes(chunk.title),
      ) &&
      actual.citations.every((citation) =>
        expected.requiredTitles.includes(citation.title),
      ),
    nonDemo:
      !expected.requireNonDemo ||
      (!actual.isDemo &&
        actual.chunks.every((chunk) => !chunk.isDemo) &&
        actual.citations.every((citation) => !citation.isDemo) &&
        actual.chunks.every(
          (chunk) => chunk.materialKind === "portfolio_first_party",
        ) &&
        actual.citations.every(
          (citation) => citation.materialKind === "portfolio_first_party",
        )),
    confidence:
      !expected.requireHighConfidence ||
      (!actual.lowConfidence && !actual.conflict),
    noCitations:
      !expected.expectNoCitations ||
      (actual.lowConfidence &&
        actual.chunks.length === 0 &&
        actual.citations.length === 0),
  };
  const failures = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
  const passedCount = Object.values(checks).filter(Boolean).length;
  return {
    passed: failures.length === 0,
    score: passedCount / Object.keys(checks).length,
    failures,
    checks,
  };
}

export function evaluatePortfolioGeneration(
  evaluationCase: PortfolioEvaluationCase,
  actual: {
    assistantText: string;
    toolSucceeded: boolean;
    citations: readonly {
      title: string;
      versionLabel: string;
      isDemo?: boolean;
      materialKind?: "demo" | "portfolio_first_party" | "external_authorized";
    }[];
    errorCode: string | null;
  },
): PortfolioEvaluationResult {
  const expected = evaluationCase.expected;
  const citationTitles = new Set(actual.citations.map((item) => item.title));
  const checks: Record<string, boolean> = {
    completed:
      actual.errorCode === null && actual.assistantText.trim().length > 0,
    knowledgeTool: actual.toolSucceeded,
    answerFacts: (expected.generationRequiredConcepts ?? []).every((concept) =>
      containsRequiredConcept(actual.assistantText, concept),
    ),
    citation: expected.requiredTitles.every((title) =>
      citationTitles.has(title),
    ),
    sourceScope: actual.citations.every((citation) =>
      expected.requiredTitles.includes(citation.title),
    ),
    version: actual.citations
      .filter((item) => expected.requiredTitles.includes(item.title))
      .every((item) => item.versionLabel === expected.requiredVersionLabel),
    nonDemo:
      !expected.requireNonDemo ||
      actual.citations.every((citation) => citation.isDemo !== true),
    provenance: actual.citations
      .filter((item) => expected.requiredTitles.includes(item.title))
      .every((item) => item.materialKind === "portfolio_first_party"),
  };
  const failures = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
  const passedCount = Object.values(checks).filter(Boolean).length;
  return {
    passed: failures.length === 0,
    score: passedCount / Object.keys(checks).length,
    failures,
    checks,
  };
}
