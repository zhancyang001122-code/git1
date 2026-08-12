function finalizationFor(job) {
  const value = job?.result_json?.finalization;
  return value && typeof value === "object" ? value : null;
}

export function publicationImportAction(version, job) {
  if (!version) return { action: "create" };
  const finalization = finalizationFor(job);
  if (
    version.kb_articles?.current_version_id === version.id &&
    job?.status === "succeeded" &&
    finalization?.searchable === true
  ) {
    return {
      action: "done",
      evaluationStatus: finalization.evaluationStatus ?? "not_run",
    };
  }
  if (version.kb_articles?.current_version_id !== version.id) {
    return { action: "inconsistent" };
  }
  if (job?.status === "succeeded") return { action: "inconsistent" };
  return { action: "resume" };
}

function completedJob(versionId, job) {
  const finalization = finalizationFor(job);
  if (job?.status !== "succeeded" || finalization?.searchable !== true) {
    throw new Error(`index finalization failed for ${versionId}`);
  }
  return { status: "succeeded", versionId, finalization };
}

function safeErrorCode(value) {
  return typeof value === "string" && /^[A-Z][A-Z0-9_]{1,119}$/.test(value)
    ? value
    : "KNOWLEDGE_INDEX_FAILED";
}

export async function runIndexWorkerUntil({
  versionId,
  readJob,
  invokeWorker,
  wait,
  now = Date.now,
  timeoutMs = 180_000,
}) {
  const deadline = now() + timeoutMs;
  while (now() <= deadline) {
    const job = await readJob(versionId);
    if (!job) throw new Error(`index job missing for ${versionId}`);
    if (job.status === "succeeded") return completedJob(versionId, job);
    if (job.status === "failed") {
      throw new Error(
        `index job ${versionId} failed with ${safeErrorCode(job.last_error_code)}`,
      );
    }
    const availableAt = Date.parse(job.available_at ?? "");
    const delay = Number.isFinite(availableAt)
      ? Math.max(0, Math.min(30_000, availableAt - now()))
      : 0;
    if (delay > 0) {
      await wait(delay);
      continue;
    }
    await invokeWorker();
    await wait(250);
  }
  throw new Error(`index worker timed out for ${versionId}`);
}
