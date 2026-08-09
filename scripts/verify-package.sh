#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

required=(
  README.md
  AGENTS.md
  MANIFEST.md
  docs/01-PRD.md
  docs/03-ui-design-system.md
  docs/05-ai-agent-architecture.md
  docs/06-rag-knowledge-system.md
  docs/10-interview-guide.md
  docs/11-acceptance-criteria.md
  docs/13-development-standards.md
  docs/14-configuration-guide.md
  docs/15-codex-handoff.md
  docs/16-requirement-traceability.md
  docs/superpowers/specs/2026-08-05-xiaozhi-design.md
  docs/superpowers/plans/2026-08-05-xiaozhi-implementation.md
  codex/00-master-prompt.md
  codex/execution-order.md
  config/.env.example
  config/design-tokens.json
  config/routes.json
  contracts/domain-types.ts
  contracts/tool-contracts.json
  contracts/qwen-system-prompt.md
  supabase/migrations/202608050001_extensions_and_types.sql
  supabase/migrations/202608050008_seed_demo.sql
  qa/evaluation-cases.json
  design/prototypes/01-home.png
  design/prototypes/09-profile.png
  design/prototypes/contact-sheet.jpg
)

for rel in "${required[@]}"; do
  if [[ ! -s "$ROOT/$rel" ]]; then
    echo "Missing or empty required file: $rel" >&2
    exit 1
  fi
done

python - "$ROOT" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
for path in sorted(root.rglob("*.json")):
    with path.open("r", encoding="utf-8") as f:
        json.load(f)
print("JSON validation: PASS")

migration_files = sorted((root / "supabase" / "migrations").glob("*.sql"))
if len(migration_files) != 8:
    raise SystemExit(f"Expected 8 SQL migrations, found {len(migration_files)}")
print("Migration count: PASS (8)")

prototype_files = sorted((root / "design" / "prototypes").glob("0*.png"))
if len(prototype_files) != 9:
    raise SystemExit(f"Expected 9 prototype PNG files, found {len(prototype_files)}")
print("Prototype count: PASS (9)")
PY

# Detect unresolved placeholder forms, while allowing documentation that mentions the words themselves.
if grep -RInE '(^|[[:space:]])(TBD|TODO|FIXME)[[:space:]]*:' "$ROOT" \
  --exclude-dir='.git' --exclude='*.png' --exclude='*.jpg'; then
  echo "Unresolved placeholder marker found." >&2
  exit 1
fi

echo "Required-file validation: PASS"
echo "Placeholder validation: PASS"
echo "Package verification: PASS"
