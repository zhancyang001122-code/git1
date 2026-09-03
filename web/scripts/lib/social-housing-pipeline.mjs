import { createHash } from "node:crypto";

const PHONE_PATTERN = /(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)/gu;
const CONTACT_PATTERN =
  /(?:微信|vx|v信|微\s*信|wechat|电话|手机|联系方式)\s*[:：]?\s*[a-zA-Z0-9_-]{4,30}/giu;
const PREFILTER_PATTERNS = [
  {
    reason: "wanted",
    pattern:
      /(?:求租|本人想租|想租(?:一|两|三|四|五|\d)|想找(?:一套|房子|室友|合租)|找房求助|预算.{0,12}(?:求租|想租))/u,
  },
  {
    reason: "closed",
    pattern:
      /(?:已租出|已出租|已转租|已经租掉|房子租掉了|已结束|停止出租|不用再问)/u,
  },
  {
    reason: "advice",
    pattern: /(?:租房攻略|租房避坑|租房指南|租房经验分享|选房技巧|租房知识)/u,
  },
  {
    reason: "commercial",
    pattern:
      /(?:专业代找房|全杭州房源|海量房源|每日更新房源|租房咨询|多套房源可选|房源管家)/u,
  },
];

export function sanitizePublicText(value, maxLength = 500) {
  return String(value ?? "")
    .replace(PHONE_PATTERN, "[联系方式已隐藏]")
    .replace(CONTACT_PATTERN, "[联系方式已隐藏]")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maxLength);
}

export function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function sourceIdentityKey(platform, sourceId) {
  const normalizedPlatform = String(platform ?? "")
    .trim()
    .toLowerCase();
  const normalizedSourceId = String(sourceId ?? "")
    .trim()
    .toLowerCase();
  if (!normalizedPlatform || !normalizedSourceId) {
    throw new Error("Platform and source id are required");
  }
  return `${normalizedPlatform}:${normalizedSourceId}`;
}

export function prefilterRentalPost(row) {
  const text = sanitizePublicText(
    `${row?.title ?? ""} ${row?.desc ?? ""}`,
    3_000,
  );
  if (!text) return { pass: false, reason: "empty" };

  for (const rule of PREFILTER_PATTERNS) {
    if (rule.pattern.test(text)) {
      return { pass: false, reason: rule.reason };
    }
  }
  return { pass: true, reason: null };
}

export function normalizedLocationCacheKey(record) {
  const city = String(record.city ?? "杭州")
    .trim()
    .replace(/市$/u, "");
  const district = String(record.district ?? "")
    .trim()
    .replace(/\s+/gu, "");
  const place = String(
    record.community ?? record.locationText ?? record.address ?? "",
  )
    .trim()
    .replace(/\s+/gu, "")
    .replace(/(?:小区|公寓|社区)$/u, "");
  if (!place) throw new Error("A location is required for geocode caching");
  return [city, district, place].join("|").toLowerCase();
}

export function buildKeywordMatrix(configuration) {
  const city = String(configuration.city ?? "").trim();
  const intents = [
    ...new Set(configuration.intents.map((value) => String(value).trim())),
  ].filter(Boolean);
  if (!city || intents.length === 0)
    throw new Error("City and intents are required");

  const areas = configuration.districts.map((area) => ({
    locations: [
      String(area.district ?? "").trim(),
      ...(area.communities ?? []).map((value) => String(value).trim()),
      ...(area.stations ?? []).map((value) => String(value).trim()),
    ].filter(Boolean),
  }));
  const maxLocationCount = Math.max(
    ...areas.map((area) => area.locations.length),
  );
  const keywords = [];
  // Cover different districts before advancing to the next location layer.
  // Consecutive runs then overlap less than exhausting one neighbourhood first.
  for (
    let locationIndex = 0;
    locationIndex < maxLocationCount;
    locationIndex += 1
  ) {
    for (const intent of intents) {
      for (const area of areas) {
        const location = area.locations[locationIndex];
        if (location) keywords.push(`${city}${location}${intent}`);
      }
    }
  }
  return [...new Set(keywords)];
}

export function selectRotatingKeywordBatch(keywords, cursor, count) {
  if (!Array.isArray(keywords) || keywords.length === 0) {
    throw new Error("Keyword matrix cannot be empty");
  }
  if (!Number.isInteger(cursor) || cursor < 0)
    throw new Error("Cursor must be a non-negative integer");
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    throw new Error("Keyword batch size must be between 1 and 20");
  }
  const size = Math.min(count, keywords.length);
  return Array.from(
    { length: size },
    (_, offset) => keywords[(cursor + offset) % keywords.length],
  );
}

export async function mapWithConcurrency(items, concurrency, worker) {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("Concurrency must be a positive integer");
  }
  const results = new Array(items.length);
  let nextIndex = 0;
  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () =>
      runWorker(),
    ),
  );
  return results;
}

export function canonicalXiaohongshuUrl(noteId) {
  if (!/^[0-9a-f]{24}$/iu.test(noteId)) {
    throw new Error("Invalid Xiaohongshu note id");
  }
  return `https://www.xiaohongshu.com/explore/${noteId.toLowerCase()}`;
}

export function normalizedDedupeKey(record) {
  const place = String(record.community ?? record.locationText ?? "")
    .toLowerCase()
    .replace(/[\s·•,，.。路街道号弄室栋幢单元]/gu, "");
  const layout = String(record.layout ?? "")
    .toLowerCase()
    .replace(/\s+/gu, "");
  return [
    record.city,
    record.district ?? "",
    place,
    record.priceMinMonthly,
    record.priceMaxMonthly ?? "",
    layout,
  ]
    .join("|")
    .toLowerCase();
}

export function dedupeCandidates(records) {
  const bySource = new Map();
  for (const record of records) {
    bySource.set(`${record.platform}:${record.sourceId}`, record);
  }

  const byListing = new Map();
  for (const record of bySource.values()) {
    const key = normalizedDedupeKey(record);
    const existing = byListing.get(key);
    if (!existing || record.confidence > existing.confidence) {
      byListing.set(key, record);
    }
  }
  return [...byListing.values()];
}

export function eligibilityFailureReasons(record, asOf) {
  const reasons = [];
  const deadlineExpired =
    record.availabilityDeadline !== null &&
    new Date(`${record.availabilityDeadline}T23:59:59+08:00`) < asOf;
  const hasRentRange =
    record.priceMinMonthly !== null &&
    (record.priceMaxMonthly === null ||
      record.priceMaxMonthly >= record.priceMinMonthly);

  if (record.category !== "offering") {
    reasons.push(
      record.category === "wanted"
        ? "帖子是求租，不是出租或转租"
        : "帖子不是可识别的具体出租或转租线索",
    );
  }
  if (record.explicitlyClosed || deadlineExpired) {
    reasons.push("帖子已明确结束或有效期已过");
  }
  if (!hasRentRange) reasons.push("缺少可用租金或租金区间");
  if (record.locationText === null) {
    reasons.push("缺少可用于定位的小区、地标或地铁站");
  }
  return reasons;
}

export function requireCompleteReviewDecisions(records, decisions) {
  const pendingIds = new Set(
    records
      .filter((record) => record.reviewStatus === "pending_review")
      .map((record) => record.sourceId),
  );
  const decisionIds = decisions.map((decision) => decision.sourceId);
  const uniqueDecisionIds = new Set(decisionIds);
  if (uniqueDecisionIds.size !== decisionIds.length) {
    throw new Error("Manual review contains duplicate source IDs");
  }

  const missing = [...pendingIds].filter(
    (sourceId) => !uniqueDecisionIds.has(sourceId),
  );
  const unexpected = [...uniqueDecisionIds].filter(
    (sourceId) => !pendingIds.has(sourceId),
  );
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      [
        missing.length > 0 ? `Missing decisions: ${missing.join(", ")}` : null,
        unexpected.length > 0
          ? `Unexpected decisions: ${unexpected.join(", ")}`
          : null,
      ]
        .filter(Boolean)
        .join("; "),
    );
  }
}

export function selectPreferredDistrict(items, preferredDistrict) {
  if (items.length === 0) return null;
  if (!preferredDistrict) return items[0];
  return items.find((item) => item.district === preferredDistrict) ?? items[0];
}

export function gcj02ToWgs84(longitude, latitude) {
  if (
    longitude < 72.004 ||
    longitude > 137.8347 ||
    latitude < 0.8293 ||
    latitude > 55.8271
  ) {
    return { longitude, latitude };
  }

  const axis = 6378245;
  const eccentricity = 0.006693421622965943;
  const radLat = (latitude / 180) * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - eccentricity * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  const offset = transformOffset(longitude - 105, latitude - 35);
  const deltaLatitude =
    (offset.latitude * 180) /
    (((axis * (1 - eccentricity)) / (magic * sqrtMagic)) * Math.PI);
  const deltaLongitude =
    (offset.longitude * 180) /
    ((axis / sqrtMagic) * Math.cos(radLat) * Math.PI);
  return {
    longitude: longitude * 2 - (longitude + deltaLongitude),
    latitude: latitude * 2 - (latitude + deltaLatitude),
  };
}

function transformOffset(longitude, latitude) {
  let transformedLatitude =
    -100 +
    2 * longitude +
    3 * latitude +
    0.2 * latitude * latitude +
    0.1 * longitude * latitude +
    0.2 * Math.sqrt(Math.abs(longitude));
  transformedLatitude +=
    ((20 * Math.sin(6 * longitude * Math.PI) +
      20 * Math.sin(2 * longitude * Math.PI)) *
      2) /
    3;
  transformedLatitude +=
    ((20 * Math.sin(latitude * Math.PI) +
      40 * Math.sin((latitude / 3) * Math.PI)) *
      2) /
    3;
  transformedLatitude +=
    ((160 * Math.sin((latitude / 12) * Math.PI) +
      320 * Math.sin((latitude * Math.PI) / 30)) *
      2) /
    3;

  let transformedLongitude =
    300 +
    longitude +
    2 * latitude +
    0.1 * longitude * longitude +
    0.1 * longitude * latitude +
    0.1 * Math.sqrt(Math.abs(longitude));
  transformedLongitude +=
    ((20 * Math.sin(6 * longitude * Math.PI) +
      20 * Math.sin(2 * longitude * Math.PI)) *
      2) /
    3;
  transformedLongitude +=
    ((20 * Math.sin(longitude * Math.PI) +
      40 * Math.sin((longitude / 3) * Math.PI)) *
      2) /
    3;
  transformedLongitude +=
    ((150 * Math.sin((longitude / 12) * Math.PI) +
      300 * Math.sin((longitude / 30) * Math.PI)) *
      2) /
    3;
  return {
    longitude: transformedLongitude,
    latitude: transformedLatitude,
  };
}
