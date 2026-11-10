// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { createTestDatabase } from "./database";
const sql = await readFile(
  new URL("../../docs/launch/inspect-hosted-schema.sql", import.meta.url),
  "utf8",
);
type Item = {
  section: string;
  object_name: string;
  details: Record<string, unknown>;
};
async function inspect(db: PGlite) {
  await db.exec("BEGIN READ ONLY");
  try {
    return (await db.query<Item>(sql)).rows;
  } finally {
    await db.exec("ROLLBACK");
  }
}
describe("hosted schema inspection without hosted access", () => {
  it("handles absent optional tables and registries without assuming a baseline", async () => {
    const db = new PGlite();
    try {
      const rows = await inspect(db);
      expect(
        rows.find(
          (r) =>
            r.object_name === "public.launch_schema_versions" &&
            r.section === "01_expected_relation",
        )?.details["present"],
      ).toBe(false);
      expect(
        rows
          .filter((r) => r.section === "14_migration_history")
          .every((r) => r.details["present"] === false),
      ).toBe(true);
      expect(rows.at(-1)?.details).toMatchObject({
        baseline_selected: false,
        report_rows: rows.length,
      });
    } finally {
      await db.close();
    }
  });
  it("inspects a mixed schema, overloads, policies and history while leaving private rows unread and unchanged", async () => {
    const db = new PGlite();
    try {
      await db.exec(`CREATE ROLE authenticated NOLOGIN; CREATE SCHEMA supabase_migrations;
    CREATE TABLE profiles(id integer PRIMARY KEY,email text NOT NULL,balance integer DEFAULT 0 CHECK(balance>=0));
    INSERT INTO profiles VALUES(1,'PRIVATE_ACCOUNT_SENTINEL',12345);
    CREATE TABLE friend_requests(id integer PRIMARY KEY,body text); INSERT INTO friend_requests VALUES(1,'PRIVATE_REQUEST_SENTINEL');
    ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
    CREATE POLICY private_profile_policy ON profiles FOR SELECT TO authenticated USING(false);
    CREATE FUNCTION trainer_is_eligible(uuid,boolean DEFAULT false) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'must not execute'; END $$;
    CREATE FUNCTION trainer_is_eligible(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
    CREATE FUNCTION profile_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
    CREATE TRIGGER existing_profile_guard BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION profile_guard();
    CREATE FUNCTION public.pg_get_functiondef(oid) RETURNS text LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'shadow function must not execute'; END $$;
    SET search_path=public,pg_catalog;
    CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,name text,statements text[]);
    INSERT INTO supabase_migrations.schema_migrations VALUES('20261001','existing_manual_contract',ARRAY['PRIVATE_MIGRATION_STATEMENT_SENTINEL']);`);
      const rows = await inspect(db),
        serialized = JSON.stringify(rows);
      expect(
        rows.filter(
          (r) =>
            r.section === "08_routine" &&
            r.object_name.startsWith("public.trainer_is_eligible("),
        ),
      ).toHaveLength(2);
      expect(
        rows.some(
          (r) =>
            r.section === "07_trigger" &&
            r.object_name.endsWith(".existing_profile_guard"),
        ),
      ).toBe(true);
      expect(
        rows.some(
          (r) => r.section === "06_policy" && r.details["using"] === "false",
        ),
      ).toBe(true);
      const history = rows.find(
        (r) =>
          r.section === "14_migration_history" &&
          r.object_name === "supabase_migrations.schema_migrations",
      );
      expect(history?.details["records_xml"]).toContain("20261001");
      for (const marker of [
        "PRIVATE_ACCOUNT_SENTINEL",
        "PRIVATE_REQUEST_SENTINEL",
        "PRIVATE_MIGRATION_STATEMENT_SENTINEL",
      ])
        expect(serialized).not.toContain(marker);
      expect(
        (await db.query("SELECT balance FROM profiles WHERE id=1")).rows,
      ).toEqual([{ balance: 12345 }]);
      expect(
        (await db.query("SELECT count(*)::int AS n FROM friend_requests")).rows,
      ).toEqual([{ n: 1 }]);
    } finally {
      await db.close();
    }
  });
  it("runs against the complete prepared schema inside a READ ONLY transaction", async () => {
    const db = await createTestDatabase();
    try {
      const rows = await inspect(db);
      expect(
        rows.some(
          (r) =>
            r.section === "08_routine" &&
            r.object_name.startsWith("public.apply_checkout_refund("),
        ),
      ).toBe(true);
      expect(
        rows.find((r) => r.section === "15_bucket_configuration")?.details[
          "settings_xml"
        ],
      ).toContain("trainer-certificates");
      expect(rows.at(-1)?.details["report_rows"]).toBe(rows.length);
    } finally {
      await db.close();
    }
  }, 30000);
  it("skips registry row reads when they would execute RLS policy functions", async () => {
    const db = new PGlite();
    try {
      await db.exec(`CREATE ROLE inspection_reader NOLOGIN; GRANT USAGE ON SCHEMA public TO inspection_reader;
    CREATE TABLE launch_schema_versions(version text); INSERT INTO launch_schema_versions VALUES('PRIVATE_HISTORY_SENTINEL');
    ALTER TABLE launch_schema_versions ENABLE ROW LEVEL SECURITY; ALTER TABLE launch_schema_versions FORCE ROW LEVEL SECURITY;
    CREATE FUNCTION dangerous_history_policy() RETURNS boolean LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'must not execute'; END $$;
    CREATE POLICY history_rls ON launch_schema_versions FOR SELECT TO inspection_reader USING(dangerous_history_policy());
    GRANT SELECT ON launch_schema_versions TO inspection_reader; SET ROLE inspection_reader;`);
      const rows = await inspect(db);
      const history = rows.find(
        (r) =>
          r.section === "14_migration_history" &&
          r.object_name === "public.launch_schema_versions",
      );
      expect(history?.details["records_xml"]).toBe(null);
      expect(history?.details["status"]).toContain("RLS would apply");
      expect(JSON.stringify(rows)).not.toContain("PRIVATE_HISTORY_SENTINEL");
    } finally {
      await db.close();
    }
  });
});
