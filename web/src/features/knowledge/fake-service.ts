import { citationFromHit } from "@/features/knowledge/citations";
import { findPublishedDemoKnowledge } from "@/features/knowledge-ops/demo-store";
import { planKnowledgeQuery } from "@/features/knowledge/query-planner";
import type {
  IndexResult,
  KnowledgeHit,
  KnowledgeSearchInput,
  KnowledgeSearchResult,
  KnowledgeService,
} from "@/features/knowledge/types";
import { AppError } from "@/lib/errors";

const fixtures: readonly KnowledgeHit[] = [
  {
    chunkId: "63000000-0000-0000-0000-000000000001",
    articleId: "61000000-0000-0000-0000-000000000001",
    versionId: "62000000-0000-0000-0000-000000000001",
    chunkIndex: 0,
    title: "团购券退款规则",
    versionLabel: "v1.0",
    effectiveFrom: "2026-08-01",
    effectiveUntil: null,
    articleStatus: "published",
    versionStatus: "published",
    content:
      "演示规则：未使用、未核销且仍在有效期内的团购券可申请退款；页面明确标注的不可退套餐除外，已核销或已过期的券不适用。",
    metadata: {
      domain: "group_buy",
      category: "refund",
      city: "杭州",
      isDemo: true,
    },
    vectorScore: 0.86,
    textScore: 0.82,
    combinedScore: 0.846,
    score: 0.846,
    isDemo: true,
  },
  {
    chunkId: "63000000-0000-0000-0000-000000000003",
    articleId: "61000000-0000-0000-0000-000000000003",
    versionId: "62000000-0000-0000-0000-000000000003",
    chunkIndex: 0,
    title: "租房押金退还说明",
    versionLabel: "v1.0",
    effectiveFrom: "2026-08-01",
    effectiveUntil: null,
    articleStatus: "published",
    versionStatus: "published",
    content:
      "演示规则：押金退还需先完成退租验收并核对合同约定；知识库未提供固定到账天数，不能承诺具体到账日期。",
    metadata: {
      domain: "housing",
      category: "deposit",
      city: "杭州",
      isDemo: true,
    },
    vectorScore: 0.81,
    textScore: 0.79,
    combinedScore: 0.803,
    score: 0.803,
    isDemo: true,
  },
  {
    chunkId: "63000000-0000-0000-0000-000000000004",
    articleId: "61000000-0000-0000-0000-000000000004",
    versionId: "62000000-0000-0000-0000-000000000004",
    chunkIndex: 0,
    title: "超市配送异常处理",
    versionLabel: "v1.0",
    effectiveFrom: "2026-08-01",
    effectiveUntil: null,
    articleStatus: "published",
    versionStatus: "published",
    content:
      "演示规则：配送超时需先核对订单状态和配送记录；无法履约时提交客服处理，不得自行承诺赔付金额。",
    metadata: {
      domain: "market",
      category: "delivery",
      city: "杭州",
      isDemo: true,
    },
    vectorScore: 0.8,
    textScore: 0.77,
    combinedScore: 0.7895,
    score: 0.7895,
    isDemo: true,
  },
  {
    chunkId: "63000000-0000-0000-0000-000000000005",
    articleId: "61000000-0000-0000-0000-000000000005",
    versionId: "62000000-0000-0000-0000-000000000005",
    chunkIndex: 0,
    title: "账号与隐私说明",
    versionLabel: "v1.0",
    effectiveFrom: "2026-08-01",
    effectiveUntil: null,
    articleStatus: "published",
    versionStatus: "published",
    content:
      "演示规则：删除账号或处理个人信息前必须验证本人身份；具体保留期限以当前隐私政策版本为准。",
    metadata: {
      domain: "platform",
      category: "privacy",
      city: null,
      isDemo: true,
    },
    vectorScore: 0.79,
    textScore: 0.75,
    combinedScore: 0.776,
    score: 0.776,
    isDemo: true,
  },
];

function relevantFixture(query: string): KnowledgeHit | null {
  if (/押金|退租|验房|房屋损坏/.test(query)) return fixtures[1]!;
  if (/配送|送达|骑手/.test(query)) return fixtures[2]!;
  if (/隐私|个人信息|删除账号|注销账号/.test(query)) return fixtures[3]!;
  if (/退|退款|团购券/.test(query)) return fixtures[0]!;
  return null;
}

export class FakeKnowledgeService implements KnowledgeService {
  async search(input: KnowledgeSearchInput): Promise<KnowledgeSearchResult> {
    const queryPlan = planKnowledgeQuery(input);
    const asksExpiredGuarantee =
      /(?:过期|两天|2天).*(?:退|退款)|(?:退|退款).*(?:过期|两天|2天)/.test(
        input.query,
      );
    const publishedDemo = findPublishedDemoKnowledge(input.query);
    const fixture =
      publishedDemo ??
      (asksExpiredGuarantee ? null : relevantFixture(input.query));
    const chunks = fixture ? [fixture] : [];
    return {
      chunks,
      citations: chunks.map(citationFromHit),
      lowConfidence: chunks.length === 0,
      conflict: false,
      queryPlan,
      warnings: ["DEMO_KNOWLEDGE"],
      rankingStrategy: "demo",
      isDemo: true,
    };
  }

  async indexVersion(): Promise<IndexResult> {
    throw new AppError({
      code: "KNOWLEDGE_INDEX_DEMO_ONLY",
      message: "演示模式不会写入或发布知识索引",
      status: 409,
    });
  }
}
