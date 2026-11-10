import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";

/** Real isolated PostgreSQL engine; only Supabase platform schemas are emulated.
 * This never connects to the hosted project or applies production SQL. */
export async function createPlatformDatabase() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA extensions;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}');
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean DEFAULT false,
      file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS
      $$ SELECT string_to_array($1,'/') $$;
    -- Cryptographic entropy is irrelevant to these DB fixtures; production uses pgcrypto.
    CREATE FUNCTION extensions.gen_random_bytes(integer) RETURNS bytea LANGUAGE sql AS
      $$ SELECT decode(repeat('ab',$1),'hex') $$;
    GRANT USAGE ON SCHEMA public,auth,storage TO anon,authenticated,service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA storage TO authenticated,service_role;
    CREATE PUBLICATION supabase_realtime;
  `);
  return db;
}

export async function createTestDatabase(through?: string) {
  const db = await createPlatformDatabase();
  const directory = new URL("../../migrations/", import.meta.url);
  for (const file of (await readdir(directory))
    .filter((f) => f.endsWith(".sql") && (!through || f <= through))
    .sort()) {
    try {
      await db.exec(await readFile(new URL(file, directory), "utf8"));
    } catch (error) {
      await db.close();
      throw new Error(`Migration ${file} failed`, { cause: error });
    }
  }
  return db;
}

export async function asUser(db: PGlite, id: string, sql: string) {
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("SET ROLE authenticated");
  try {
    return await db.query(sql);
  } finally {
    await db.exec("RESET ROLE");
  }
}
