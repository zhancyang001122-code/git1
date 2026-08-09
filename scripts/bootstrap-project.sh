#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22+ is required." >&2
  exit 1
fi

NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
if (( NODE_MAJOR < 22 )); then
  echo "Node.js 22+ is required; found $(node --version)." >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required. Install it with: corepack enable && corepack prepare pnpm@10 --activate" >&2
  exit 1
fi

if [[ -e "$ROOT/web/package.json" ]]; then
  echo "web/package.json already exists; refusing to overwrite the application." >&2
  exit 1
fi

pnpm create next-app@latest web \
  --ts \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --turbopack \
  --import-alias '@/*' \
  --use-pnpm

cd "$ROOT/web"
pnpm add @supabase/ssr @supabase/supabase-js openai zod lucide-react clsx tailwind-merge react-markdown remark-gfm
pnpm add -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @playwright/test prettier prettier-plugin-tailwindcss
cp "$ROOT/config/.env.example" "$ROOT/web/.env.example"

mkdir -p "$ROOT/web/public/prototypes"
cp "$ROOT"/design/prototypes/0*.png "$ROOT/web/public/prototypes/"
cp "$ROOT/design/prototypes/contact-sheet.jpg" "$ROOT/web/public/prototypes/"

cat <<'MESSAGE'
Scaffold created in web/.
Next action: give Codex codex/00-master-prompt.md and codex/01-scaffold-prompt.md.
Do not add real keys to .env.example.
MESSAGE
