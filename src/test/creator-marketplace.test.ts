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
import { newProgram } from "../lib/programs";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDatabase } from "./database";
const trainer = "11111111-1111-4111-8111-111111111111",
  member = "22222222-2222-4222-8222-222222222222",
  other = "33333333-3333-4333-8333-333333333333",
  admin = "44444444-4444-4444-8444-444444444444";
let db: PGlite;
async function q<T = Record<string, unknown>>(
  sql: string,
  args: unknown[] = [],
) {
  await db.exec("SAVEPOINT query");
  try {
    const r = await db.query<T>(sql, args);
    await db.exec("RELEASE SAVEPOINT query");
    return r.rows;
  } catch (e) {
    await db.exec("ROLLBACK TO SAVEPOINT query;RELEASE SAVEPOINT query");
    throw e;
  }
}
async function as<T = Record<string, unknown>>(
  user: string | null,
  sql: string,
  args: unknown[] = [],
) {
  await db.exec("SAVEPOINT actor");
  try {
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [
      user ?? "",
    ]);
    await db.exec(user ? "SET ROLE authenticated" : "SET ROLE anon");
    const r = await db.query<T>(sql, args);
    await db.exec("RESET ROLE; RELEASE SAVEPOINT actor");
    return r.rows;
  } catch (e) {
    await db.exec(
      "ROLLBACK TO SAVEPOINT actor;RESET ROLE;RELEASE SAVEPOINT actor",
    );
    throw e;
  }
}
async function order() {
  const o = (
    await q<{ id: string }>(
      `SELECT id FROM begin_creator_order('${member}','${trainer}')`,
    )
  )[0]!.id;
  await q(
    `SELECT attach_creator_subscription($1,'cs_membership','sub_membership','cus_member','active',false)`,
    [o],
  );
  return o;
}
async function receipt(o: string, invoice = "in_paid", intent = "pi_paid") {
  return (
    await q<{ id: string }>(
      `SELECT record_creator_invoice($1,$2,$3,2000,88,0,now()-interval '1 minute',now()+interval '30 days',now()) id`,
      [o, invoice, intent],
    )
  )[0]!.id;
}
async function access() {
  return (
    await as<{ ok: boolean }>(
      member,
      `SELECT is_creator_subscriber('${trainer}') ok`,
    )
  )[0]!.ok;
}
async function video(status = "approved") {
  await q(
    `INSERT INTO video_uploads(guid,user_id,library_id,access_scope) VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','${trainer}','999','program')`,
  );
  return (
    await q<{ id: string }>(
      `INSERT INTO trainer_videos(user_id,title,path,minutes,review_status,access_scope) VALUES('${trainer}','Protected workout','bunny:999:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',20,$1,'program') RETURNING id`,
      [status],
    )
  )[0]!.id;
}
beforeAll(async () => {
  db = await createTestDatabase();
  for (const [id, role] of [
    [trainer, "trainer"],
    [member, "member"],
    [other, "trainer"],
    [admin, "member"],
  ])
    await db.query(
      "INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)",
      [
        id,
        `${id}@fixture.invalid`,
        JSON.stringify({ requested_role: role, name: role }),
      ],
    );
  await db.exec(
    `INSERT INTO user_roles(user_id,role) VALUES('${admin}','admin');INSERT INTO certifications(user_id,name,expires,status,verified_at,verified_by) VALUES('${trainer}','CPR/AED',(current_date+365)::text,'verified',now(),'${admin}');INSERT INTO trainer_accounts(user_id,stripe_account_id,payouts_enabled) VALUES('${trainer}','acct_creator',true);`,
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec("BEGIN");
  await as(
    trainer,
    "SELECT save_creator_offer('Training membership','Optional member benefits',2000,true)",
  );
  await q(`SELECT approve_creator_terms('${admin}',true,1000,'membership-v1')`);
});
afterEach(async () => {
  await db.exec("ROLLBACK");
});
describe("creator membership SQL authority and independent paid periods", () => {
  it("permits verified live-only trainers with zero workouts but separately gates payouts", async () => {
    expect(await q(`SELECT trainer_is_eligible('${trainer}',true) ok`)).toEqual(
      [{ ok: true }],
    );
    await as(
      trainer,
      `INSERT INTO live_sessions(trainer_id,trainer_name,title,starts_at) VALUES('${trainer}','Coach','Live only',now()+interval '1 day')`,
    );
    await q(
      `UPDATE trainer_accounts SET payouts_enabled=false WHERE user_id='${trainer}'`,
    );
    await expect(order()).rejects.toThrow("unavailable");
    await expect(
      as(
        trainer,
        `INSERT INTO live_sessions(trainer_id,trainer_name,title,starts_at) VALUES('${trainer}','Coach','No payouts',now()+interval '1 day')`,
      ),
    ).rejects.toThrow("payout");
  });
  it("never grants access from a checkout redirect, attached subscription or failed invoice alone", async () => {
    await order();
    expect(await access()).toBe(false);
    await expect(
      as(member, `INSERT INTO creator_receipts DEFAULT VALUES`),
    ).rejects.toThrow("permission");
    await expect(
      as(
        member,
        `SELECT record_creator_invoice(null,'fake','fake',2000,0,0,now(),now(),now())`,
      ),
    ).rejects.toThrow("permission");
  });
  it("idempotently records actual fees and splits the net 90/10, without granting a program", async () => {
    const o = await order(),
      r = await receipt(o);
    expect(await access()).toBe(true);
    expect(await q("SELECT count(*)::int n FROM program_enrollments")).toEqual([
      { n: 0 },
    ]);
    const op = (
      await q<{ id: string; kind: string; amount: number }>(
        "SELECT * FROM claim_creator_payout($1)",
        [r],
      )
    )[0]!;
    expect(op).toMatchObject({ kind: "transfer", amount: 1720 });
    expect(await q("SELECT * FROM claim_creator_payout($1)", [r])).toEqual([]);
    await q("SELECT finish_creator_payout($1,'tr_actual')", [op.id]);
    await q("SELECT * FROM claim_creator_payout($1)", [r]);
    expect(
      await q(`SELECT payout_dirty FROM creator_receipts WHERE id=$1`, [r]),
    ).toEqual([{ payout_dirty: false }]);
    await expect(
      q(
        `SELECT record_creator_invoice($1,'in_paid','pi_other',2000,88,0,now(),now()+interval '30 days',now())`,
        [o],
      ),
    ).rejects.toThrow("replay mismatch");
  });
  it("keeps legitimate paid access and earnings after credential expiry and cancellation while refunding new charges", async () => {
    const o = await order();
    await receipt(o);
    await q(
      `UPDATE creator_orders SET billing_status='canceled',renewal_stop_requested=true WHERE id=$1`,
      [o],
    );
    await q(
      `UPDATE certifications SET expires=(current_date-1)::text WHERE user_id='${trainer}'`,
    );
    expect(await access()).toBe(true);
    await receipt(o, "in_unfulfillable", "pi_unfulfillable");
    expect(
      await q(
        `SELECT fulfillable,refund_pending FROM creator_receipts WHERE invoice_id='in_unfulfillable'`,
      ),
    ).toEqual([{ fulfillable: false, refund_pending: true }]);
    expect(await q("SELECT count(*)::int n FROM creator_refund_jobs")).toEqual([
      { n: 1 },
    ]);
  });
  it("reverses the original transfer after refunds/disputes and never reopens a lost dispute on replay", async () => {
    const r = await receipt(await order());
    const op = (
      await q<{ id: string }>("SELECT * FROM claim_creator_payout($1)", [r])
    )[0]!;
    await q("SELECT finish_creator_payout($1,'tr_original')", [op.id]);
    await q("SELECT adjust_creator_receipt($1,0,'dp_native','open')", [r]);
    expect(await access()).toBe(false);
    expect(
      (
        await q(
          "SELECT kind,amount,transfer_id FROM claim_creator_payout($1)",
          [r],
        )
      )[0],
    ).toEqual({ kind: "reversal", amount: 1720, transfer_id: "tr_original" });
    await q("SELECT adjust_creator_receipt($1,0,'dp_native','lost')", [r]);
    await q("SELECT adjust_creator_receipt($1,0,'dp_native','won')", [r]);
    expect(await access()).toBe(false);
    await q("SELECT adjust_creator_receipt($1,2000,'','')", [r]);
    await q("SELECT adjust_creator_receipt($1,0,'','')", [r]);
    expect(
      await q("SELECT refunded_cents FROM creator_receipts WHERE id=$1", [r]),
    ).toEqual([{ refunded_cents: 2000 }]);
  });
  it("protects subscriber posts through raw reads, report evidence, comments and private ledgers", async () => {
    const post = (
      await as<{ id: string }>(
        trainer,
        "SELECT save_creator_post('Private subscriber instructions','subscribers') id",
      )
    )[0]!.id;
    await q(
      `INSERT INTO trybe_memberships(user_id,trybe_id) VALUES('${member}','coach-${trainer}')`,
    );
    expect(
      await as(member, "SELECT text FROM posts WHERE id=$1", [post]),
    ).toEqual([]);
    await expect(
      as(
        member,
        `INSERT INTO content_reports(reporter_id,target_type,target_id,reason) VALUES('${member}','post',$1,'Should not leak')`,
        [post],
      ),
    ).rejects.toThrow("inaccessible");
    await receipt(await order());
    expect(
      await as(member, "SELECT text FROM posts WHERE id=$1", [post]),
    ).toEqual([{ text: "Private subscriber instructions" }]);
    expect(
      await as(null, "SELECT text FROM posts WHERE id=$1", [post]),
    ).toEqual([]);
    await expect(as(member, "SELECT * FROM creator_receipts")).rejects.toThrow(
      "permission",
    );
  });
  it("publishes both-audience posts once and preserves free member post privacy", async () => {
    await as(trainer, "SELECT save_creator_post('One public record','both')");
    expect(
      await as(null, "SELECT text FROM posts WHERE text='One public record'"),
    ).toEqual([{ text: "One public record" }]);
    await expect(
      as(
        member,
        `INSERT INTO posts(author_id,author_name,trybe,kind,text,visibility,audience) VALUES('${member}','Member','coach-${trainer}','Post','Forged','public','both')`,
      ),
    ).rejects.toThrow();
  });
  it("authorizes server-clock early release, rescheduling, cancellation and moderation without exposing unreleased premium paths", async () => {
    const v = await video();
    await as(
      trainer,
      "SELECT set_creator_video_audience($1,'early',now()+interval '1 hour')",
      [v],
    );
    expect(
      await as(null, "SELECT id FROM public_workout_catalog WHERE id=$1", [v]),
    ).toEqual([]);
    await expect(
      q(`SELECT * FROM creator_video_token('${member}',$1)`, [v]),
    ).rejects.toThrow("denied");
    await receipt(await order());
    expect(
      (
        await q(`SELECT is_public FROM creator_video_token('${member}',$1)`, [
          v,
        ])
      )[0],
    ).toEqual({ is_public: false });
    await q(
      "UPDATE creator_video_access SET public_at=now()-interval '1 second' WHERE video_id=$1",
      [v],
    );
    expect(
      await as(null, "SELECT id FROM public_workout_catalog WHERE id=$1", [v]),
    ).toEqual([{ id: v }]);
    expect(
      await as(null, "SELECT path FROM trainer_videos WHERE id=$1", [v]),
    ).toEqual([]);
    await as(trainer, "SELECT set_creator_video_audience($1,'subscribers')", [
      v,
    ]);
    expect(
      await as(null, "SELECT id FROM trainer_videos WHERE id=$1", [v]),
    ).toEqual([]);
    await q("UPDATE trainer_videos SET review_status='rejected' WHERE id=$1", [
      v,
    ]);
    expect(
      await as(null, "SELECT id FROM public_workout_catalog WHERE id=$1", [v]),
    ).toEqual([]);
  });
  it("allows pending protected media to be scheduled but never exposes it before approval", async () => {
    const v = await video("pending");
    await as(trainer, "SELECT set_creator_video_audience($1,'public')", [v]);
    expect(
      await as(null, "SELECT id FROM public_workout_catalog WHERE id=$1", [v]),
    ).toEqual([]);
    await q("UPDATE trainer_videos SET review_status='approved' WHERE id=$1", [
      v,
    ]);
    expect(
      await as(null, "SELECT id FROM public_workout_catalog WHERE id=$1", [v]),
    ).toEqual([{ id: v }]);
    expect(
      await as(null, "SELECT path FROM trainer_videos WHERE id=$1", [v]),
    ).toEqual([]);
  });
  it("uses all selected categories without rewriting old tags and never equates focus with credentials", async () => {
    await q(
      `INSERT INTO trainer_videos(user_id,title,path,minutes,category,level,equipment,review_status,discovery_tags) VALUES('${trainer}','Inclusive workout','old/path.mp4',15,'Strength','Beginner','No equipment | Low impact | Improve core strength','approved',ARRAY['postpartum','seated'])`,
    );
    expect(
      await as(
        null,
        "SELECT title FROM public_workout_catalog WHERE discovery_focus_tags @> ARRAY['core','postpartum','seated','beginner']",
      ),
    ).toEqual([{ title: "Inclusive workout" }]);
    expect(
      await as(
        null,
        "SELECT title FROM public_workout_catalog WHERE discovery_focus_tags @> ARRAY['prenatal','postpartum']",
      ),
    ).toEqual([]);
    await as(
      trainer,
      `UPDATE profiles SET focus_tags=ARRAY['rehabilitation','arthritis_friendly'] WHERE id='${trainer}'`,
    );
    await expect(
      as(
        trainer,
        `UPDATE profiles SET extra='{"trainer":{"bio":"Registered dietitian and physical therapist"}}' WHERE id='${trainer}'`,
      ),
    ).rejects.toThrow("matching");
    expect(
      await q(
        `SELECT count(*)::int n FROM certifications WHERE user_id='${trainer}'`,
      ),
    ).toEqual([{ n: 1 }]);
    await expect(
      as(
        trainer,
        `UPDATE profiles SET focus_tags=ARRAY['cure_diabetes'] WHERE id='${trainer}'`,
      ),
    ).rejects.toThrow("Unknown");
  });
  it("keeps private approved guides behind independent review and separate program enrollment, including after file revocation", async () => {
    const path = `${trainer}/guide.pdf`;
    await q(
      "INSERT INTO storage.objects(bucket_id,name) VALUES('program-downloads',$1)",
      [path],
    );
    const asset = (
      await as<{ id: string }>(
        trainer,
        "SELECT register_program_asset($1,'My guide') id",
        [path],
      )
    )[0]!.id;
    await expect(
      as(trainer, "SELECT review_program_asset($1,'approved')", [asset]),
    ).rejects.toThrow("Independent");
    const doc = {
      ...newProgram(),
      title: "A real digital guide",
      category: "Mobility",
      product_type: "download",
      downloads: [asset],
    };
    const program = (
      await as<{ id: string }>(trainer, "SELECT save_fitness_program($1) id", [
        JSON.stringify(doc),
      ])
    )[0]!.id;
    await expect(
      as(trainer, "SELECT submit_fitness_program($1)", [program]),
    ).rejects.toThrow("approved");
    await as(admin, "SELECT review_program_asset($1,'approved')", [asset]);
    const edition = (
      await as<{ id: string }>(
        trainer,
        "SELECT submit_fitness_program($1) id",
        [program],
      )
    )[0]!.id;
    await as(
      admin,
      "SELECT review_fitness_program($1,'approved','Reviewed guide and accessible instructions')",
      [edition],
    );
    await as(trainer, "SELECT set_fitness_program_visibility($1,true)", [
      program,
    ]);
    await receipt(await order());
    await expect(
      q("SELECT * FROM program_asset_access($1,$2,$3)", [
        member,
        edition,
        asset,
      ]),
    ).rejects.toThrow("denied");
    await as(member, "SELECT enroll_fitness_program($1)", [program]);
    expect(
      (
        await q("SELECT path FROM program_asset_access($1,$2,$3)", [
          member,
          edition,
          asset,
        ])
      )[0],
    ).toEqual({ path });
    await expect(
      q("SELECT * FROM program_asset_access($1,$2,$3)", [
        other,
        edition,
        asset,
      ]),
    ).rejects.toThrow("denied");
    expect(
      await as(
        member,
        "SELECT name FROM storage.objects WHERE bucket_id='program-downloads'",
      ),
    ).toEqual([]);
    await as(admin, "SELECT review_program_asset($1,'rejected')", [asset]);
    expect(
      await q("SELECT published FROM trainer_programs WHERE id=$1", [program]),
    ).toEqual([{ published: false }]);
    await expect(
      q("SELECT * FROM program_asset_access($1,$2,$3)", [
        member,
        edition,
        asset,
      ]),
    ).rejects.toThrow("denied");
    expect(
      await q(
        "SELECT count(*)::int n FROM program_enrollments WHERE edition_id=$1",
        [edition],
      ),
    ).toEqual([{ n: 1 }]);
  });
  it("does not allow owner commercial settings to change the confirmed subscription 90/10 split", async () => {
    await expect(
      q(
        `SELECT approve_creator_terms('${admin}',true,500,'wrong-subscription-terms')`,
      ),
    ).rejects.toThrow("Owner approval");
    expect(await q("SELECT commission_bps FROM creator_commerce")).toEqual([
      { commission_bps: 1000 },
    ]);
  });
  it("holds unlaunched scheduled media after credential expiry but preserves already-authorized public releases", async () => {
    const v = await video();
    await as(
      trainer,
      "SELECT set_creator_video_audience($1,'early',now()+interval '1 hour')",
      [v],
    );
    await q(
      "UPDATE creator_video_access SET public_at=now()-interval '1 second' WHERE video_id=$1",
      [v],
    );
    await q(
      `UPDATE certifications SET expires=(current_date-1)::text WHERE user_id='${trainer}'`,
    );
    expect(
      await as(null, "SELECT id FROM public_workout_catalog WHERE id=$1", [v]),
    ).toEqual([]);
    await q(
      `UPDATE certifications SET expires=(current_date+365)::text WHERE user_id='${trainer}'`,
    );
    await q("SELECT * FROM creator_video_token($1,$2)", [member, v]);
    await q(
      `UPDATE certifications SET expires=(current_date-1)::text WHERE user_id='${trainer}'`,
    );
    expect(
      await as(null, "SELECT id FROM public_workout_catalog WHERE id=$1", [v]),
    ).toEqual([{ id: v }]);
    expect(
      await as(null, "SELECT path FROM trainer_videos WHERE id=$1", [v]),
    ).toEqual([]);
  });
});
