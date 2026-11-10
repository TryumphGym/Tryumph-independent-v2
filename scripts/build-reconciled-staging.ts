import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { appObject, literal, type MetadataRow } from "./schema-metadata.ts";

const fixture = JSON.parse(
  await readFile(
    new URL(
      "../src/test/fixtures/hosted-schema-metadata.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as { source_sha256: string; rows: MetadataRow[] };
const base = new URL("../docs/launch/reconciliation/", import.meta.url);
let sql = `-- GENERATED: node scripts/build-reconciled-staging.ts
-- STAGING ONLY: an independent clone of the inspected 978-row hosted schema.
-- Do not run upgrade.sql/completion.sql in addition to this file.
-- Review findings.md and pass 00_readonly_preflight.sql first. Stop app/cron workers
-- in staging. No production SQL, deployment, DNS, payment or merge is authorized.
-- Source export SHA256: ${fixture.source_sha256}
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
SET LOCAL search_path=public,extensions;
DO $already$ BEGIN
 IF to_regclass('public.launch_schema_versions') IS NOT NULL THEN
  RAISE EXCEPTION 'Schema has advanced since the inspected snapshot. Reinspect; do not replay or select a bundle using history alone.';
 END IF;
END $already$;
-- Validate all inspected application tables, columns, constraints, indexes,
-- policies, triggers, routine definitions and grants before making any changes.
DO $snapshot$ DECLARE changed text; BEGIN
`;
const engine = new PGlite();
let fingerprints: { section: string; object_name: string; hash: string }[];
try {
  const normalized = fixture.rows.filter(appObject).map((r) => ({
    ...r,
    details:
      r.section === "08_routine"
        ? {
            ...r.details,
            definition: String(r.details["definition"]).replaceAll(
              "\r\n",
              "\n",
            ),
          }
        : r.details,
  }));
  fingerprints = (
    await engine.query<{ section: string; object_name: string; hash: string }>(
      "SELECT section,object_name,md5(details::text) AS hash FROM jsonb_to_recordset($1::jsonb) AS x(section text,object_name text,details jsonb)",
      [JSON.stringify(normalized)],
    )
  ).rows;
} finally {
  await engine.close();
}
const inspection = (
  await readFile(
    new URL("../docs/launch/inspect-hosted-schema.sql", import.meta.url),
    "utf8",
  )
)
  .trim()
  .replace(/;$/, "");
sql += ` WITH inspected AS (${inspection}), actual AS (
 SELECT section,object_name,md5((CASE WHEN section='08_routine' THEN jsonb_set(details,'{definition}',to_jsonb(replace(details->>'definition',E'\\r\\n',E'\\n'))) ELSE details END)::text) AS hash
 FROM inspected WHERE section IN ('02_relation','03_column','04_constraint','05_index','06_policy','07_trigger','08_routine')
 AND (object_name LIKE 'public.%' OR (section='06_policy' AND object_name LIKE 'storage.objects.%'))
 AND NOT (section='04_constraint' AND details->>'kind'='n')
 ), expected(section,object_name,hash) AS (VALUES
 ${fingerprints.map((r) => `(${literal(r.section)},${literal(r.object_name)},${literal(r.hash)})`).join(",\n ")})
 SELECT coalesce(a.section,e.section)||':'||coalesce(a.object_name,e.object_name) INTO changed
 FROM actual a FULL JOIN expected e USING(section,object_name) WHERE a.hash IS DISTINCT FROM e.hash LIMIT 1;
 IF changed IS NOT NULL THEN RAISE EXCEPTION 'Inspected schema changed: %. Reinspect/reconcile; transaction aborted.',changed; END IF;
END $snapshot$;
`;
const checks = (
  await readFile(new URL("00_readonly_preflight.sql", base), "utf8")
)
  .split("BEGIN READ ONLY;\n")[1]!
  .split(";\nCOMMIT;")[0]!;
sql += `DO $data$ DECLARE c record; BEGIN
 FOR c IN ${checks} LOOP
  IF c.failures<>0 THEN RAISE EXCEPTION 'Data preflight failed: % (% rows). Review, never delete records to proceed.',c.check_name,c.failures; END IF;
 END LOOP;
END $data$;
-- Preserve every preexisting application's row, including all financial ledgers.
-- Capture only counts, column names and aggregate checksums in session-local temp
-- objects; no business records are exported. New columns are excluded afterward.
CREATE TEMP TABLE launch_preservation(relation_name text PRIMARY KEY,columns text[],row_count bigint,checksum text) ON COMMIT DROP;
DO $before$ DECLARE r record; cols text[]; n bigint; digest text; BEGIN
 FOR r IN SELECT c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname LOOP
  EXECUTE format('LOCK TABLE public.%I IN SHARE MODE',r.relname);
  SELECT array_agg(a.attname::text ORDER BY a.attnum) INTO cols FROM pg_catalog.pg_attribute a WHERE a.attrelid=format('public.%I',r.relname)::regclass AND a.attnum>0 AND NOT a.attisdropped;
  EXECUTE format($digest$SELECT count(*),md5(coalesce(string_agg(h,'' ORDER BY h),'')) FROM (SELECT md5(to_jsonb(t)::text) h FROM public.%I t) d$digest$,r.relname) INTO n,digest;
  INSERT INTO launch_preservation VALUES(r.relname,cols,n,digest);
 END LOOP;
END $before$;
`;
// The body is explicitly selected after definition-level comparison. Earlier
// migrations contain seed cleanup and narrower manual contracts: do not replay.
const dir = new URL("../migrations/", import.meta.url);
const files = (await readdir(dir))
  .filter((f) => f >= "0051_" && f <= "0057_\uffff" && f.endsWith(".sql"))
  .sort();
const sources: Record<string, string> = {};
for (const file of files) {
  const source = await readFile(new URL(file, dir), "utf8");
  sources[file] = createHash("sha256").update(source).digest("hex");
  let body = source;
  // Hosted can_message_friend already requires BOTH friendship rows. Do not
  // grandfather an unaccepted unilateral partner row into new message access.
  if (file === "0056_friendship_contract.sql") {
    const original =
      "INSERT INTO legacy_friendship_grants SELECT user_id,friend_id FROM friendships WHERE partner ON CONFLICT DO NOTHING;";
    if (!body.includes(original))
      throw new Error("0056 backfill changed; re-review the hosted adaptation");
    body = body.replace(
      original,
      "-- HOSTED ADAPTATION: preserve only the existing mutually accepted messaging contract.\nINSERT INTO legacy_friendship_grants SELECT f.user_id,f.friend_id FROM friendships f WHERE f.partner AND EXISTS(SELECT 1 FROM friendships b WHERE b.user_id=f.friend_id AND b.friend_id=f.user_id) ON CONFLICT DO NOTHING;",
    );
  }
  sql += `\n-- REVIEWED SOURCE: ${file} ORIGINAL SHA256 ${sources[file]}\n${body}\n`;
}
sql += `
DO $after$ DECLARE r record; n bigint; digest text; BEGIN
 FOR r IN SELECT * FROM launch_preservation ORDER BY relation_name LOOP
  EXECUTE format($digest$SELECT count(*),md5(coalesce(string_agg(h,'' ORDER BY h),'')) FROM (SELECT md5((SELECT jsonb_object_agg(k,v) FROM jsonb_each(to_jsonb(t)) j(k,v) WHERE k=ANY($1))::text) h FROM public.%I t) d$digest$,r.relation_name) INTO n,digest USING r.columns;
  IF n<>r.row_count OR digest IS DISTINCT FROM r.checksum THEN RAISE EXCEPTION 'Existing data changed in %. Transaction rolled back.',r.relation_name; END IF;
 END LOOP;
END $after$;
COMMIT;
-- Run 02_validate_staging.sql next; do not deploy or run provider workers yet.
`;
await writeFile(new URL("01_stage_apply.sql", base), sql);
await writeFile(
  new URL("sources.json", base),
  JSON.stringify(
    {
      export_sha256: fixture.source_sha256,
      inspected_objects: fingerprints.length,
      artifact_sha256: createHash("sha256").update(sql).digest("hex"),
      adaptations: [
        "0056 legacy friendship backfill requires both existing friendship rows",
      ],
      sources,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Prepared ${files.length} reviewed migrations with snapshot/preservation guards. No SQL executed.`,
);
