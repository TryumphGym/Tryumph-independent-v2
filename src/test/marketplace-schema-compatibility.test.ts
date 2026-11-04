// @vitest-environment node
import { it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { createHostedDatabase } from "./hosted-database";
it("applies all marketplace modules to the actual inspected mixed schema after reconciliation, preserving data and the manual trainer inquiry policy", async () => {
  const db = await createHostedDatabase();
  try {
    const member = "11111111-1111-4111-8111-111111111111",
      trainer = "22222222-2222-4222-8222-222222222222";
    for (const [id, role] of [
      [member, "member"],
      [trainer, "trainer"],
    ]) {
      await db.query("INSERT INTO auth.users(id,email) VALUES($1,$2)", [
        id,
        `${id}@fixture.invalid`,
      ]);
      await db.query("INSERT INTO profiles(id,name,role) VALUES($1,$2,$2)", [
        id,
        role,
      ]);
    }
    await db.exec(
      `INSERT INTO trybes(id,name,owner_id,kind) VALUES('real-group','Existing group','${member}','member');INSERT INTO posts(author_id,author_name,trybe,kind,text) VALUES('${member}','Member','real-group','Post','Existing post');INSERT INTO messages(sender_id,recipient_id,sender_name,text) VALUES('${member}','${trainer}','Member','Existing inquiry');INSERT INTO friend_requests(requester_id,recipient_id,requester_name,recipient_name) VALUES('${member}','${trainer}','Member','Trainer');INSERT INTO trainer_store_items(trainer_id,title,external_url) VALUES('${trainer}','Existing storefront','https://example.com/store');INSERT INTO trainer_videos(user_id,title,path,minutes,review_status) VALUES('${trainer}','Existing approved','owned/video.mp4',10,'approved');INSERT INTO private_session_access(checkout_id,trainer_id,member_id,day,time,starts_at,status) VALUES('cs_history','${trainer}','${member}',current_date+10,'09:00',now()+interval '10 days','paid');INSERT INTO trainer_earnings(trainer_slug,source,ref,gross_cents,fee_cents,net_cents,share_pct,payout_cents) VALUES('${trainer}','oneonone','cs_history',5000,200,4800,90,4320);`,
    );
    for (const path of [
      "docs/launch/reconciliation/01_stage_apply.sql",
      "migrations/0058_workout_program_builder.sql",
      "migrations/0059_trybe_polls.sql",
    ])
      await db.exec(
        await readFile(new URL("../../" + path, import.meta.url), "utf8"),
      );
    const inquirySql =
      "SELECT polname,pg_get_expr(polqual,polrelid) using_expr,pg_get_expr(polwithcheck,polrelid) check_expr,polcmd,polpermissive,polroles::text FROM pg_policy WHERE polrelid='public.messages'::regclass ORDER BY polname";
    const beforePolicy = (await db.query(inquirySql)).rows;
    expect(beforePolicy.length).toBeGreaterThan(0);
    const tables = [
      "profiles",
      "posts",
      "messages",
      "friend_requests",
      "trainer_videos",
      "trainer_earnings",
      "private_session_access",
      "trainer_store_items",
    ];
    const before: Record<string, unknown> = {};
    for (const t of tables)
      before[t] = (
        await db.query(
          `SELECT to_jsonb(t) r FROM ${t} t ORDER BY to_jsonb(t)::text`,
        )
      ).rows;
    for (const path of [
      "migrations/0060_creator_memberships.sql",
      "migrations/0061_creator_content.sql",
      "migrations/0062_discovery_and_downloads.sql",
      "migrations/0063_everyday_discovery.sql",
      "migrations/0064_community_photos_and_ads.sql",
      "migrations/0065_creator_studio_core.sql",
      "migrations/0066_creator_studio_access.sql",
      "migrations/0067_creator_program_benefits.sql",
      "migrations/0068_creator_demand.sql",
      "migrations/0069_creator_business_metrics.sql",
      "migrations/0070_creator_spotlight_foundation.sql",
      "migrations/0071_creator_program_analytics.sql",
      "migrations/0072_creator_comment_moderation.sql",
      "migrations/0073_included_live_payment_reconciliation.sql",
    ])
      await db.exec(
        await readFile(new URL("../../" + path, import.meta.url), "utf8"),
      );
    for (const t of tables) {
      const extra =
        t === "profiles"
          ? "ARRAY['focus_tags']"
          : t === "posts"
            ? "ARRAY['audience','media_revision','ad_safe']"
            : t === "trainer_videos"
              ? "ARRAY['discovery_tags','intensity','modification_notes']"
              : "ARRAY[]::text[]";
      expect(
        (
          await db.query(
            `SELECT to_jsonb(t)-${extra} r FROM ${t} t ORDER BY to_jsonb(t)::text`,
          )
        ).rows,
      ).toEqual(before[t]);
    }
    expect((await db.query(inquirySql)).rows).toEqual(beforePolicy);
    await db.query(
      "INSERT INTO certifications(user_id,name,expires,status,verified_at,verified_by) VALUES($1,'CPR/AED',(current_date+365)::text,'verified',now(),$2)",
      [trainer, member],
    );
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [
      member,
    ]);
    await db.exec("SET ROLE authenticated");
    await db.query(
      "INSERT INTO messages(sender_id,recipient_id,sender_name,text) VALUES($1,$2,'Member','New trainer inquiry remains permitted')",
      [member, trainer],
    );
    await db.exec("RESET ROLE");
    expect(
      (await db.query("SELECT count(*)::int n FROM messages")).rows,
    ).toEqual([{ n: 2 }]);
  } finally {
    await db.close();
  }
}, 30000);
