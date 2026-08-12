import { describe, expect, it, vi } from "vitest";

import {
  publicationImportAction,
  runIndexWorkerUntil,
} from "./portfolio-import-state.mjs";

const versionId = "62000000-0000-4000-8000-000000000001";

describe("portfolio knowledge import recovery", () => {
  it("skips only a current, searchable, succeeded publication", () => {
    expect(
      publicationImportAction(
        {
          id: versionId,
          kb_articles: { current_version_id: versionId },
        },
        {
          status: "succeeded",
          result_json: {
            finalization: {
              searchable: true,
              evaluationStatus: "passed",
            },
          },
        },
        {
          publication_result_json: {
            indexStatus: "ready",
            searchable: true,
            evaluationStatus: "passed",
          },
        },
      ),
    ).toEqual({ action: "done", evaluationStatus: "passed" });
  });

  it("reports a searchable publication whose candidate evaluation needs review", () => {
    expect(
      publicationImportAction(
        {
          id: versionId,
          kb_articles: { current_version_id: versionId },
        },
        {
          status: "succeeded",
          result_json: {
            finalization: {
              searchable: true,
              evaluationStatus: "failed",
            },
          },
        },
        {
          publication_result_json: {
            indexStatus: "ready",
            searchable: true,
            evaluationStatus: "failed",
          },
        },
      ),
    ).toEqual({ action: "done", evaluationStatus: "failed" });
  });

  it("does not silently resume a version that is no longer current", () => {
    expect(
      publicationImportAction(
        {
          id: versionId,
          kb_articles: {
            current_version_id: "62000000-0000-4000-8000-000000000002",
          },
        },
        null,
      ),
    ).toEqual({ action: "inconsistent" });
  });

  it.each(["failed", "pending", "retrying", "processing"])(
    "resumes an existing %s index job",
    (status) => {
      expect(
        publicationImportAction(
          {
            id: versionId,
            kb_articles: { current_version_id: versionId },
          },
          { status, result_json: null },
          null,
        ),
      ).toEqual({ action: "resume" });
    },
  );

  it("waits through an idle worker response until the durable retry is available", async () => {
    let now = Date.parse("2026-08-13T00:00:00.000Z");
    const jobs = [
      {
        status: "retrying",
        available_at: "2026-08-13T00:00:10.000Z",
        last_error_code: "EMBEDDING_FAILED",
      },
      {
        status: "retrying",
        available_at: "2026-08-13T00:00:10.000Z",
        last_error_code: "EMBEDDING_FAILED",
      },
      {
        status: "succeeded",
        result_json: {
          finalization: {
            searchable: true,
            evaluationStatus: "passed",
          },
        },
      },
    ];
    const readJob = vi.fn(async () => jobs.shift());
    const invokeWorker = vi.fn(async () => ({ status: "idle" }));
    const wait = vi.fn(async (milliseconds) => {
      now += milliseconds;
    });

    await expect(
      runIndexWorkerUntil({
        versionId,
        readJob,
        invokeWorker,
        wait,
        now: () => now,
        timeoutMs: 30_000,
      }),
    ).resolves.toMatchObject({
      status: "succeeded",
      finalization: { evaluationStatus: "passed" },
    });
    expect(wait).toHaveBeenCalledWith(10_000);
    expect(invokeWorker).toHaveBeenCalledOnce();
  });

  it("surfaces a terminal durable job error without exposing provider details", async () => {
    await expect(
      runIndexWorkerUntil({
        versionId,
        readJob: vi.fn(async () => ({
          status: "failed",
          last_error_code: "EMBEDDING_FAILED",
        })),
        invokeWorker: vi.fn(),
        wait: vi.fn(),
      }),
    ).rejects.toThrow(`index job ${versionId} failed with EMBEDDING_FAILED`);
  });
});
