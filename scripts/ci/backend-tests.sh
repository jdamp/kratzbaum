#!/usr/bin/env bash
set -euo pipefail
: "${KRATZBAUM_TEST_POSTGRES_URL:?A disposable PostgreSQL test database is required}"
for tool in pg_dump pg_restore; do
  "$tool" --version | grep -E 'PostgreSQL\) 18\.' >/dev/null || {
    echo "$tool must be PostgreSQL 18" >&2
    exit 1
  }
done
# JSON output lets CI reject optional integration tests being silently skipped.
results=$(mktemp)
trap 'rm -f "$results"' EXIT
go test -json ./... | tee "$results"
node --input-type=module - "$results" <<'JS'
import { readFileSync } from 'node:fs';
const events = readFileSync(process.argv[2], 'utf8').trim().split('\n').map(JSON.parse);
const required = [
  ['internal/storage', 'TestSQLiteRepositoryContract'],
  ['internal/storage', 'TestSQLiteBackupRestoreKeepsCollectionAndDueState'],
  ['internal/storage', 'TestPostgresRepositoryContractAgainstDisposableDatabase'],
  ['internal/storage', 'TestPostgresBackupRestoreKeepsCollectionAndDueState'],
  ['internal/httpapi', 'TestPlantAndCareAPI'],
  ['internal/httpapi', 'TestPlantAndCareAPIPostgres'],
];
for (const [pkg, test] of required) {
  if (!events.some(e => e.Action === 'pass' && e.Package.endsWith('/' + pkg) && e.Test === test)) {
    throw new Error(`Required test did not pass: ${pkg}/${test}`);
  }
}
JS
