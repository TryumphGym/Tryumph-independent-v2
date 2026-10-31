// @vitest-environment node
import { it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { createHostedDatabase } from "./hosted-database";
it("adds polls on the reconstructed hosted registry without rewriting existing Trybes, posts, messages, requests or finance", async () => {
  const db = await createHostedDatabase();
  try {
    const member = "11111111-1111-4111-8111-111111111111",
      other = "22222222-2222-4222-8222-222222222222";
    for (const id of [member, other]) {
      await db.query("INSERT INTO auth.users(id,email) VALUES($1,$2)", [
        id,
        `${id}@fixture.invalid`,
      ]);
      await db.query(
        "INSERT INTO profiles(id,name,role) VALUES($1,'Member','member')",
        [id],
      );
    }
    await db.query(
      "INSERT INTO trybes(id,name,owner_id,kind) VALUES('actual-owned-group','Original community',$1,'member')",
      [member],
    );
    await db.query(
      "INSERT INTO posts(author_id,author_name,trybe,kind,text) VALUES($1,'Member','actual-owned-group','Win','Existing community post')",
      [member],
    );
    await db.query(
      "INSERT INTO friend_requests(requester_id,recipient_id,requester_name,recipient_name) VALUES($1,$2,'Member','Member')",
      [member, other],
    );
    await db.query(
      "INSERT INTO messages(sender_id,recipient_id,sender_name,text) VALUES($1,$2,'Member','Preserve history')",
      [member, other],
    );
    for (const path of [
      "docs/launch/reconciliation/01_stage_apply.sql",
      "migrations/0058_workout_program_builder.sql",
    ])
      await db.exec(
        await readFile(new URL("../../" + path, import.meta.url), "utf8"),
      );
    const tables = [
      "profiles",
      "messages",
      "friend_requests",
      "posts",
      "trybes",
      "trainer_videos",
      "trainer_earnings",
      "private_session_access",
      "program_orders",
      "program_enrollments",
    ];
    const before: Record<string, unknown> = {};
    for (const table of tables)
      before[table] = (
        await db.query(
          `SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY to_jsonb(t)::text`,
        )
      ).rows;
    const policies = (
      await db.query(
        "SELECT polname,polrelid::regclass::text AS relation,pg_get_expr(polqual,polrelid) AS using_expr,pg_get_expr(polwithcheck,polrelid) AS check_expr FROM pg_policy ORDER BY polrelid::regclass::text,polname",
      )
    ).rows;
    const sql = await readFile(
      new URL("../../migrations/0059_trybe_polls.sql", import.meta.url),
      "utf8",
    );
    await db.exec(sql);
    for (const table of tables)
      expect(
        (
          await db.query(
            `SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY to_jsonb(t)::text`,
          )
        ).rows,
      ).toEqual(before[table]);
    const after = (
      await db.query(
        "SELECT polname,polrelid::regclass::text AS relation,pg_get_expr(polqual,polrelid) AS using_expr,pg_get_expr(polwithcheck,polrelid) AS check_expr FROM pg_policy ORDER BY polrelid::regclass::text,polname",
      )
    ).rows;
    for (const policy of policies) expect(after).toContainEqual(policy);
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [
      member,
    ]);
    await db.exec("SET ROLE authenticated");
    await db.query(
      "SELECT save_trybe_poll('actual-owned-group','Ready?','',ARRAY['Yes','Later'],1)",
    );
    await db.exec("RESET ROLE");
    expect((await db.query("SELECT question FROM trybe_polls")).rows).toEqual([
      { question: "Ready?" },
    ]);
    await expect(db.exec(sql)).rejects.toThrow("already exist");
    await db.exec("ROLLBACK");
  } finally {
    await db.close();
  }
}, 30000);
