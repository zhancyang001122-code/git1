import { createHash } from "node:crypto";

import type { ChunkDraft, KnowledgeDomain } from "@/features/knowledge/types";

interface ChunkVersionInput {
  articleId: string;
  versionId: string;
  title: string;
  domain: KnowledgeDomain;
  category: string;
  city: string | null;
  contentMarkdown: string;
}

interface Section {
  headingPath: string[];
  paragraphs: string[];
}

const TARGET = 500;
const MAXIMUM = 650;
const OVERLAP_MAXIMUM = 100;

function normalizeMarkdown(markdown: string): string {
  return markdown
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitLongParagraph(paragraph: string): string[] {
  if (paragraph.length <= MAXIMUM) return [paragraph];
  const sentences = paragraph.split(/(?<=[。！？；])/u).filter(Boolean);
  const parts: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current && current.length + sentence.length > TARGET) {
      parts.push(current);
      current = "";
    }
    if (sentence.length > MAXIMUM) {
      for (let offset = 0; offset < sentence.length; offset += TARGET)
        parts.push(sentence.slice(offset, offset + TARGET));
    } else current += sentence;
  }
  if (current) parts.push(current);
  return parts;
}

function sections(markdown: string, fallbackTitle: string): Section[] {
  const headingPath = [fallbackTitle];
  const result: Section[] = [];
  let paragraphs: string[] = [];
  const flush = () => {
    if (paragraphs.length > 0)
      result.push({ headingPath: [...headingPath], paragraphs });
    paragraphs = [];
  };
  for (const block of normalizeMarkdown(markdown).split(/\n\n+/)) {
    const heading = /^(#{1,6})\s+(.+)$/.exec(block.trim());
    if (heading) {
      flush();
      const level = heading[1]?.length ?? 1;
      headingPath.splice(level - 1);
      headingPath[level - 1] = heading[2]!.trim();
      continue;
    }
    const tableNormalized = block
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => !/^\|?\s*:?-+:?\s*(\||$)/.test(line))
      .join(" ")
      .replace(/\s*\|\s*/g, "；");
    paragraphs.push(...splitLongParagraph(tableNormalized));
  }
  flush();
  return result;
}

function hash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function chunkKnowledgeVersion(input: ChunkVersionInput): ChunkDraft[] {
  const drafts: Omit<ChunkDraft, "chunkIndex">[] = [];
  for (const section of sections(input.contentMarkdown, input.title)) {
    let group: string[] = [];
    const emit = () => {
      if (group.length === 0) return;
      const content = group.join("\n\n");
      drafts.push({
        articleId: input.articleId,
        versionId: input.versionId,
        content,
        contentHash: hash(content),
        headingPath: section.headingPath,
        metadata: {
          domain: input.domain,
          category: input.category,
          city: input.city,
          headingPath: section.headingPath,
          contentHash: hash(content),
        },
      });
      const trailing = group.at(-1);
      group = trailing && trailing.length <= OVERLAP_MAXIMUM ? [trailing] : [];
    };
    for (const paragraph of section.paragraphs) {
      const nextLength = group.join("\n\n").length + paragraph.length + 2;
      if (group.length > 0 && nextLength > MAXIMUM) emit();
      group.push(paragraph);
      if (group.join("\n\n").length >= TARGET) emit();
    }
    emit();
  }
  const seen = new Set<string>();
  return drafts
    .filter((draft) => {
      if (seen.has(draft.contentHash)) return false;
      seen.add(draft.contentHash);
      return true;
    })
    .map((draft, chunkIndex) => ({ ...draft, chunkIndex }));
}
