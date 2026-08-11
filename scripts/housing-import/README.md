# Historical housing importer

This tool converts the approved November 2024 SQLite snapshot into the
versioned Supabase housing schema. The source database is opened read-only and
is never copied into this repository.

## Safety model

- `audit` and `dry-run` never connect to Supabase.
- SQLite is opened with `mode=ro`, `immutable=1`, and `query_only=on`.
- Each normalized row gets a deterministic UUID and source-key hash.
- `apply` is idempotent and only leaves a release in `importing` state.
- `verify` recomputes the remote row count and dataset checksum.
- `activate` refuses unverified data or a database at/above 400 MB.
- The server-only key is read from the environment and is never printed.

Generated reports, `*.db`, `*.sqlite`, and `*.sqlite3` are ignored by Git.

## Commands

Run these commands from the repository root. Replace `<python>` and `<db>`
with the Python executable and the absolute source-database path.

```powershell
<python> scripts/housing-import/housing_import.py audit --db <db>

<python> scripts/housing-import/housing_import.py dry-run `
  --db <db> `
  --report scripts/housing-import/reports/2024-11-dry-run.json
```

Review the dry-run report before any remote operation. In particular, confirm:

- `source_unchanged` is `true`;
- `source_count = accepted_count + rejected_count`;
- rejection reasons are understood;
- the period, release ID, normalized-byte estimate, and checksum are expected.

Only after the target migrations are applied, set the target URL and a new
Supabase server-only secret in the current PowerShell process:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = "https://<project-ref>.supabase.co"
$env:SUPABASE_SECRET_KEY = Read-Host "Paste sb_secret_ key"
```

Do not paste a key by itself at the PowerShell prompt and never put it in a
tracked `.env` file.

```powershell
<python> scripts/housing-import/housing_import.py apply `
  --db <db> `
  --batch-size 500

<python> scripts/housing-import/housing_import.py verify `
  --release-id 5b640272-0dec-5dd8-b12a-45786ef1a60e

<python> scripts/housing-import/housing_import.py activate `
  --release-id 5b640272-0dec-5dd8-b12a-45786ef1a60e
```

`apply`, `verify`, and `activate` are deliberately separate. A successful
upload is not evidence that every remote row is intact; activation is allowed
only after verification succeeds.

## Development checks

```powershell
<python> -m unittest discover -s scripts/housing-import -p "test_*.py" -v
<python> -m ruff check scripts/housing-import
<python> -m mypy --strict scripts/housing-import/housing_import.py
```
