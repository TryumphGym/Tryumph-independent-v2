// @vitest-environment node
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { createTestDatabase, asUser } from "./database";
const trainer = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const member = "33333333-3333-4333-8333-333333333333";
const admin = "44444444-4444-4444-8444-444444444444";
let db: PGlite;
beforeAll(async () => {
  db = await createTestDatabase();
  for (const [id, role] of [
    [trainer, "trainer"],
    [other, "trainer"],
    [member, "member"],
    [admin, "member"],
  ]) {
    await db.query(
      "INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)",
      [
        id,
        `${id}@test.invalid`,
        JSON.stringify({ requested_role: role, name: role }),
      ],
    );
  }
  await db.query("INSERT INTO user_roles(user_id,role) VALUES($1,'admin')", [
    admin,
  ]);
  await db.query(
    `INSERT INTO certifications(user_id,name,expires,status,verified_at,verified_by) VALUES($1,'CPR/AED',(current_date+365)::text,'verified',now(),$2)`,
    [trainer, admin],
  );
  for (let i = 0; i < 5; i++)
    await db.query(
      "INSERT INTO trainer_videos(user_id,title,path,minutes,review_status,breaks) VALUES($1,'Approved','owned/test.mp4',20,'approved',ARRAY[180,600])",
      [trainer],
    );
}, 30000);
afterAll(async () => {
  await db?.close();
});
async function scalar(sql: string) {
  return (await db.query<Record<string, unknown>>(sql)).rows[0];
}
describe("launch database authorization and lifecycle", () => {
  it("does not create an admin from signup metadata or the historical owner email", async () => {
    const id = "55555555-5555-4555-8555-555555555555";
    await db.query(
      "INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,'mackenzie@tryumphgym.com','{\"role\":\"admin\"}')",
      [id],
    );
    expect(
      (
        await scalar(
          `SELECT count(*)::int AS n FROM user_roles WHERE user_id='${id}'`,
        )
      )?.["n"],
    ).toBe(0);
  });
  it("rejects forged wallet state", async () => {
    await expect(
      asUser(db, member, `UPDATE profiles SET tokens=100 WHERE id='${member}'`),
    ).rejects.toThrow("server managed");
  });
  it("a non-admin cannot verify a trainer", async () => {
    const result = await asUser(
      db,
      member,
      "UPDATE certifications SET status='verified'",
    );
    expect(result.affectedRows).toBe(0);
    await expect(
      asUser(
        db,
        trainer,
        "SELECT review_trainer_video((SELECT id FROM trainer_videos LIMIT 1),'approved','')",
      ),
    ).rejects.toThrow("Admins only");
  });
  it("requires CPR and AED, and rejects expired credentials", async () => {
    await db.exec(
      `UPDATE certifications SET expires=(current_date-1)::text WHERE user_id='${trainer}'`,
    );
    expect(
      (await scalar(`SELECT trainer_is_eligible('${trainer}',false) AS ok`))?.[
        "ok"
      ],
    ).toBe(false);
    await db.exec(
      `UPDATE certifications SET expires=(current_date+365)::text,name='CPR' WHERE user_id='${trainer}'`,
    );
    expect(
      (await scalar(`SELECT trainer_is_eligible('${trainer}',false) AS ok`))?.[
        "ok"
      ],
    ).toBe(false);
    await db.exec(
      `UPDATE certifications SET name='CPR/AED' WHERE user_id='${trainer}'`,
    );
  });
  it("five pending workouts cannot qualify; five approved workouts can", async () => {
    await db.exec(
      `UPDATE trainer_videos SET review_status='pending' WHERE user_id='${trainer}'`,
    );
    await expect(
      asUser(
        db,
        trainer,
        `INSERT INTO live_sessions(trainer_id,trainer_name,title,starts_at) VALUES('${trainer}','Trainer','Class',now()+interval '2 hours')`,
      ),
    ).rejects.toThrow("five approved");
    await db.exec(
      `UPDATE trainer_videos SET review_status='approved' WHERE user_id='${trainer}'`,
    );
    await asUser(
      db,
      trainer,
      `INSERT INTO live_sessions(trainer_id,trainer_name,title,starts_at) VALUES('${trainer}','Trainer','Class',now()+interval '2 hours')`,
    );
  });
  it("keeps pending/rejected videos private to their owner and admins", async () => {
    await db.query(
      "INSERT INTO trainer_videos(user_id,title,path,minutes,review_status) VALUES($1,'Private','own/file.mp4',20,'pending')",
      [other],
    );
    const result = await asUser(
      db,
      member,
      "SELECT title FROM trainer_videos WHERE title='Private'",
    );
    expect(result.rows).toHaveLength(0);
    expect(
      (
        await asUser(
          db,
          other,
          "SELECT title FROM trainer_videos WHERE title='Private'",
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("prevents trainer self-approval through direct writes", async () => {
    await expect(
      asUser(
        db,
        other,
        "UPDATE trainer_videos SET review_status='approved' WHERE title='Private'",
      ),
    ).rejects.toThrow("Admins review");
  });
  it("accepts immutable evidence only in the submitter folder", async () => {
    await expect(
      asUser(
        db,
        trainer,
        `INSERT INTO certifications(user_id,name,document_path) VALUES('${trainer}','CPR','${other}/proof.pdf')`,
      ),
    ).rejects.toThrow("Invalid credential");
    await asUser(
      db,
      trainer,
      `INSERT INTO certifications(user_id,name,expires,document_path) VALUES('${trainer}','CPR/AED',(current_date+365)::text,'${trainer}/proof.pdf')`,
    );
    const r = await asUser(
      db,
      trainer,
      `UPDATE certifications SET document_path='${trainer}/replacement.pdf' WHERE document_path='${trainer}/proof.pdf'`,
    );
    expect(r.affectedRows).toBe(0);
  });
  it("records admin review history and forbids evidence replacement", async () => {
    await asUser(
      db,
      admin,
      `UPDATE certifications SET status='verified' WHERE document_path='${trainer}/proof.pdf'`,
    );
    await expect(
      asUser(
        db,
        admin,
        `UPDATE certifications SET document_path='replacement' WHERE document_path='${trainer}/proof.pdf'`,
      ),
    ).rejects.toThrow("immutable");
    expect(
      (await scalar("SELECT count(*)::int AS n FROM credential_reviews"))?.[
        "n"
      ],
    ).toBe(1);
  });
  it("keeps certificate objects private and prevents replacement/deletion after submission", async () => {
    await asUser(
      db,
      trainer,
      `INSERT INTO storage.objects(bucket_id,name) VALUES('trainer-certificates','${trainer}/proof.pdf')`,
    );
    expect(
      (
        await asUser(
          db,
          member,
          "SELECT * FROM storage.objects WHERE bucket_id='trainer-certificates'",
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await asUser(
          db,
          trainer,
          `DELETE FROM storage.objects WHERE name='${trainer}/proof.pdf'`,
        )
      ).affectedRows,
    ).toBe(0);
    expect(
      (
        await asUser(
          db,
          trainer,
          `UPDATE storage.objects SET name='replacement' WHERE name='${trainer}/proof.pdf'`,
        )
      ).affectedRows,
    ).toBe(0);
  });
  it("enforces storefront ownership on direct writes", async () => {
    await asUser(
      db,
      trainer,
      `INSERT INTO trainer_store_items(trainer_id,title,external_url) VALUES('${trainer}','Product','https://shop.example/item')`,
    );
    expect(
      (
        await asUser(
          db,
          other,
          "UPDATE trainer_store_items SET title='Hijacked' WHERE title='Product'",
        )
      ).affectedRows,
    ).toBe(0);
  });
  it("allows public leader discovery while private member posts stay within the Trybe", async () => {
    await asUser(
      db,
      trainer,
      `INSERT INTO posts(author_id,author_name,trybe,text,visibility) VALUES('${trainer}','Trainer','coach-${trainer}','Public announcement','public')`,
    );
    await asUser(
      db,
      member,
      `INSERT INTO trybe_memberships(user_id,trybe_id) VALUES('${member}','coach-${trainer}')`,
    );
    await asUser(
      db,
      member,
      `INSERT INTO posts(author_id,author_name,trybe,text) VALUES('${member}','Member','coach-${trainer}','Private check-in')`,
    );
    const rows = await asUser(
      db,
      other,
      `SELECT text FROM posts WHERE trybe='coach-${trainer}'`,
    );
    expect(rows.rows).toEqual([{ text: "Public announcement" }]);
    await expect(
      asUser(
        db,
        member,
        `INSERT INTO posts(author_id,author_name,trybe,text,visibility) VALUES('${member}','Member','coach-${trainer}','Leak','public')`,
      ),
    ).rejects.toThrow("Only leaders");
  });
  it("requires membership to interact even with public posts", async () => {
    await expect(
      asUser(
        db,
        other,
        `INSERT INTO post_comments(post_id,author_id,author_name,text) SELECT id,'${other}','Other','No access' FROM posts WHERE visibility='public'`,
      ),
    ).rejects.toThrow("row-level security");
    await expect(
      asUser(
        db,
        other,
        "SELECT moderate_trybe_post((SELECT id FROM posts WHERE visibility='public'),'hide',true)",
      ),
    ).rejects.toThrow("Only this Trybe");
  });
  it("deduplicates paid token webhooks and revokes refunded lots", async () => {
    const q = `SELECT apply_paid_token_checkout('cs_test_tokens','${member}',2,1000,100)`;
    await db.exec(q);
    await db.exec(q);
    expect(
      (await scalar(`SELECT tokens FROM profiles WHERE id='${member}'`))?.[
        "tokens"
      ],
    ).toBe(2);
    await db.exec("SELECT apply_checkout_refund('cs_test_tokens',1000,true)");
    await db.exec("SELECT apply_checkout_refund('cs_test_tokens',1000,true)");
    expect(
      (await scalar(`SELECT tokens FROM profiles WHERE id='${member}'`))?.[
        "tokens"
      ],
    ).toBe(0);
    expect(
      (
        await scalar(
          "SELECT remaining FROM wallet_token_lots WHERE id='cs_test_tokens'",
        )
      )?.["remaining"],
    ).toBe(0);
  });
  it("requires server authority for paid room access", async () => {
    await expect(
      asUser(
        db,
        member,
        `INSERT INTO live_room_access(session_id,user_id,status) SELECT id,'${member}','paid' FROM live_sessions LIMIT 1`,
      ),
    ).rejects.toThrow("permission denied");
  });
  it("deduplicates paid private bookings even after consuming the hold", async () => {
    const hold = await scalar(
      `SELECT hold_private_booking('${trainer}','${member}',current_date+3,'09:00') AS id`,
    );
    const q = `SELECT apply_paid_private_booking('cs_private','${member}','${trainer}',(current_date+3)::text,'09:00',6000,300,5130,'${hold?.["id"]}')`;
    await db.exec(q);
    await db.exec(q);
    expect(
      (
        await scalar(
          "SELECT count(*)::int AS n FROM private_session_access WHERE checkout_id='cs_private'",
        )
      )?.["n"],
    ).toBe(1);
  });
  it("preserves audit history and sets cumulative proportional refund targets", async () => {
    await db.exec("SELECT apply_checkout_refund('cs_private',3000,false)");
    await db.exec("SELECT apply_checkout_refund('cs_private',3000,false)");
    expect(
      (
        await scalar(
          "SELECT reversal_target_cents FROM trainer_earnings WHERE ref='cs_private'",
        )
      )?.["reversal_target_cents"],
    ).toBe(2565);
    await db.exec("SELECT apply_checkout_refund('cs_private',6000,true)");
    expect(
      (
        await scalar(
          "SELECT status FROM private_session_access WHERE checkout_id='cs_private'",
        )
      )?.["status"],
    ).toBe("refunded");
  });
  it("unsigned/unverified impressions cannot mint payable earnings", async () => {
    await expect(
      asUser(
        db,
        member,
        `SELECT apply_verified_ad_settlement('network','event','${trainer}','${trainer}',180,500,50,225)`,
      ),
    ).rejects.toThrow("permission denied");
    expect(
      (
        await scalar(
          "SELECT count(*)::int AS n FROM trainer_earnings WHERE source='ads'",
        )
      )?.["n"],
    ).toBe(0);
  });
  it("rejects invalid water-break timestamps at the DB boundary", async () => {
    await expect(
      db.exec(
        `INSERT INTO trainer_videos(user_id,title,path,minutes,breaks) VALUES('${trainer}','Invalid','path',20,ARRAY[10])`,
      ),
    ).rejects.toThrow("Invalid water break");
  });
  it("claims transfers once and retains the same provider key across process retries", async () => {
    await db.exec(`INSERT INTO checkout_payment_state(checkout_id,kind,user_id,gross_cents,fee_cents) VALUES('cs_race','booking','${member}',1000,100);
   INSERT INTO trainer_earnings(trainer_slug,source,ref,gross_cents,fee_cents,net_cents,share_pct,payout_cents)
   VALUES('${trainer}','oneonone','cs_race',1000,100,900,90,810)`);
    const id = (
      await scalar("SELECT id FROM trainer_earnings WHERE ref='cs_race'")
    )?.["id"];
    const first = await scalar(
      `SELECT * FROM claim_earning_operation('${id}')`,
    );
    expect(first?.["operation_amount"]).toBe(810);
    expect(
      (await db.query(`SELECT * FROM claim_earning_operation('${id}')`)).rows,
    ).toHaveLength(0);
    await db.exec(
      `UPDATE trainer_earnings SET operation_lease_until=now()-interval '1 minute' WHERE id='${id}'`,
    );
    const retry = await scalar(
      `SELECT * FROM claim_earning_operation('${id}')`,
    );
    expect(retry?.["operation_key"]).toBe(first?.["operation_key"]);
    await db.exec("SELECT apply_checkout_refund('cs_race',500,false)");
    await db.exec(
      `SELECT finish_earning_operation('${id}','${first?.["operation_key"]}','tr_test')`,
    );
    expect(
      (await scalar(`SELECT status FROM trainer_earnings WHERE id='${id}'`))?.[
        "status"
      ],
    ).toBe("reversal_due");
    const reversal = await scalar(
      `SELECT * FROM claim_earning_operation('${id}')`,
    );
    expect(reversal?.["operation_amount"]).toBe(405);
    await db.exec("SELECT apply_checkout_refund('cs_race',1000,true)");
    await db.exec(
      `SELECT finish_earning_operation('${id}','${reversal?.["operation_key"]}','trr_first')`,
    );
    const second = await scalar(
      `SELECT * FROM claim_earning_operation('${id}')`,
    );
    expect(second?.["operation_amount"]).toBe(405);
    await db.exec(
      `SELECT finish_earning_operation('${id}','${second?.["operation_key"]}','trr_second')`,
    );
    expect(
      (
        await scalar(
          `SELECT transfer_reversed_cents FROM trainer_earnings WHERE id='${id}'`,
        )
      )?.["transfer_reversed_cents"],
    ).toBe(810);
  });
  it("refunds a second payment for an already paid live class without duplicating earnings", async () => {
    const session = (await scalar("SELECT id FROM live_sessions LIMIT 1"))?.[
      "id"
    ];
    await db.exec(
      `SELECT apply_paid_live_checkout('cs_live_1','${member}','${session}',500,50)`,
    );
    await db.exec(
      `SELECT apply_paid_live_checkout('cs_live_1','${member}','${session}',500,50)`,
    );
    await db.exec(
      `SELECT apply_paid_live_checkout('cs_live_2','${member}','${session}',500,50)`,
    );
    expect(
      (
        await scalar(
          "SELECT count(*)::int AS n FROM trainer_earnings WHERE ref IN ('cs_live_1','cs_live_2')",
        )
      )?.["n"],
    ).toBe(1);
    expect(
      (
        await scalar(
          "SELECT reason FROM refund_jobs WHERE checkout_id='cs_live_2'",
        )
      )?.["reason"],
    ).toBe("duplicate_class_payment");
  });
  it("freezes disputed wallet lots and restores them only after a signed win", async () => {
    await db.exec(
      `SELECT apply_paid_token_checkout('cs_dispute','${member}',2,1000,50)`,
    );
    await db.exec(
      "SELECT apply_payment_dispute('dp_test','cs_dispute','open')",
    );
    expect(
      (
        await scalar(
          "SELECT frozen FROM wallet_token_lots WHERE id='cs_dispute'",
        )
      )?.["frozen"],
    ).toBe(true);
    await db.exec(
      "SELECT apply_payment_dispute('dp_test','cs_dispute','won'); SELECT restore_won_disputes()",
    );
    expect(
      (
        await scalar(
          "SELECT frozen FROM wallet_token_lots WHERE id='cs_dispute'",
        )
      )?.["frozen"],
    ).toBe(false);
    expect(
      (await scalar(`SELECT tokens FROM profiles WHERE id='${member}'`))?.[
        "tokens"
      ],
    ).toBe(2);
  });
  it("deduplicates measured impressions across refreshed playback IDs without creating earnings", async () => {
    const video = (
      await scalar(
        "SELECT id FROM trainer_videos WHERE review_status='approved' LIMIT 1",
      )
    )?.["id"];
    const campaign = (
      await db.query<{ id: string }>(
        "INSERT INTO water_break_campaigns(title,creative_url,destination_url,active) VALUES('Real test fixture','https://cdn.example/sponsor.png','https://sponsor.example',true) RETURNING id",
      )
    ).rows[0]!.id;
    await db.exec(
      `SELECT record_water_break_impression('${campaign}','${video}',180,gen_random_uuid(),'${member}'); SELECT record_water_break_impression('${campaign}','${video}',180,gen_random_uuid(),'${member}')`,
    );
    expect(
      (
        await scalar("SELECT count(*)::int AS n FROM water_break_impressions")
      )?.["n"],
    ).toBe(1);
    expect(
      (
        await scalar(
          "SELECT count(*)::int AS n FROM trainer_earnings WHERE source='ads'",
        )
      )?.["n"],
    ).toBe(0);
  });

  it("refunds only affected wallet units and schedules fractional refunds to finish whole units", async () => {
    await db.exec(
      `SELECT apply_paid_token_checkout('cs_units','${member}',3,1500,99)`,
    );
    await db.exec("SELECT apply_checkout_refund('cs_units',1,false)");
    expect(
      (
        await scalar(
          "SELECT remaining FROM wallet_token_lots WHERE id='cs_units'",
        )
      )?.["remaining"],
    ).toBe(2);
    expect(
      (
        await scalar(
          "SELECT target_cents FROM refund_jobs WHERE checkout_id='cs_units'",
        )
      )?.["target_cents"],
    ).toBe(500);
    await db.exec("SELECT apply_checkout_refund('cs_units',500,false)");
    expect(
      (
        await scalar(
          "SELECT remaining FROM wallet_token_lots WHERE id='cs_units'",
        )
      )?.["remaining"],
    ).toBe(2);
  });
  it("returns a cancelled class token once and keeps its old earning history", async () => {
    const session = (
      await db.query<{ id: string }>(
        `INSERT INTO live_sessions(trainer_id,trainer_name,title,starts_at) VALUES('${trainer}','Trainer','Wallet cancellation',now()+interval '5 hours') RETURNING id`,
      )
    ).rows[0]!.id;
    await db.exec(
      `SELECT redeem_paid_live_token('${member}','${session}'); SELECT redeem_paid_live_token('${member}','${session}')`,
    );
    const balance = (
      await scalar(`SELECT tokens FROM profiles WHERE id='${member}'`)
    )?.["tokens"] as number;
    await db.exec(
      `UPDATE live_sessions SET status='cancelled' WHERE id='${session}'; UPDATE live_sessions SET status='cancelled' WHERE id='${session}'`,
    );
    expect(
      (await scalar(`SELECT tokens FROM profiles WHERE id='${member}'`))?.[
        "tokens"
      ],
    ).toBe(balance + 1);
    expect(
      (
        await scalar(
          `SELECT count(*)::int AS n FROM wallet_redemptions WHERE session_id='${session}'`,
        )
      )?.["n"],
    ).toBe(1);
    expect(
      (
        await scalar(
          `SELECT e.status FROM trainer_earnings e JOIN wallet_redemptions r ON e.ref='wallet:'||r.id::text WHERE r.session_id='${session}'`,
        )
      )?.["status"],
    ).toBe("refunded");
  });

  it("revokes refunded unspent units before revoking a paid class backed by a spent unit", async () => {
    await db.exec(
      `UPDATE wallet_token_lots SET frozen=true WHERE user_id='${member}'; SELECT apply_paid_token_checkout('cs_ordered_units','${member}',3,1500,100)`,
    );
    const session = (
      await db.query<{ id: string }>(
        `INSERT INTO live_sessions(trainer_id,trainer_name,title,starts_at) VALUES('${trainer}','Trainer','Unit test class',now()+interval '7 hours') RETURNING id`,
      )
    ).rows[0]!.id;
    await db.exec(`SELECT redeem_paid_live_token('${member}','${session}')`);
    await db.exec("SELECT apply_checkout_refund('cs_ordered_units',500,false)");
    expect(
      (
        await scalar(
          `SELECT status FROM live_room_access WHERE session_id='${session}' AND user_id='${member}'`,
        )
      )?.["status"],
    ).toBe("paid");
    await db.exec("SELECT apply_checkout_refund('cs_ordered_units',1500,true)");
    expect(
      (
        await scalar(
          `SELECT status FROM live_room_access WHERE session_id='${session}' AND user_id='${member}'`,
        )
      )?.["status"],
    ).toBe("refunded");
  });

  it("restrictive guards still protect private data when an old permissive policy remains", async () => {
    await db.exec(
      "CREATE POLICY unsafe_old_storage_read ON storage.objects FOR SELECT TO authenticated USING(true); CREATE POLICY unsafe_old_video_read ON trainer_videos FOR SELECT TO authenticated USING(true)",
    );
    expect(
      (
        await asUser(
          db,
          other,
          "SELECT * FROM storage.objects WHERE bucket_id='trainer-certificates'",
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await asUser(
          db,
          member,
          "SELECT * FROM trainer_videos WHERE review_status='pending'",
        )
      ).rows,
    ).toHaveLength(0);
    await db.exec(
      "DROP POLICY unsafe_old_storage_read ON storage.objects; DROP POLICY unsafe_old_video_read ON trainer_videos",
    );
  });
  it("replays the ordered upgrade transaction without erasing existing balances, bookings or audit records", async () => {
    const before = await scalar(
      `SELECT tokens,(SELECT count(*) FROM private_session_access) AS private_bookings,(SELECT count(*) FROM wallet_redemptions) AS redemptions,(SELECT count(*) FROM credential_reviews) AS reviews FROM profiles WHERE id='${member}'`,
    );
    const bundle = await readFile(
      new URL("../../docs/launch/upgrade.sql", import.meta.url),
      "utf8",
    );
    await db.exec(bundle);
    const after = await scalar(
      `SELECT tokens,(SELECT count(*) FROM private_session_access) AS private_bookings,(SELECT count(*) FROM wallet_redemptions) AS redemptions,(SELECT count(*) FROM credential_reviews) AS reviews FROM profiles WHERE id='${member}'`,
    );
    expect(after).toEqual(before);
  }, 30000);
});
