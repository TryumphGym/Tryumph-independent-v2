// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { createHostedDatabase } from "./hosted-database";
const trainer = "11111111-1111-4111-8111-111111111111",
  member = "22222222-2222-4222-8222-222222222222",
  admin = "33333333-3333-4333-8333-333333333333",
  video = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
describe("additive programs on the inspected mixed hosted contract", () => {
  it("preserves legacy programs, workouts, stores, messages, profiles and payments after the reviewed reconciliation", async () => {
    const db = await createHostedDatabase();
    try {
      for (const [id, role] of [
        [trainer, "trainer"],
        [member, "member"],
        [admin, "member"],
      ]) {
        await db.query("INSERT INTO auth.users(id,email) VALUES($1,$2)", [
          id,
          `${id}@fixture.invalid`,
        ]);
        await db.query("INSERT INTO profiles(id,name,role) VALUES($1,$2,$3)", [
          id,
          role,
          role,
        ]);
      }
      await db.exec(`INSERT INTO user_roles(user_id,role) VALUES('${admin}','admin');
    INSERT INTO certifications(user_id,name,expires,status,verified_at,verified_by) VALUES('${trainer}','CPR/AED',(current_date+365)::text,'verified',now(),'${admin}');
    INSERT INTO trainer_videos(id,user_id,title,path,minutes,review_status) VALUES('${video}','${trainer}','Existing approved','bunny:123:${video}',20,'approved');
    INSERT INTO trainer_programs(id,trainer_id,title,description,published) VALUES('${video}','${trainer}','Existing playlist','Preserve this legacy plan',true);
    INSERT INTO trainer_program_workouts(program_id,video_id,position) VALUES('${video}','${video}',0);
    INSERT INTO trainer_store_items(trainer_id,title,external_url) VALUES('${trainer}','Existing store','https://example.com/store');
    INSERT INTO friendships(user_id,friend_id,friend_name,partner) VALUES('${trainer}','${member}','Member',true),('${member}','${trainer}','Trainer',true);
    INSERT INTO friend_requests(requester_id,recipient_id,requester_name,recipient_name) VALUES('${member}','${admin}','Member','Admin');
    INSERT INTO messages(sender_id,recipient_id,sender_name,text) VALUES('${member}','${trainer}','Member','Existing conversation');
    INSERT INTO private_session_access(checkout_id,trainer_id,member_id,day,time,starts_at,status) VALUES('cs_preserved','${trainer}','${member}',current_date+5,'09:00',now()+interval '5 days','paid');
    INSERT INTO checkout_payment_state(checkout_id,kind,user_id,gross_cents,fee_cents) VALUES('cs_preserved','booking','${member}',5000,200);
    INSERT INTO trainer_earnings(trainer_slug,source,ref,gross_cents,fee_cents,net_cents,share_pct,payout_cents) VALUES('${trainer}','oneonone','cs_preserved',5000,200,4800,90,4320);`);
      await db.exec(
        await readFile(
          new URL(
            "../../docs/launch/reconciliation/01_stage_apply.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      const policies = (
        await db.query(
          "SELECT polname,polrelid::regclass::text AS relation,pg_get_expr(polqual,polrelid) AS using_expr,pg_get_expr(polwithcheck,polrelid) AS check_expr,polcmd,polpermissive,polroles::text FROM pg_policy ORDER BY polrelid::regclass::text,polname",
        )
      ).rows;
      const before: Record<string, unknown> = {};
      const tables = [
        "profiles",
        "messages",
        "friend_requests",
        "private_session_access",
        "checkout_payment_state",
        "trainer_earnings",
        "trainer_store_items",
        "trainer_programs",
        "trainer_program_workouts",
        "trainer_videos",
      ];
      for (const table of tables)
        before[table] = (
          await db.query(
            `SELECT to_jsonb(t) AS record FROM ${table} t ORDER BY to_jsonb(t)::text`,
          )
        ).rows;
      const sql = await readFile(
        new URL(
          "../../migrations/0058_workout_program_builder.sql",
          import.meta.url,
        ),
        "utf8",
      );
      await db.exec(sql);
      const afterPolicies = (
        await db.query(
          "SELECT polname,polrelid::regclass::text AS relation,pg_get_expr(polqual,polrelid) AS using_expr,pg_get_expr(polwithcheck,polrelid) AS check_expr,polcmd,polpermissive,polroles::text FROM pg_policy ORDER BY polrelid::regclass::text,polname",
        )
      ).rows;
      for (const policy of policies)
        expect(afterPolicies).toContainEqual(policy);
      for (const table of tables) {
        const excluded =
          table === "trainer_programs"
            ? "ARRAY['builder_version','summary','current_edition','blocked']"
            : table === "trainer_videos"
              ? "ARRAY['access_scope']"
              : "ARRAY[]::text[]";
        expect(
          (
            await db.query(
              `SELECT to_jsonb(t)-${excluded} AS record FROM ${table} t ORDER BY to_jsonb(t)::text`,
            )
          ).rows,
        ).toEqual(before[table]);
      }
      await db.exec(
        "SELECT set_config('request.jwt.claim.sub','',false); SET ROLE anon",
      );
      expect(
        (await db.query("SELECT title FROM trainer_programs")).rows,
      ).toEqual([{ title: "Existing playlist" }]);
      expect((await db.query("SELECT title FROM trainer_videos")).rows).toEqual(
        [{ title: "Existing approved" }],
      );
      await db.exec("RESET ROLE");
      await expect(db.exec(sql)).rejects.toThrow(
        "Program schema already exists",
      );
      await db.exec("ROLLBACK");
      expect(
        (await db.query("SELECT title FROM trainer_programs")).rows,
      ).toEqual([{ title: "Existing playlist" }]);
    } finally {
      await db.close();
    }
  }, 30000);
});
