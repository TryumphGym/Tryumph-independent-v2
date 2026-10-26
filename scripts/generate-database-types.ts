import { format } from "prettier";
import { createTestDatabase } from "../src/test/database.ts";
import { readFile, writeFile } from "node:fs/promises";
const db = await createTestDatabase();
const { rows: columns } = await db.query<{
  table_name: string;
  column_name: string;
  is_nullable: string;
  column_default: string | null;
  udt_name: string;
}>(
  `select table_name,column_name,is_nullable,column_default,udt_name from information_schema.columns where table_schema='public' order by table_name,ordinal_position`,
);
const ts = (type: string): string => {
  if (type.endsWith("[]")) return `(${ts(type.slice(0, -2))})[]`;
  if (type.startsWith("_")) return `(${ts(type.slice(1))})[]`;
  if (type === "jsonb" || type === "json") return "Json";
  if (type === "bool" || type === "boolean") return "boolean";
  if (
    [
      "int2",
      "int4",
      "int8",
      "integer",
      "smallint",
      "bigint",
      "numeric",
      "float4",
      "float8",
      "double precision",
    ].includes(type)
  )
    return "number";
  if (type === "void") return "undefined";
  return "string";
};
const tables = [...new Set(columns.map((c) => c.table_name))]
  .map((table) => {
    const cols = columns.filter((c) => c.table_name === table);
    const fields = (mode: "Row" | "Insert" | "Update") =>
      cols
        .map(
          (c) =>
            `${c.column_name}${mode === "Update" || (mode === "Insert" && (c.column_default !== null || c.is_nullable === "YES")) ? "?" : ""}: ${ts(c.udt_name)}${c.is_nullable === "YES" ? " | null" : ""}`,
        )
        .join(";\n");
    return `${table}: { Row: {${fields("Row")}}; Insert: {${fields("Insert")}}; Update: {${fields("Update")}}; Relationships: [] }`;
  })
  .join(";\n");
const { rows: functions } = await db.query<{
  name: string;
  names: string[];
  types: string[];
  modes: string[] | null;
  defaults: number;
  returns: string;
  setof: boolean;
}>(`
 select p.proname as name,p.proargnames as names,
 ARRAY(select format_type(t,null) from unnest(coalesce(p.proallargtypes,p.proargtypes::oid[])) t) as types,
 p.proargmodes as modes,p.pronargdefaults as defaults,format_type(p.prorettype,null) as returns,p.proretset as setof
 from pg_proc p join pg_namespace n on p.pronamespace=n.oid where n.nspname='public'
 and p.prorettype<>'trigger'::regtype order by p.proname`);
const funcs = functions
  .filter((f) => f.names || f.types.length === 0)
  .map((f) => {
    const input = (f.names ?? [])
      .map((name, i) => ({
        name,
        type: f.types[i]!,
        mode: f.modes?.[i] ?? "i",
      }))
      .filter((x) => x.mode === "i");
    const output = (f.names ?? [])
      .map((name, i) => ({ name, type: f.types[i]!, mode: f.modes?.[i] }))
      .filter((x) => x.mode === "t");
    const result =
      f.setof &&
      !output.length &&
      columns.some((c) => c.table_name === f.returns)
        ? `Database['public']['Tables']['${f.returns}']['Row'][]`
        : output.length
          ? `{${output.map((x) => `${x.name}: ${ts(x.type)}`).join(";")}}[]`
          : ts(f.returns);
    return `${f.name}: {Args: {${input.map((x, i) => `${x.name}${i >= input.length - f.defaults ? "?" : ""}: ${ts(x.type)}`).join(";")}}; Returns: ${result}}`;
  })
  .join(";\n");
const file = new URL("../src/integrations/supabase/types.ts", import.meta.url);
const old = await readFile(file, "utf8");
const helper = old.slice(old.indexOf("type DatabaseWithoutInternals"));
const generated =
  `// Generated from the ordered migrations with npm run db:types. No remote database access.\nexport type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];\nexport type Database = { __InternalSupabase: {PostgrestVersion: "14.18"}; public: { Tables: {${tables}}; Views: Record<never, never>; Functions: {${funcs}}; Enums: {app_role: 'admin'|'moderator'|'user'}; CompositeTypes: Record<never, never> }};\n${helper}`.replaceAll(
    "Args: {}",
    "Args: Record<never, never>",
  );
await writeFile(file, await format(generated, { parser: "typescript" }));
await db.close();
