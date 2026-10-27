// @vitest-environment node
import {
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  describe,
  it,
  expect,
} from "vitest";
import { readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDatabase } from "./database";
const trainer = "11111111-1111-4111-8111-111111111111",
  member = "22222222-2222-4222-8222-222222222222",
  stranger = "33333333-3333-4333-8333-333333333333",
  admin = "44444444-4444-4444-8444-444444444444";
let db: PGlite;
async function row(sql: string) {
  return (await db.query<Record<string, unknown>>(sql)).rows[0]!;
}
async function acting(id: string, sql: string) {
  await db.exec("SAVEPOINT actor");
  try {
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec("SET ROLE authenticated");
    const results = await db.exec(sql);
    await db.exec("RESET ROLE; RELEASE SAVEPOINT actor");
    return results.at(-1)!.rows as Record<string, unknown>[];
  } catch (error) {
    await db.exec(
      "ROLLBACK TO SAVEPOINT actor; RESET ROLE; RELEASE SAVEPOINT actor",
    );
    throw error;
  }
}
async function deposit(
  id = "cs_deposit",
  day = "current_date+2",
  time = "09:00",
) {
  const h = (
    await row(
      `SELECT prepare_deposit_booking('${trainer}','${member}',${day},'${time}','private-deposit-v1') h`,
    )
  )["h"];
  await db.exec(
    `SELECT apply_private_deposit('${id}','${h}','${member}',2500,103,'cus_test','pm_test','pi_${id}')`,
  );
  return String(h);
}
beforeAll(async () => {
  db = await createTestDatabase();
  for (const [id, role] of [
    [trainer, "trainer"],
    [member, "member"],
    [stranger, "member"],
    [admin, "member"],
  ])
    await db.query(
      "INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)",
      [
        id,
        `${id}@test.invalid`,
        JSON.stringify({ requested_role: role, name: role }),
      ],
    );
  await db.exec(`INSERT INTO user_roles(user_id,role) VALUES('${admin}','admin');
 UPDATE profiles SET extra='{"trainer":{"rate":100}}' WHERE id='${trainer}';
 INSERT INTO certifications(user_id,name,expires,status,verified_at,verified_by) VALUES('${trainer}','CPR/AED',(current_date+365)::text,'verified',now(),'${admin}');
 INSERT INTO trainer_videos(user_id,title,path,minutes,review_status) SELECT '${trainer}','Approved','${trainer}/workout.mp4',20,'approved' FROM generate_series(1,5);`);
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec("BEGIN");
});
afterEach(async () => {
  await db.exec("ROLLBACK");
});
describe("launch completion: safety, messaging and activity at the real SQL boundary", () => {
  it("enforces targeted audiences and rejects role switching and official impersonation", async () => {
    await expect(
      acting(
        member,
        "SELECT publish_targeted_announcement('Hidden','trainers')",
      ),
    ).rejects.toThrow("Admins only");
    await acting(
      admin,
      "SELECT publish_targeted_announcement('Trainer private','trainers'); SELECT publish_targeted_announcement('Member private','members'); SELECT publish_official_announcement('Public official');",
    );
    expect(
      (await acting(member, "SELECT body FROM audience_announcements")).map(
        (x) => x["body"],
      ),
    ).toEqual(["Member private"]);
    expect(
      (await acting(trainer, "SELECT body FROM audience_announcements")).map(
        (x) => x["body"],
      ),
    ).toEqual(["Trainer private"]);
    await expect(
      acting(member, `UPDATE profiles SET role='trainer' WHERE id='${member}'`),
    ).rejects.toThrow("role changes");
    expect(
      await row(
        "SELECT author_name,official FROM posts WHERE trybe='official'",
      ),
    ).toMatchObject({ author_name: "Tryumph Gym", official: true });
    await expect(
      acting(
        member,
        `INSERT INTO posts(author_id,author_name,trybe,text,visibility,official) VALUES('${member}','Tryumph Gym','official','fake','public',true)`,
      ),
    ).rejects.toThrow();
  });
  it("gives moderation only an allowlisted profile directory, not private wellness records", async () => {
    expect(
      await acting(admin, `SELECT id FROM profiles WHERE id='${member}'`),
    ).toHaveLength(0);
    const directory = await acting(
      admin,
      "SELECT * FROM admin_profile_directory()",
    );
    expect(directory).toHaveLength(4);
    expect(Object.keys(directory[0]!)).toEqual([
      "id",
      "name",
      "role",
      "created_at",
    ]);
    await expect(
      acting(member, "SELECT * FROM admin_profile_directory()"),
    ).rejects.toThrow("Admins only");
  });
  it("keeps friend messages working and permits inquiries/replies but rejects strangers, spoofing and old broad policies", async () => {
    await db.exec(
      "CREATE POLICY old_broad_send ON messages FOR INSERT TO authenticated WITH CHECK(true); CREATE POLICY old_broad_read ON messages FOR SELECT TO authenticated USING(true)",
    );
    await expect(
      acting(
        member,
        `INSERT INTO messages(sender_id,recipient_id,sender_name,text) VALUES('${member}','${stranger}','spoof','No')`,
      ),
    ).rejects.toThrow();
    await acting(
      member,
      `INSERT INTO messages(sender_id,recipient_id,sender_name,text) VALUES('${member}','${trainer}','spoof','Inquiry')`,
    );
    await acting(
      trainer,
      `INSERT INTO messages(sender_id,recipient_id,sender_name,text) VALUES('${trainer}','${member}','spoof','Reply')`,
    );
    expect(
      (
        await acting(
          member,
          "SELECT sender_name FROM messages WHERE text='Inquiry'",
        )
      )[0]?.["sender_name"],
    ).toBe("member");
    await db.exec(
      `INSERT INTO friendships(user_id,friend_id,friend_name,partner) VALUES('${member}','${stranger}','Friend',true)`,
    );
    await acting(
      member,
      `INSERT INTO messages(sender_id,recipient_id,sender_name,text) VALUES('${member}','${stranger}','Member','Friend message')`,
    );
    expect(await acting(admin, "SELECT * FROM messages")).toHaveLength(0);
  });
  it("blocks both directions and enforces server message limits", async () => {
    await acting(
      member,
      `INSERT INTO messages(sender_id,recipient_id,sender_name,text) VALUES('${member}','${trainer}','Member','Hello')`,
    );
    await acting(
      trainer,
      `INSERT INTO message_controls(user_id,other_id,blocked) VALUES('${trainer}','${member}',true)`,
    );
    await expect(
      acting(
        member,
        `INSERT INTO messages(sender_id,recipient_id,sender_name,text) VALUES('${member}','${trainer}','Member','blocked')`,
      ),
    ).rejects.toThrow();
    await acting(
      trainer,
      `UPDATE message_controls SET blocked=false WHERE user_id='${trainer}'`,
    );
    await db.exec(
      `INSERT INTO messages(sender_id,recipient_id,sender_name,text) SELECT '${member}','${trainer}','Member','Repeated' FROM generate_series(1,9)`,
    );
    await expect(
      acting(
        member,
        `INSERT INTO messages(sender_id,recipient_id,sender_name,text) VALUES('${member}','${trainer}','Member','Eleventh')`,
      ),
    ).rejects.toThrow("limit");
  });
  it("accepts participant-selected message evidence without giving administrators inbox access", async () => {
    await acting(
      member,
      `INSERT INTO messages(sender_id,recipient_id,sender_name,text) VALUES('${member}','${trainer}','Member','Reported text')`,
    );
    const id = (await row("SELECT id FROM messages LIMIT 1"))["id"];
    await expect(
      acting(
        stranger,
        `INSERT INTO content_reports(reporter_id,target_type,target_id,reason) VALUES('${stranger}','message','${id}','harassment')`,
      ),
    ).rejects.toThrow("inaccessible");
    await acting(
      member,
      `INSERT INTO content_reports(reporter_id,target_type,target_id,reason) VALUES('${member}','message','${id}','harassment')`,
    );
    expect(
      await acting(stranger, "SELECT * FROM content_reports"),
    ).toHaveLength(0);
    expect(await acting(admin, "SELECT * FROM messages")).toHaveLength(0);
    expect(
      (await acting(admin, "SELECT evidence FROM content_reports"))[0]?.[
        "evidence"
      ],
    ).toBe("Reported text");
    const report = (await row("SELECT id FROM content_reports"))["id"];
    await acting(
      admin,
      `SELECT review_content_report('${report}','resolved','Reviewed reported evidence')`,
    );
    expect(
      (await row("SELECT count(*)::int n FROM moderation_actions"))["n"],
    ).toBe(1);
  });
  it("applies reversible admin restrictions and accepts an appeal without allowing self-restoration", async () => {
    await expect(
      acting(
        member,
        `SELECT restrict_account('${trainer}','suspended',true,'Bad')`,
      ),
    ).rejects.toThrow();
    await acting(
      admin,
      `SELECT restrict_account('${trainer}','suspended',true,'Safety investigation')`,
    );
    expect(
      (await row(`SELECT trainer_is_eligible('${trainer}',false) ok`))["ok"],
    ).toBe(false);
    await acting(
      trainer,
      `INSERT INTO moderation_appeals(user_id,body) VALUES('${trainer}','Please review my evidence')`,
    );
    await expect(
      acting(trainer, "UPDATE account_restrictions SET active=false"),
    ).rejects.toThrow("permission denied");
  });
  it("records local days atomically, retains known history, and refuses forged profile activity", async () => {
    await db.exec(
      `UPDATE profiles SET active_days='["2026-01-01","2026-01-02"]' WHERE id='${member}'`,
    );
    await acting(
      member,
      "SELECT record_account_activity('America/Chicago'); SELECT record_account_activity('America/Chicago')",
    );
    expect(
      (
        await row(
          `SELECT jsonb_array_length(active_days)::int n FROM profiles WHERE id='${member}'`,
        )
      )["n"],
    ).toBe(3);
    await acting(
      member,
      `UPDATE profiles SET active_days='["2020-01-01"]' WHERE id='${member}'`,
    );
    expect(
      (
        await row(
          `SELECT jsonb_array_length(active_days)::int n FROM profiles WHERE id='${member}'`,
        )
      )["n"],
    ).toBe(3);
    await expect(
      acting(member, "SELECT record_account_activity('invented zone')"),
    ).rejects.toThrow();
  });
  it("deduplicates credential alerts and allows a current replacement to unlock new activity", async () => {
    await db.exec(
      `UPDATE certifications SET expires=(current_date+7)::text; SELECT generate_credential_alerts(); SELECT generate_credential_alerts()`,
    );
    expect(
      (
        await row(
          "SELECT count(*)::int n FROM account_notifications WHERE category='credential'",
        )
      )["n"],
    ).toBe(1);
    await db.exec(
      `UPDATE certifications SET expires=(current_date-1)::text; INSERT INTO certifications(user_id,name,expires,status,verified_at,verified_by) VALUES('${trainer}','CPR/AED',(current_date+365)::text,'verified',now(),'${admin}')`,
    );
    expect(
      (await row(`SELECT trainer_is_eligible('${trainer}',false) ok`))["ok"],
    ).toBe(true);
    await db.exec(
      `DELETE FROM certifications WHERE expires>(current_date+30)::text`,
    );
    await expect(
      acting(
        trainer,
        `INSERT INTO trainer_videos(user_id,title,path,minutes) VALUES('${trainer}','New','${trainer}/x.mp4',20)`,
      ),
    ).rejects.toThrow();
    expect(
      await acting(
        member,
        "SELECT id FROM trainer_videos WHERE review_status='approved'",
      ),
    ).toHaveLength(5);
  });
});
describe("launch completion: deposit, attendance, refunds and transfer state machines", () => {
  it("reserves a community class without consuming a token, consumes once only after verified attendance", async () => {
    await db.exec(
      `SELECT apply_paid_token_checkout('cs_wallet','${member}',1,500,44)`,
    );
    const s = (
      await row(
        `INSERT INTO live_sessions(trainer_id,trainer_name,title,starts_at) VALUES('${trainer}','Trainer','Attendance',now()+interval '2 minutes') RETURNING id`,
      )
    )["id"];
    await db.exec(
      `SELECT reserve_live_class('${member}','${s}'); SELECT redeem_paid_live_token('${member}','${s}')`,
    );
    expect(
      (await row(`SELECT tokens FROM profiles WHERE id='${member}'`))["tokens"],
    ).toBe(1);
    expect(
      (await row("SELECT count(*)::int n FROM trainer_earnings"))["n"],
    ).toBe(0);
    await expect(
      acting(member, `SELECT consume_attended_live_token('${member}','${s}')`),
    ).rejects.toThrow("permission denied");
    await db.exec(
      `SELECT consume_attended_live_token('${member}','${s}'); SELECT consume_attended_live_token('${member}','${s}')`,
    );
    expect(
      (await row(`SELECT tokens FROM profiles WHERE id='${member}'`))["tokens"],
    ).toBe(0);
    expect(
      (await row("SELECT payout_cents FROM trainer_earnings"))["payout_cents"],
    ).toBe(228);
  });
  it("collects only the deposit at booking, replays safely and creates no unearned payout", async () => {
    const h = await deposit();
    await db.exec(
      `SELECT apply_private_deposit('cs_deposit','${h}','${member}',2500,103,'cus_test','pm_test','pi_cs_deposit')`,
    );
    expect(
      await row(
        "SELECT payment_version,total_cents,deposit_cents,balance_cents,status FROM private_session_access",
      ),
    ).toMatchObject({
      payment_version: 2,
      total_cents: 10000,
      deposit_cents: 2500,
      balance_cents: 7500,
      status: "deposit_paid",
    });
    expect(
      (await row("SELECT count(*)::int n FROM private_booking_payments"))["n"],
    ).toBe(1);
    expect(
      (await row("SELECT count(*)::int n FROM trainer_earnings"))["n"],
    ).toBe(0);
    await expect(
      db.exec(
        "SELECT apply_private_balance('cs_deposit','pi_balance',7500,200)",
      ),
    ).rejects.toThrow("Invalid balance");
  });
  it("requires current eligibility and a valid time for attendance and serializes balance operations", async () => {
    await deposit();
    expect(
      (await row("SELECT record_private_both_present('cs_deposit') ok"))["ok"],
    ).toBe(false);
    await db.exec("UPDATE private_session_access SET starts_at=now()");
    expect(
      (await row("SELECT record_private_both_present('cs_deposit') ok"))["ok"],
    ).toBe(true);
    expect(
      (await db.query("SELECT * FROM claim_private_balance('cs_deposit')"))
        .rows,
    ).toHaveLength(1);
    expect(
      (await db.query("SELECT * FROM claim_private_balance('cs_deposit')"))
        .rows,
    ).toHaveLength(0);
    await db.exec(
      "SELECT apply_private_balance('cs_deposit','pi_balance',7500,200); SELECT apply_private_balance('cs_deposit','pi_balance',7500,200)",
    );
    expect(
      (await row("SELECT status FROM private_session_access"))["status"],
    ).toBe("paid");
    expect(
      (await row("SELECT count(*)::int n FROM trainer_earnings"))["n"],
    ).toBe(0);
  });
  it("queues full refunds for cancellation racing a successful balance and never grants access", async () => {
    await deposit();
    await db.exec(
      "UPDATE private_session_access SET starts_at=now(); SELECT record_private_both_present('cs_deposit'); SELECT * FROM claim_private_balance('cs_deposit')",
    );
    await db.exec(
      `SELECT cancel_private_session('cs_deposit','${member}'); SELECT apply_private_balance('cs_deposit','pi_balance',7500,200)`,
    );
    expect(
      (await row("SELECT status FROM private_session_access"))["status"],
    ).toBe("cancelled");
    expect((await row("SELECT count(*)::int n FROM refund_jobs"))["n"]).toBe(2);
  });
  it("requires mutual consent for one same-trainer deposit transfer and preserves the original charge", async () => {
    await deposit();
    const req = (
      await acting(
        member,
        "SELECT request_private_reschedule('cs_deposit',current_date+3,'12:00') id",
      )
    )[0]!["id"];
    await expect(
      acting(stranger, `SELECT approve_private_reschedule('${req}',true)`),
    ).rejects.toThrow();
    const target = (
      await acting(
        trainer,
        `SELECT approve_private_reschedule('${req}',true) id`,
      )
    )[0]!["id"];
    expect(
      await row(
        `SELECT deposit_origin,transfer_used,total_cents FROM private_session_access WHERE checkout_id='${target}'`,
      ),
    ).toMatchObject({
      deposit_origin: "cs_deposit",
      transfer_used: true,
      total_cents: 10000,
    });
    await expect(
      acting(
        member,
        `SELECT request_private_reschedule('${target}',current_date+4,'12:00')`,
      ),
    ).rejects.toThrow("cannot be transferred");
    expect(
      (await row("SELECT count(*)::int n FROM private_booking_payments"))["n"],
    ).toBe(1);
    await db.exec(`SELECT cancel_private_session('${target}','${member}')`);
    expect(
      (await row("SELECT checkout_id FROM refund_jobs"))["checkout_id"],
    ).toBe("cs_deposit");
  });
  it("holds future bookings on expiry, notifies both parties, and refunds instead of resurrecting the session", async () => {
    await deposit();
    await db.exec(
      "UPDATE certifications SET expires=(current_date-1)::text; SELECT maintain_private_bookings(); SELECT maintain_private_bookings()",
    );
    expect(
      (await row("SELECT status FROM private_session_access"))["status"],
    ).toBe("credential_hold");
    expect(
      (
        await row(
          "SELECT count(*)::int n FROM account_notifications WHERE event_key LIKE 'credential-hold:%'",
        )
      )["n"],
    ).toBe(2);
    await db.exec(
      "UPDATE private_session_access SET starts_at=now()-interval '1 minute'; SELECT maintain_private_bookings()",
    );
    expect((await row("SELECT count(*)::int n FROM refund_jobs"))["n"]).toBe(1);
  });
  it("does not expose reusable payment identifiers or permit client settlement", async () => {
    await deposit();
    await expect(
      acting(member, "SELECT * FROM private_payment_methods"),
    ).rejects.toThrow("permission denied");
    await expect(
      acting(
        member,
        "SELECT apply_private_balance('cs_deposit','pi_forged',7500,0)",
      ),
    ).rejects.toThrow("permission denied");
  });
  it("applies the complete ordered upgrade again without losing a deposit or its frozen price", async () => {
    await deposit();
    const before = await row(
      "SELECT checkout_id,status,total_cents,deposit_origin FROM private_session_access",
    );
    const sql = await readFile(
      new URL("../../docs/launch/upgrade.sql", import.meta.url),
      "utf8",
    );
    // Run its body inside this test's rollback transaction; production bundle retains BEGIN/COMMIT.
    await db.exec(
      sql.slice(sql.indexOf("BEGIN;\n") + 7, sql.lastIndexOf("COMMIT;")),
    );
    const incremental = await readFile(
      new URL("../../docs/launch/completion.sql", import.meta.url),
      "utf8",
    );
    await db.exec(
      incremental.slice(
        incremental.indexOf("BEGIN;\n") + 7,
        incremental.lastIndexOf("COMMIT;"),
      ),
    );
    expect(
      await row(
        "SELECT checkout_id,status,total_cents,deposit_origin FROM private_session_access",
      ),
    ).toEqual(before);
    expect(
      (await row("SELECT count(*)::int n FROM private_booking_payments"))["n"],
    ).toBe(1);
  });
  it("preserves already-paid legacy bookings and never creates a balance operation", async () => {
    await db.exec(
      `INSERT INTO private_session_access(checkout_id,trainer_id,member_id,day,time,starts_at,status) VALUES('legacy','${trainer}','${member}',current_date-5,'09:00',now()-interval '5 days','paid'); SELECT maintain_private_bookings()`,
    );
    expect(
      await row("SELECT status,payment_version FROM private_session_access"),
    ).toMatchObject({ status: "paid", payment_version: 1 });
    expect(
      (await row("SELECT count(*)::int n FROM private_balance_operations"))[
        "n"
      ],
    ).toBe(0);
  });
  it("refuses a second balance and does not pay out until the member confirms received service", async () => {
    await deposit();
    await db.exec(
      "UPDATE private_session_access SET starts_at=now(); SELECT record_private_both_present('cs_deposit'); SELECT * FROM claim_private_balance('cs_deposit'); SELECT apply_private_balance('cs_deposit','pi_balance',7500,200)",
    );
    await db.exec(
      "UPDATE private_session_access SET starts_at=now()-interval '2 hours',both_present_at=now()-interval '70 minutes'; SELECT maintain_private_bookings()",
    );
    expect(
      (await row("SELECT count(*)::int n FROM trainer_earnings"))["n"],
    ).toBe(0);
    expect(
      (await row("SELECT count(*)::int n FROM private_room_shutdown_jobs"))[
        "n"
      ],
    ).toBe(1);
    await expect(
      acting(trainer, "SELECT confirm_private_delivery('cs_deposit')"),
    ).rejects.toThrow();
    await acting(member, "SELECT confirm_private_delivery('cs_deposit')");
    expect(
      (await row("SELECT sum(payout_cents)::int payout FROM trainer_earnings"))[
        "payout"
      ],
    ).toBe(Math.floor((2500 - 103) * 0.9) + Math.floor((7500 - 200) * 0.9));
  });
  it("refunds a rescheduled deposit and balance together on an unfulfilled cancellation", async () => {
    await deposit();
    const req = (
      await acting(
        member,
        "SELECT request_private_reschedule('cs_deposit',current_date+3,'12:00') id",
      )
    )[0]!["id"];
    const target = (
      await acting(
        trainer,
        `SELECT approve_private_reschedule('${req}',true) id`,
      )
    )[0]!["id"];
    await db.exec(
      `UPDATE private_session_access SET starts_at=now() WHERE checkout_id='${target}'; SELECT record_private_both_present('${target}'); SELECT * FROM claim_private_balance('${target}'); SELECT apply_private_balance('${target}','pi_rescheduled_balance',7500,200); SELECT cancel_private_session('${target}','${member}')`,
    );
    expect(
      (
        await db.query(
          "SELECT checkout_id FROM refund_jobs ORDER BY checkout_id",
        )
      ).rows,
    ).toEqual([
      { checkout_id: "cs_deposit" },
      { checkout_id: "pi_rescheduled_balance" },
    ]);
  });

  it("atomically reconciles a refund that arrived before the successful checkout event", async () => {
    await db.query("SELECT settle_paid_checkout('tokens',$1::jsonb,500)", [
      JSON.stringify({
        p_checkout_id: "cs_already_refunded",
        p_user_id: member,
        p_tokens: 1,
        p_gross_cents: 500,
        p_fee_cents: 44,
      }),
    ]);
    expect(
      (
        await row(
          "SELECT state FROM wallet_token_units WHERE lot_id='cs_already_refunded'",
        )
      )["state"],
    ).toBe("refunded");
    expect(
      (await row(`SELECT tokens FROM profiles WHERE id='${member}'`))["tokens"],
    ).toBe(0);
  });
  it("honors assigned required credentials as well as CPR/AED and gates raw storage upload", async () => {
    await acting(
      admin,
      `INSERT INTO trainer_credential_requirements(trainer_id,credential_name,created_by) VALUES('${trainer}','Fitness Instructor','${admin}')`,
    );
    expect(
      (await row(`SELECT trainer_is_eligible('${trainer}',false) ok`))["ok"],
    ).toBe(false);
    await expect(
      acting(
        trainer,
        `INSERT INTO storage.objects(bucket_id,name) VALUES('videos','${trainer}/new.mp4')`,
      ),
    ).rejects.toThrow();
    await db.exec(
      `INSERT INTO certifications(user_id,name,expires,status,verified_at,verified_by) VALUES('${trainer}','Fitness Instructor',(current_date+365)::text,'verified',now(),'${admin}')`,
    );
    expect(
      (await row(`SELECT trainer_is_eligible('${trainer}',false) ok`))["ok"],
    ).toBe(true);
  });
  it("keeps friend attendance private until both parties opt into sharing and receiving", async () => {
    await db.exec(
      `INSERT INTO friendships(user_id,friend_id,friend_name,partner) VALUES('${member}','${stranger}','Partner',true),('${stranger}','${member}','Member',true)`,
    );
    const s = (
      await row(
        `INSERT INTO live_sessions(trainer_id,trainer_name,title,starts_at) VALUES('${trainer}','Trainer','Privacy',now()+interval '2 minutes') RETURNING id`,
      )
    )["id"];
    await db.exec(`SELECT notify_friend_attendance('${member}','${s}')`);
    expect(
      (
        await row(
          "SELECT count(*)::int n FROM account_notifications WHERE category='friend'",
        )
      )["n"],
    ).toBe(0);
    await acting(
      member,
      `INSERT INTO notification_preferences(user_id,share_live_activity) VALUES('${member}',true)`,
    );
    await acting(
      stranger,
      `INSERT INTO notification_preferences(user_id,friend_activity) VALUES('${stranger}',true)`,
    );
    await db.exec(
      `SELECT notify_friend_attendance('${member}','${s}'); SELECT notify_friend_attendance('${member}','${s}')`,
    );
    expect(
      (
        await row(
          "SELECT count(*)::int n FROM account_notifications WHERE category='friend'",
        )
      )["n"],
    ).toBe(1);
  });
  it("enforces durable public-contact quotas and forbids client quota bypass", async () => {
    const hash = "a".repeat(64),
      payload = "b".repeat(64);
    for (let i = 0; i < 5; i++)
      await db.query("SELECT claim_contact_delivery(gen_random_uuid(),$1,$2)", [
        hash,
        payload,
      ]);
    await expect(
      acting(
        member,
        `SELECT claim_contact_delivery(gen_random_uuid(),'${hash}','${payload}')`,
      ),
    ).rejects.toThrow("permission denied");
    await expect(
      db.query("SELECT claim_contact_delivery(gen_random_uuid(),$1,$2)", [
        hash,
        payload,
      ]),
    ).rejects.toThrow("limit");
  });
  it("deduplicates concurrent contact sends and keeps a sent receipt immutable", async () => {
    const request = "55555555-5555-4555-8555-555555555555",
      hash = "a".repeat(64),
      payload = "b".repeat(64);
    expect(
      (
        await row(
          `SELECT claim_contact_delivery('${request}','${hash}','${payload}') status`,
        )
      )["status"],
    ).toBe("claimed");
    expect(
      (
        await row(
          `SELECT claim_contact_delivery('${request}','${hash}','${payload}') status`,
        )
      )["status"],
    ).toBe("processing");
    await db.exec(
      `UPDATE contact_delivery_requests SET status='sent',provider_id='provider-confirmed' WHERE request_id='${request}'`,
    );
    expect(
      (
        await row(
          `SELECT claim_contact_delivery('${request}','${hash}','${payload}') status`,
        )
      )["status"],
    ).toBe("sent");
    await expect(
      db.query("SELECT claim_contact_delivery($1,$2,$3)", [
        request,
        hash,
        "c".repeat(64),
      ]),
    ).rejects.toThrow("changed");
  });
});
