const knowledgePolicyQuestion =
  /(?:退款|退押金|押金退还|配送规则|政策|规则|条款|隐私政策|账号注销|删除账号|长期记忆|数据保留|知识库|证据来源)/u;

const housingDatasetQuestion =
  /(?:房源数据|历史房源).*(?:哪一?期|时间|月份|多少条|总量|来源|当前|现在|实时|可租)|(?:哪一?期|多少条|总量).*(?:房源数据|历史房源)/u;

const productBoundaryQuestion =
  /(?:小智|本项目|平台|系统|Production|Live|千问|大模型).*(?:原生微信小程序|小程序|产品形态|能力边界|外部服务|接通|数据来源|事实来源|负责|角色)/iu;

export function requiredEvidenceTool(
  message: string,
): "search_knowledge" | null {
  const normalized = message.trim();
  if (
    knowledgePolicyQuestion.test(normalized) ||
    housingDatasetQuestion.test(normalized) ||
    productBoundaryQuestion.test(normalized)
  ) {
    return "search_knowledge";
  }
  return null;
}
