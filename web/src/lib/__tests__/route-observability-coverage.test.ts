import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

const apiRoot = join(process.cwd(), "src", "app", "api");
const methodExport =
  /^export (?:const|function|async function) (GET|POST|PUT|PATCH|DELETE)\b/gm;

function routeFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return name === "route.ts" ? [path] : [];
  });
}

function routeKey(file: string): string {
  const directory = relative(apiRoot, file).split(sep).slice(0, -1);
  return `/api/${directory.join("/")}`;
}

describe("API route observability coverage", () => {
  it("wraps every exported API method with its static route key", () => {
    const missing: string[] = [];
    for (const file of routeFiles(apiRoot)) {
      const source = readFileSync(file, "utf8");
      const methods = [...source.matchAll(methodExport)].map(
        (match) => match[1],
      );
      const key = routeKey(file);
      if (
        !source.includes(
          'import { observeRoute } from "@/lib/route-observability"',
        )
      ) {
        missing.push(`${key}: missing import`);
        continue;
      }
      for (const method of methods) {
        const exportPattern = new RegExp(
          `export const ${method}\\s*=\\s*observeRoute\\(\\s*["']${key.replaceAll("/", "\\/")}["']`,
        );
        if (!exportPattern.test(source)) missing.push(`${method} ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
