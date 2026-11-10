// @vitest-environment node
import {
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  it,
  expect,
  describe,
} from "vitest";
import { createTestDatabase } from "./database";
import type { PGlite } from "@electric-sql/pglite";
import { newProgram } from "../lib/programs";
const trainer = "11111111-1111-4111-8111-111111111111",
  member = "22222222-2222-4222-8222-222222222222",
  other = "33333333-3333-4333-8333-333333333333",
  admin = "44444444-4444-4444-8444-444444444444",
  video = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
let db: PGlite;
async function q(sql: string, args: unknown[] = []) {
  await db.exec("SAVEPOINT q");
  try {
    const r = await db.query<Record<string, unknown>>(sql, args);
    await db.exec("RELEASE SAVEPOINT q");
    return r.rows;
  } catch (e) {
    await db.exec("ROLLBACK TO SAVEPOINT q;RELEASE SAVEPOINT q");
    throw e;
  }
}
async function as(user: string | null, sql: string, args: unknown[] = []) {
  await db.exec("SAVEPOINT actor");
  try {
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [
      user ?? "",
    ]);
    await db.exec(user ? "SET ROLE authenticated" : "SET ROLE anon");
    const r = await db.query<Record<string, unknown>>(sql, args);
    await db.exec("RESET ROLE;RELEASE SAVEPOINT actor");
    return r.rows;
  } catch (e) {
    await db.exec(
      "ROLLBACK TO SAVEPOINT actor;RESET ROLE;RELEASE SAVEPOINT actor",
    );
    throw e;
  }
}
async function paidPeriod() {
  await as(
    trainer,
    "SELECT save_creator_offer('Optional membership','Real fixture benefits',2999,true)",
  );
  await q("SELECT approve_creator_terms($1,true,1000,'studio-approved')", [
    admin,
  ]);
  const order = (
    await q("SELECT id FROM begin_creator_order($1,$2)", [member, trainer])
  )[0]!["id"];
  await q(
    "SELECT attach_creator_subscription($1,'cs_studio','sub_studio','cus_studio','active',false)",
    [order],
  );
  return (
    await q(
      "SELECT record_creator_invoice($1,'in_studio','pi_studio',2999,117,0,now()-interval '1 minute',now()+interval '30 days',now()) id",
      [order],
    )
  )[0]!["id"];
}
async function program(
  mode: "free" | "members" | "native" = "members",
  included = false,
  format: "video" | "pdf" | "mixed" = "video",
) {
  const doc = newProgram();
  doc.title = "Fixture program";
  doc.mode = mode;
  doc.price_cents = mode === "native" ? 5000 : 0;
  doc.subscription_access = included;
  doc.weeks[0]!.days[0]!.workouts = [
    {
      id: crypto.randomUUID(),
      video_id: video,
      instructions: "Follow your trainer modifications.",
    },
  ];
  if (format !== "video") {
    const asset = crypto.randomUUID();
    await q(
      "INSERT INTO program_assets(id,trainer_id,path,title,review_status,reviewed_by,reviewed_at) VALUES($1,$2,$3,'Fixture PDF','approved',$4,now())",
      [asset, trainer, trainer + "/" + asset + ".pdf", admin],
    );
    doc.downloads = [asset];
    if (format === "pdf") {
      doc.product_type = "download";
      doc.weeks[0]!.days[0]!.workouts = [];
    }
  }
  const id = (
    await as(trainer, "SELECT save_fitness_program($1) id", [
      JSON.stringify(doc),
    ])
  )[0]!["id"];
  const edition = (
    await as(trainer, "SELECT submit_fitness_program($1) id", [id])
  )[0]!["id"];
  await as(
    admin,
    "SELECT review_fitness_program($1,'approved','Reviewed fixture')",
    [edition],
  );
  return {
    id,
    edition,
    doc,
    step: doc.weeks[0]!.days[0]!.workouts[0]?.id ?? "",
  };
}
async function live(type = "scheduled") {
  return (
    await q(
      "INSERT INTO live_sessions(trainer_id,trainer_name,title,starts_at,minutes,session_type) VALUES($1,'Trainer','Fixture class',now()+interval '1 minute',45,$2) RETURNING id",
      [trainer, type],
    )
  )[0]!["id"];
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
      "INSERT INTO auth.users(id,raw_user_meta_data) VALUES($1,$2)",
      [id, JSON.stringify({ requested_role: role, name: role })],
    );
  await db.exec(
    `INSERT INTO user_roles(user_id,role) VALUES('${admin}','admin');INSERT INTO certifications(user_id,name,expires,status,verified_at,verified_by) VALUES('${trainer}','CPR/AED',(current_date+365)::text,'verified',now(),'${admin}'),('${other}','CPR/AED',(current_date+365)::text,'verified',now(),'${admin}');INSERT INTO trainer_accounts(user_id,stripe_account_id,payouts_enabled) VALUES('${trainer}','acct_studio',true),('${other}','acct_other',true);INSERT INTO trainer_videos(id,user_id,title,path,minutes,review_status) VALUES('${video}','${trainer}','Strength fixture','bunny:123:${video}',20,'approved');INSERT INTO trainer_videos(user_id,title,path,minutes,review_status) SELECT '${trainer}','Approved fixture','bunny:123:'||gen_random_uuid(),20,'approved' FROM generate_series(1,4);`,
  );
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
describe("Creator Studio authorization, commercial terms and benefits", () => {
  it("keeps roles server-authoritative, enforces five approved videos, and retains no quota for programs", async () => {
    await expect(
      as(member, "UPDATE profiles SET role='trainer' WHERE id=$1", [member]),
    ).rejects.toThrow("role changes require support");
    expect(
      (await q("SELECT trainer_is_eligible($1,true) ok", [trainer]))[0]!["ok"],
    ).toBe(true);
    await q("UPDATE trainer_videos SET review_status='pending' WHERE id=$1", [
      video,
    ]);
    expect(
      (
        await q(
          "SELECT trainer_is_eligible($1,true) ok,trainer_is_eligible($1,false) credentials",
          [trainer],
        )
      )[0],
    ).toEqual({ ok: false, credentials: true });
    await expect(
      as(trainer, "SELECT start_subscriber_live('Subscriber live',45)"),
    ).rejects.toThrow("eligibility");
  });
  it("grants included scheduled and subscriber attendance without tokens or separate earnings, and rejects other trainers", async () => {
    await paidPeriod();
    const id = await live();
    await q("SELECT reserve_live_class($1,$2)", [member, id]);
    await q("SELECT consume_attended_live_token($1,$2)", [member, id]);
    await q("SELECT consume_attended_live_token($1,$2)", [member, id]);
    expect(
      await q(
        "SELECT count(*)::int n FROM subscriber_live_access WHERE attended_at IS NOT NULL",
      ),
    ).toEqual([{ n: 1 }]);
    for (const table of ["wallet_redemptions", "trainer_earnings"])
      expect(await q(`SELECT count(*)::int n FROM ${table}`)).toEqual([
        { n: 0 },
      ]);
    await q("UPDATE live_sessions SET status='cancelled' WHERE id=$1", [id]);
    const exclusive = await live("subscriber");
    await expect(
      q("SELECT reserve_live_class($1,$2)", [other, exclusive]),
    ).rejects.toThrow("subscription");
    expect(
      (
        await q("SELECT live_subscription_deadline($1,$2) deadline", [
          other,
          id,
        ])
      )[0]!["deadline"],
    ).toBeNull();
  });
  it("refunds and paid-period expiry revoke live benefits without silently switching to wallet debit", async () => {
    const r = await paidPeriod(),
      id = await live();
    await q("SELECT consume_attended_live_token($1,$2)", [member, id]);
    await q("SELECT adjust_creator_receipt($1,2999,'','')", [r]);
    expect(
      (
        await q("SELECT live_subscription_deadline($1,$2) deadline", [
          member,
          id,
        ])
      )[0]!["deadline"],
    ).toBeNull();
    await expect(
      q("SELECT consume_attended_live_token($1,$2)", [member, id]),
    ).rejects.toThrow("rebook");
  });
  it("starts a real spontaneous session, enforces owner eligibility and notifies only opted-in subscribers once", async () => {
    await paidPeriod();
    await as(
      member,
      "INSERT INTO notification_preferences(user_id,subscriber_lives) VALUES($1,true)",
      [member],
    );
    const id = (
      await as(
        trainer,
        "SELECT start_subscriber_live('Real subscriber session',45) id",
      )
    )[0]!["id"];
    await q("UPDATE live_sessions SET status='live' WHERE id=$1", [id]);
    await q("UPDATE live_sessions SET status='live' WHERE id=$1", [id]);
    expect(
      await as(
        member,
        "SELECT count(*)::int n FROM account_notifications WHERE event_key=$1",
        ["subscriber-live:" + id],
      ),
    ).toEqual([{ n: 1 }]);
    await expect(
      as(other, "SELECT start_subscriber_live('No approved videos',45)"),
    ).rejects.toThrow("eligibility");
  });
  it("enforces trainer-specific members-only access, edition pinning, progress and refund revocation", async () => {
    const r = await paidPeriod(),
      p = await program();
    await expect(
      q("SELECT * FROM program_media_access($1,$2,$3)", [
        member,
        p.edition,
        p.step,
      ]),
    ).rejects.toThrow("access denied");
    await as(member, "SELECT enroll_fitness_program($1)", [p.id]);
    expect(
      (await as(member, "SELECT program_access($1) ok", [p.edition]))[0]!["ok"],
    ).toBe(true);
    expect(
      await as(
        other,
        "SELECT creator_program_access($1,$2) allowed,creator_program_deadline($1,$2) deadline",
        [member, p.edition],
      ),
    ).toEqual([{ allowed: false, deadline: null }]);
    await as(member, "SELECT set_program_progress($1,$2,true)", [
      p.edition,
      p.step,
    ]);
    await as(member, "SELECT set_program_progress($1,$2,true)", [
      p.edition,
      p.step,
    ]);
    expect(
      await as(member, "SELECT count(*)::int n FROM program_progress"),
    ).toEqual([{ n: 1 }]);
    await expect(
      q("SELECT * FROM program_media_access($1,$2,$3)", [
        other,
        p.edition,
        p.step,
      ]),
    ).rejects.toThrow("access denied");
    const media = await q("SELECT * FROM program_media_access($1,$2,$3)", [
      member,
      p.edition,
      p.step,
    ]);
    expect(media[0]!["access_expires_at"]).not.toBeNull();
    expect(media[0]!["ads_allowed"]).toBe(false);
    await q("SELECT adjust_creator_receipt($1,2999,'','')", [r]);
    expect(
      (await as(member, "SELECT program_access($1) ok", [p.edition]))[0]!["ok"],
    ).toBe(false);
    await expect(
      as(member, "SELECT set_program_progress($1,$2,true)", [
        p.edition,
        p.step,
      ]),
    ).rejects.toThrow("Enrollment");
    expect(
      await as(member, "SELECT count(*)::int n FROM program_progress"),
    ).toEqual([{ n: 1 }]);
  });
  it("includes paid programs only by explicit configuration and prevents included members starting a second purchase", async () => {
    await paidPeriod();
    const paid = await program("native"),
      included = await program("native", true);
    expect(
      (
        await as(member, "SELECT program_subscription_benefit($1) ok", [
          paid.id,
        ])
      )[0]!["ok"],
    ).toBe(false);
    await expect(
      as(member, "SELECT enroll_fitness_program($1)", [paid.id]),
    ).rejects.toThrow("purchases require");
    await as(member, "SELECT enroll_fitness_program($1)", [included.id]);
    await q("SELECT approve_program_terms($1,true,1000,'program-90-10')", [
      admin,
    ]);
    await expect(
      q("SELECT * FROM begin_program_order($1,$2)", [member, included.id]),
    ).rejects.toThrow("Included with");
  });
  it("allocates all new native formats 90/10 after real fees, holds refunds, and keeps an independent purchase after subscription expiration", async () => {
    const r = await paidPeriod(),
      p = await program("native");
    await q("SELECT approve_program_terms($1,true,1000,'program-90-10')", [
      admin,
    ]);
    await expect(
      q("SELECT approve_program_terms($1,true,500,'obsolete')", [admin]),
    ).rejects.toThrow("90/10");
    const order = (
      await q("SELECT id FROM begin_program_order($1,$2)", [member, p.id])
    )[0]!["id"];
    await q("SELECT attach_program_checkout($1,'cs_program','pi_program')", [
      order,
    ]);
    await q(
      "SELECT confirm_program_order($1,'cs_program','pi_program',5000,175,0)",
      [order],
    );
    expect(
      (await q("SELECT * FROM claim_program_payout($1)", [order]))[0],
    ).toMatchObject({ amount: 4342, kind: "transfer" });
    await q("SELECT adjust_creator_receipt($1,2999,'','')", [r]);
    expect(
      (await as(member, "SELECT program_access($1) ok", [p.edition]))[0]!["ok"],
    ).toBe(true);
  });
  it("keeps free enrollment available independently of subscriptions", async () => {
    const p = await program("free");
    await as(member, "SELECT enroll_fitness_program($1)", [p.id]);
    expect(
      (await as(member, "SELECT program_access($1) ok", [p.edition]))[0]!["ok"],
    ).toBe(true);
  });
});
describe("business tools and privacy", () => {
  it("keeps partnership inquiries private, rate-limited and independent of friendship/messages", async () => {
    const params = [
      trainer,
      "Member",
      "Organization",
      "contact@fixture.invalid",
      "Collaboration",
      "A genuine fixture project description with enough detail.",
    ];
    const id = (
      await as(
        member,
        "SELECT submit_creator_partnership($1,$2,$3,$4,$5,$6) id",
        params,
      )
    )[0]!["id"];
    expect(
      await as(
        trainer,
        "SELECT href FROM account_notifications WHERE event_key=$1",
        ["partnership:" + id],
      ),
    ).toEqual([{ href: "/studio?section=messages-partnerships" }]);
    await expect(
      as(
        member,
        "SELECT submit_creator_partnership($1,$2,$3,$4,$5,$6)",
        params,
      ),
    ).rejects.toThrow("limit");
    expect(
      await as(other, "SELECT count(*)::int n FROM creator_partnerships"),
    ).toEqual([{ n: 0 }]);
    await expect(
      as(other, "SELECT update_creator_partnership($1,'accepted')", [id]),
    ).rejects.toThrow("Not your");
    await as(trainer, "SELECT update_creator_partnership($1,'discussion')", [
      id,
    ]);
    for (const table of ["messages", "friend_requests"])
      expect(await q(`SELECT count(*)::int n FROM ${table}`)).toEqual([
        { n: 0 },
      ]);
  });
  it("enforces configurable subscription bounds without mandatory subscriptions", async () => {
    await expect(
      as(member, "SELECT configure_creator_prices(100,10000,2999)"),
    ).rejects.toThrow("Admins");
    await as(admin, "SELECT configure_creator_prices(1000,10000,2999)");
    await expect(
      as(trainer, "SELECT save_creator_offer('Offer','Description',999,true)"),
    ).rejects.toThrow("bounds");
    await as(
      trainer,
      "SELECT save_creator_offer('Offer','Description',2999,false)",
    );
  });
  it("scopes financial/follower analytics to the current trainer and exposes actual totals only", async () => {
    await paidPeriod();
    await as(
      member,
      "UPDATE profiles SET extra=jsonb_set(extra,'{followed}',to_jsonb(ARRAY[$1]::text[])) WHERE id=$2",
      [trainer, member],
    );
    const data = (
      await as(
        trainer,
        "SELECT creator_business_metrics(now()-interval '7 days',now()+interval '1 second') r",
      )
    )[0]!["r"] as Record<string, unknown>;
    expect(data["followers"]).toBe(1);
    expect(data["newFollowers"]).toBe(1);
    expect(data["subscribers"]).toBe(1);
    expect(data["totalEarned"]).toBe(2593);
    const otherData = (
      await as(
        other,
        "SELECT creator_business_metrics(now()-interval '7 days',now()+interval '1 second') r",
      )
    )[0]!["r"] as Record<string, unknown>;
    expect(otherData["totalEarned"]).toBe(0);
    await expect(
      as(
        member,
        "SELECT creator_business_metrics(now()-interval '7 days',now())",
      ),
    ).rejects.toThrow("Trainer");
    const analytics = (
      await as(trainer, "SELECT creator_program_analytics() r")
    )[0]!["r"];
    expect(analytics).toEqual([]);
  });
  it("keeps School drafts private, perks verified-only, and resource publication admin-controlled", async () => {
    expect(
      await as(member, "SELECT count(*)::int n FROM school_tutorials"),
    ).toEqual([{ n: 0 }]);
    expect(
      (await as(admin, "SELECT count(*)::int n FROM school_tutorials"))[0]![
        "n"
      ],
    ).toBe(24);
    await expect(
      as(
        member,
        "INSERT INTO school_tutorials(audience,category,title) VALUES('both','Help','Forged')",
      ),
    ).rejects.toThrow("row-level");
    await expect(
      as(admin, "UPDATE school_tutorials SET published=true"),
    ).rejects.toThrow("check constraint");
  });
  it("collects normalized allowlisted demand once per member/day and never exposes raw searches", async () => {
    await as(
      member,
      "SELECT record_discovery_demand('workouts','  STRENGTH  ',ARRAY['strength'])",
    );
    await as(
      member,
      "SELECT record_discovery_demand('workouts','strength',ARRAY['strength'])",
    );
    expect(await q("SELECT count(*)::int n FROM discovery_demand")).toEqual([
      { n: 1 },
    ]);
    await as(
      member,
      "SELECT record_discovery_demand('workouts','my email name@fixture.invalid cancer')",
    );
    await as(
      member,
      "SELECT record_discovery_demand('workouts','',ARRAY['postpartum'])",
    );
    expect(await q("SELECT count(*)::int n FROM discovery_demand")).toEqual([
      { n: 1 },
    ]);
    await expect(as(trainer, "SELECT * FROM discovery_demand")).rejects.toThrow(
      "permission",
    );
    expect(
      (await as(trainer, "SELECT creator_demand_insights(7,false) r"))[0]!["r"],
    ).toEqual({ sufficient: false, rows: [] });
  });
  it("suppresses small cohorts and reports real content gaps only after thresholds, with retention", async () => {
    for (let i = 0; i < 20; i++) {
      const id = crypto.randomUUID();
      await q(
        `INSERT INTO auth.users(id,raw_user_meta_data) VALUES($1,'{"name":"Fixture member"}')`,
        [id],
      );
      await as(id, "SELECT record_discovery_demand('workouts','pilates')");
    }
    await q("UPDATE discovery_demand SET day=current_date-1");
    const report = (
      await as(trainer, "SELECT creator_demand_insights(30,false) r")
    )[0]!["r"] as {
      sufficient: boolean;
      rows: { members: number; zeroResults: number }[];
    };
    expect(report.sufficient).toBe(true);
    expect(report.rows[0]).toMatchObject({ members: 20, zeroResults: 20 });
    expect(
      (await as(trainer, "SELECT creator_demand_insights(30,true) r"))[0]!["r"],
    ).toEqual({ sufficient: false, rows: [] });
    await q("UPDATE discovery_demand SET day=current_date-91");
    await q("SELECT purge_discovery_demand()");
    expect(await q("SELECT count(*)::int n FROM discovery_demand")).toEqual([
      { n: 0 },
    ]);
  });
  it("keeps Spotlight drafts owned and incapable of activating or charging", async () => {
    const pkg = (
      await as(trainer, "SELECT id FROM spotlight_packages ORDER BY days")
    )[0]!["id"];
    const id = (
      await as(
        trainer,
        "SELECT save_spotlight_draft('profile',$1,$2,500,ARRAY['strength']) id",
        [trainer, pkg],
      )
    )[0]!["id"];
    await expect(
      as(member, "SELECT save_spotlight_draft('profile',$1,$2,500,'{}')", [
        member,
        pkg,
      ]),
    ).rejects.toThrow("Verified");
    await expect(
      as(other, "SELECT save_spotlight_draft('profile',$1,$2,500,'{}',$3)", [
        other,
        pkg,
        id,
      ]),
    ).rejects.toThrow("Editable");
    expect(
      await as(other, "SELECT count(*)::int n FROM spotlight_campaigns"),
    ).toEqual([{ n: 0 }]);
    await expect(
      as(admin, "UPDATE spotlight_campaigns SET status='active'"),
    ).rejects.toThrow("check constraint");
  });
});

it.each(["pdf", "mixed"] as const)(
  "settles hosted %s at 90/10 and records authorized offline completion",
  async (format) => {
    const p = await program("native", false, format);
    await q("SELECT approve_program_terms($1,true,1000,'pdf-mixed-90-10')", [
      admin,
    ]);
    const o = (
      await q("SELECT id FROM begin_program_order($1,$2)", [member, p.id])
    )[0]!["id"];
    await q("SELECT attach_program_checkout($1,'cs_pdf','pi_pdf')", [o]);
    await q("SELECT confirm_program_order($1,'cs_pdf','pi_pdf',5000,175,0)", [
      o,
    ]);
    expect(
      (await q("SELECT * FROM claim_program_payout($1)", [o]))[0],
    ).toMatchObject({ amount: 4342 });
    await as(member, "SELECT complete_program_download($1,$2,true)", [
      p.edition,
      p.doc.downloads[0],
    ]);
    await as(member, "SELECT complete_program_download($1,$2,true)", [
      p.edition,
      p.doc.downloads[0],
    ]);
    expect(
      await as(member, "SELECT count(*)::int n FROM program_download_progress"),
    ).toEqual([{ n: 1 }]);
    await expect(
      as(other, "SELECT complete_program_download($1,$2,true)", [
        p.edition,
        p.doc.downloads[0],
      ]),
    ).rejects.toThrow("enrollment");
    const report = (
      await as(trainer, "SELECT creator_program_analytics() r")
    )[0]!["r"] as { starts: number; averageProgress: number }[];
    expect(report[0]).toMatchObject({
      starts: 1,
      averageProgress: format === "pdf" ? 100 : 50,
    });
  },
);
it("retains a settled historical 95/5 order across the additive rate upgrade", async () => {
  const historical = await createTestDatabase("0065_creator_studio_core.sql");
  try {
    await historical.exec(
      `INSERT INTO auth.users(id,raw_user_meta_data) VALUES('${trainer}','{"name":"Historical trainer","requested_role":"trainer"}'),('${member}','{"name":"Historical member"}');INSERT INTO trainer_programs(id,trainer_id,title,builder_version) VALUES('${video}','${trainer}','Historical program',2);`,
    );
    const e = crypto.randomUUID(),
      o = crypto.randomUUID();
    await historical.query(
      "INSERT INTO program_editions(id,program_id,version,document) VALUES($1,$2,1,'{}')",
      [e, video],
    );
    await historical.query(
      "INSERT INTO program_orders(id,program_id,edition_id,user_id,trainer_id,price_cents,commission_bps,terms_version,destination,fee_cents,paid_at) VALUES($1,$2,$3,$4,$5,10000,500,'historic-95-5','acct_historical',300,now())",
      [o, video, e, member, trainer],
    );
    const { readFile } = await import("node:fs/promises");
    await historical.exec(
      await readFile(
        new URL(
          "../../migrations/0066_creator_studio_access.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    expect(
      (
        await historical.query(
          "SELECT commission_bps FROM program_orders WHERE id=$1",
          [o],
        )
      ).rows,
    ).toEqual([{ commission_bps: 500 }]);
    expect(
      (
        await historical.query("SELECT amount FROM claim_program_payout($1)", [
          o,
        ])
      ).rows,
    ).toEqual([{ amount: 9215 }]);
  } finally {
    await historical.close();
  }
}, 30000);
it("preserves original comments while restricting trainer moderation and replies to owned posts", async () => {
  const post = (
    await as(
      trainer,
      "SELECT save_creator_post('Fixture community discussion','public') id",
    )
  )[0]!["id"];
  await q(
    "INSERT INTO trybe_memberships(user_id,trybe_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
    [member, "coach-" + trainer],
  );
  const comment = (
    await as(
      member,
      "INSERT INTO post_comments(post_id,author_id,author_name,text) VALUES($1,$2,'Member','A real fixture comment') RETURNING id",
      [post, member],
    )
  )[0]!["id"];
  await expect(
    as(other, "SELECT moderate_creator_comment($1,true,'Not my post')", [
      comment,
    ]),
  ).rejects.toThrow("owns this post");
  await as(
    trainer,
    "SELECT moderate_creator_comment($1,true,'Discussion moderation')",
    [comment],
  );
  expect(
    await as(member, "SELECT count(*)::int n FROM post_comments WHERE id=$1", [
      comment,
    ]),
  ).toEqual([{ n: 0 }]);
  expect(
    (await q("SELECT text FROM post_comments WHERE id=$1", [comment]))[0]![
      "text"
    ],
  ).toBe("A real fixture comment");
  await as(
    trainer,
    "SELECT moderate_creator_comment($1,false,'Restored after review')",
    [comment],
  );
  expect(
    await as(member, "SELECT count(*)::int n FROM post_comments WHERE id=$1", [
      comment,
    ]),
  ).toEqual([{ n: 1 }]);
  await as(
    trainer,
    "SELECT reply_creator_comment($1,'Thank you for sharing your experience.')",
    [comment],
  );
  expect(
    await as(
      member,
      "SELECT count(*)::int n FROM post_comments WHERE post_id=$1",
      [post],
    ),
  ).toEqual([{ n: 2 }]);
});
it("requires authorized Trybe membership for workout discussions and protects cross-trainer moderation", async () => {
  await expect(
    as(member, "SELECT save_workout_comment($1,'Before joining')", [video]),
  ).rejects.toThrow("Join");
  await q("INSERT INTO trybe_memberships(user_id,trybe_id) VALUES($1,$2)", [
    member,
    "coach-" + trainer,
  ]);
  const c = (
    await as(
      member,
      "SELECT save_workout_comment($1,'A real workout comment') id",
      [video],
    )
  )[0]!["id"];
  await expect(
    as(other, "SELECT moderate_workout_comment($1,true,'Not owned')", [c]),
  ).rejects.toThrow("owner");
  await as(trainer, "SELECT save_workout_comment($1,'Trainer reply',$2)", [
    video,
    c,
  ]);
  await as(
    trainer,
    "SELECT moderate_workout_comment($1,true,'Reviewed moderation')",
    [c],
  );
  expect(
    (await q("SELECT text,hidden FROM workout_comments WHERE id=$1", [c]))[0],
  ).toEqual({ text: "A real workout comment", hidden: true });
  expect(
    await as(other, "SELECT count(*)::int n FROM workout_comments"),
  ).toEqual([{ n: 0 }]);
});
it("counts exact/ranged length and combined category filters against actual approved supply", async () => {
  await q("UPDATE trainer_videos SET category='Strength' WHERE user_id=$1", [
    trainer,
  ]);
  await as(
    member,
    "SELECT record_discovery_demand('workouts','',p_length=>30,p_min_length=>15,p_categories=>ARRAY['Strength','Yoga'])",
  );
  const first = (await q("SELECT supply,topic FROM discovery_demand"))[0]!;
  expect(first["supply"]).toBe(5);
  await as(
    member,
    "SELECT record_discovery_demand('workouts','',p_length=>15,p_exact=>true,p_categories=>ARRAY['Strength','Yoga'])",
  );
  expect(
    await q("SELECT supply FROM discovery_demand ORDER BY supply"),
  ).toEqual([{ supply: 0 }, { supply: 5 }]);
});
it.each(["membership-first", "topup-first"] as const)(
  "reconciles overlapping class top-ups without token earnings or invented refund confirmation: %s",
  async (order) => {
    const id = await live();
    if (order === "membership-first") await paidPeriod();
    const args = {
      p_checkout_id: "cs_overlap",
      p_user_id: member,
      p_session_id: id,
      p_tokens: 1,
      p_gross_cents: 500,
      p_fee_cents: 45,
    };
    await q("SELECT settle_paid_checkout('tokens',$1,0)", [
      JSON.stringify(args),
    ]);
    if (order === "topup-first") await paidPeriod();
    await q("SELECT settle_paid_checkout('tokens',$1,0)", [
      JSON.stringify(args),
    ]);
    expect(
      await q("SELECT state FROM wallet_token_units WHERE lot_id='cs_overlap'"),
    ).toEqual([{ state: "held" }]);
    expect(
      await q(
        "SELECT refunded_cents FROM checkout_payment_state WHERE checkout_id='cs_overlap'",
      ),
    ).toEqual([{ refunded_cents: 0 }]);
    expect(
      await q(
        "SELECT reason,target_cents,completed_at FROM refund_jobs WHERE checkout_id='cs_overlap'",
      ),
    ).toEqual([
      {
        reason: "subscription_included_live",
        target_cents: 500,
        completed_at: null,
      },
    ]);
    await q("SELECT consume_attended_live_token($1,$2)", [member, id]);
    expect(await q("SELECT count(*)::int n FROM trainer_earnings")).toEqual([
      { n: 0 },
    ]);
    await q("SELECT apply_checkout_refund('cs_overlap',500,true)");
    expect(
      await q("SELECT state FROM wallet_token_units WHERE lot_id='cs_overlap'"),
    ).toEqual([{ state: "refunded" }]);
  },
);
