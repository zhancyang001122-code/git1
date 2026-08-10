export interface DemoKnowledgeCandidate {
  id: string;
  title: string;
  domain: string;
  status: "reviewing" | "draft" | "rejected";
  trigger: string;
  currentKnowledge: string;
  draft: string;
  evidence: string;
  embeddingStatus: "not_started" | "ready" | "failed";
  evalScore: number | null;
}

export const demoKnowledgeCandidates: readonly DemoKnowledgeCandidate[] = [
  {
    id: "candidate-refund-001",
    title: "团购退款需补充预约限制",
    domain: "团购规则",
    status: "reviewing",
    trigger: "用户点踩并提交纠正建议",
    currentKnowledge: "未使用且有效期内可申请退款。",
    draft:
      "未使用且有效期内可申请退款；已预约套餐需先取消预约，并以商家规则为准。",
    evidence: "演示客服记录 DEMO-EVIDENCE-01",
    embeddingStatus: "not_started",
    evalScore: null,
  },
  {
    id: "candidate-pet-002",
    title: "宠物友好房源核验清单",
    domain: "租房规则",
    status: "draft",
    trigger: "房源字段与合同条款存在差异",
    currentKnowledge: "房源记录包含 pets_allowed 字段。",
    draft: "宠物字段仅作初筛，签约前需核验合同、品种限制和公共区域规则。",
    evidence: "演示合同摘录 DEMO-EVIDENCE-02",
    embeddingStatus: "not_started",
    evalScore: null,
  },
  {
    id: "candidate-delivery-003",
    title: "配送超时补偿说明",
    domain: "配送规则",
    status: "rejected",
    trigger: "低置信回答进入人工审核",
    currentKnowledge: "暂无已发布条款。",
    draft: "配送超时自动补偿。",
    evidence: "缺少可验证证据",
    embeddingStatus: "failed",
    evalScore: 0.42,
  },
] as const;
