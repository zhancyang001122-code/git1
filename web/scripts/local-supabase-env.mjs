import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

export function readLocalSupabaseEnvironment(cwd = process.cwd()) {
  const cliEntry = resolve(
    cwd,
    "node_modules",
    "supabase",
    "dist",
    "supabase.js",
  );
  const result = spawnSync(
    process.execPath,
    [
      cliEntry,
      "--workdir",
      resolve(cwd, ".."),
      "status",
      "--output",
      "env",
      "--output-format",
      "text",
      "--agent",
      "no",
    ],
    { encoding: "utf8" },
  );

  if (result.status !== 0) {
    throw new Error(
      `Local Supabase is unavailable. Run pnpm db:start first.\n${result.error?.message || result.stderr || result.stdout}`,
    );
  }

  const environment = Object.fromEntries(
    result.stdout
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z_]+)="(.*)"$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2]]),
  );
  for (const name of ["API_URL", "PUBLISHABLE_KEY", "MAILPIT_URL"]) {
    if (!environment[name]) {
      throw new Error(`Local Supabase status did not provide ${name}`);
    }
  }
  return environment;
}
