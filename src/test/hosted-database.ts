import { readFile } from "node:fs/promises";
import { createPlatformDatabase } from "./database.ts";
import { identifier, type MetadataRow } from "../../scripts/schema-metadata.ts";

export const hostedFixture = JSON.parse(
  await readFile(
    new URL("./fixtures/hosted-schema-metadata.json", import.meta.url),
    "utf8",
  ),
) as {
  source_sha256: string;
  captured_at: string;
  source_rows: number;
  rows: MetadataRow[];
};
const q = identifier;
const table = (r: MetadataRow) =>
  r.object_name.split(".").slice(0, 2).map(q).join(".");
const name = (r: MetadataRow) => {
  const n = r.object_name.split(".").slice(2).join(".");
  return n.startsWith('"') ? n.slice(1, -1).replaceAll('""', '"') : n;
};

/** Reconstruct application DDL from actual catalog metadata, without business data.
 * Supabase-owned auth/storage internals are deliberately NOT recreated/replaced. */
export async function createHostedDatabase() {
  const db = await createPlatformDatabase();
  const rows = hostedFixture.rows;
  try {
    // Confirmed postgres/public table defaults in the export. Platform-owned
    // defaults and role memberships are outside this isolated emulator.
    await db.exec(
      "ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON TABLES TO anon,authenticated,service_role",
    );
    await db.exec(
      "SET check_function_bodies=off; SET search_path=public,extensions",
    );
    for (const r of rows.filter((r) => r.section === "11_custom_type")) {
      const labels = r.details["enum_labels"] as string[];
      if (labels)
        await db.exec(
          `CREATE TYPE ${r.object_name} AS ENUM (${labels.map((v) => `'${v.replaceAll("'", "''")}'`).join(",")})`,
        );
    }
    for (const r of rows.filter((r) => r.section === "02_relation")) {
      const columns = rows
        .filter(
          (c) =>
            c.section === "03_column" &&
            c.object_name.startsWith(r.object_name + "."),
        )
        .sort(
          (a, b) =>
            Number(a.details["position"]) - Number(b.details["position"]),
        );
      await db.exec(
        `CREATE TABLE ${r.object_name} (${columns.map((c) => `${q(name(c))} ${c.details["type"]}${c.details["default_or_generated_expression"] ? ` DEFAULT ${c.details["default_or_generated_expression"]}` : ""}${c.details["not_null"] ? " NOT NULL" : ""}`).join(",")})`,
      );
      if (r.details["rls_enabled"])
        await db.exec(`ALTER TABLE ${r.object_name} ENABLE ROW LEVEL SECURITY`);
    }
    for (const r of rows.filter((r) => r.section === "08_routine"))
      await db.exec(String(r.details["definition"]));
    const constraints = rows
      .filter((r) => r.section === "04_constraint")
      .sort(
        (a, b) =>
          Number(a.details["kind"] === "f") - Number(b.details["kind"] === "f"),
      );
    for (const r of constraints)
      await db.exec(
        `ALTER TABLE ${table(r)} ADD CONSTRAINT ${q(name(r))} ${r.details["definition"]}`,
      );
    for (const r of rows.filter((r) => r.section === "05_index"))
      await db.exec(
        String(r.details["definition"])
          .replace("CREATE UNIQUE INDEX", "CREATE UNIQUE INDEX IF NOT EXISTS")
          .replace(/^CREATE INDEX /, "CREATE INDEX IF NOT EXISTS "),
      );
    const commands: Record<string, string> = {
      r: "SELECT",
      a: "INSERT",
      w: "UPDATE",
      d: "DELETE",
      "*": "ALL",
    };
    for (const r of rows.filter((r) => r.section === "06_policy")) {
      const d = r.details;
      // object_name already uses pg_catalog.format('%I') for the policy name.
      await db.exec(
        `CREATE POLICY ${q(name(r))} ON ${table(r)} AS ${d["permissive"] ? "PERMISSIVE" : "RESTRICTIVE"} FOR ${commands[String(d["command"])]} TO ${(d["roles"] as string[]).map((role) => (role === "public" ? "PUBLIC" : q(role))).join(",")}${d["using"] ? ` USING (${d["using"]})` : ""}${d["with_check"] ? ` WITH CHECK (${d["with_check"]})` : ""}`,
      );
    }
    for (const r of rows.filter((r) => r.section === "07_trigger"))
      await db.exec(String(r.details["definition"]));
    for (const r of rows.filter((r) =>
      ["02_relation", "08_routine"].includes(r.section),
    )) {
      const target = `${r.section === "02_relation" ? "TABLE" : "FUNCTION"} ${r.object_name}`;
      await db.exec(
        `REVOKE ALL ON ${target} FROM PUBLIC,anon,authenticated,service_role`,
      );
      for (const g of r.details["grants"] as {
        grantee: string;
        privilege: string;
        grantable: boolean;
      }[]) {
        if (
          !["PUBLIC", "anon", "authenticated", "service_role"].includes(
            g.grantee,
          )
        )
          continue;
        await db.exec(
          `GRANT ${g.privilege} ON ${target} TO ${g.grantee === "PUBLIC" ? "PUBLIC" : q(g.grantee)}${g.grantable ? " WITH GRANT OPTION" : ""}`,
        );
      }
    }
    for (const r of rows.filter(
      (r) => r.section === "03_column" && r.details["explicit_column_acl"],
    )) {
      for (const acl of r.details["explicit_column_acl"] as string[]) {
        const m = /^(anon|authenticated|service_role)=([arwx*]+)\//.exec(acl);
        if (!m) throw new Error(`Unsupported column ACL fixture: ${acl}`);
        const privileges: Record<string, string> = {
          a: "INSERT",
          r: "SELECT",
          w: "UPDATE",
          x: "REFERENCES",
        };
        for (const [code, privilege] of Object.entries(privileges))
          if (m[2]!.includes(code))
            await db.exec(
              `GRANT ${privilege} (${q(name(r))}) ON ${table(r)} TO ${q(m[1]!)}`,
            );
      }
    }
    await db.exec("SET check_function_bodies=on");
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}
