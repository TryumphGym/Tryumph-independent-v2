import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createTestDatabase } from "../src/test/database.ts";
import {
  compareMetadata,
  parseInspection,
  type MetadataRow,
} from "./schema-metadata.ts";

const input = process.argv[2];
if (!input)
  throw new Error(
    "Usage: node scripts/compare-hosted-schema.ts <complete CSV or JSON export>",
  );
const raw = await readFile(input, "utf8"),
  hosted = parseInspection(raw);
// Freeze the comparison to the draft PR's inspected contract, not later fixes.
const db = await createTestDatabase("0056_friendship_contract.sql");
try {
  await db.exec("SET search_path=public,extensions; BEGIN READ ONLY");
  const expected = (
    await db.query<MetadataRow>(
      await readFile(
        new URL("../docs/launch/inspect-hosted-schema.sql", import.meta.url),
        "utf8",
      ),
    )
  ).rows;
  await db.exec("ROLLBACK");
  const objects = compareMetadata(hosted, expected);
  const summary: Record<string, Record<string, number>> = {};
  for (const o of objects) {
    const counts = (summary[o.section] ??= {});
    counts[o.status] = (counts[o.status] ?? 0) + 1;
  }
  const report = {
    source_sha256: createHash("sha256").update(raw).digest("hex"),
    captured_at: hosted.find((r) => r.section === "00_context")?.details[
      "captured_at"
    ],
    source_rows: hosted.length,
    inspected_pr_head: "3f60ba09a4364043944b0672faf0f3f5b2d2374e",
    expected_through: "0056_friendship_contract.sql",
    comparison_rules: [
      "Application-owned public objects and application storage policies only",
      "CRLF normalized to LF; no SQL/body rewrites or whitespace folding",
      "PG18 NOT NULL constraint objects excluded; NOT NULL compared on columns",
      "Column ordinal and owner excluded from field status; owner differences reported separately",
      "Grants include role, privilege and grant option; PUBLIC is not equivalent to explicit role grants",
      "A different definition is a review item, not proof of different behavior; see reconciliation findings",
    ],
    summary,
    objects,
  };
  await writeFile(
    new URL(
      "../docs/launch/reconciliation/object-comparison.json",
      import.meta.url,
    ),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify({ source_rows: hosted.length, summary }, null, 2));
} finally {
  await db.close();
}
