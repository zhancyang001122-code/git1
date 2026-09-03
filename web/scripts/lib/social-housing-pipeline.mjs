import { createHash } from "node:crypto";

const PHONE_PATTERN = /(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)/gu;
const CONTACT_PATTERN =
  /(?:微信|vx|v信|微\s*信|wechat|电话|手机|联系方式)\s*[:：]?\s*[a-zA-Z0-9_-]{4,30}/giu;

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
