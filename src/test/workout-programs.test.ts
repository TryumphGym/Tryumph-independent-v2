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
import type { PGlite } from "@electric-sql/pglite";
import { createTestDatabase } from "./database";
import { newProgram, type FitnessProgram } from "../lib/programs";
const trainer = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  member = "33333333-3333-4333-8333-333333333333",
  stranger = "44444444-4444-4444-8444-444444444444",
  admin = "55555555-5555-4555-8555-555555555555";
const publicVideo = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  premiumVideo = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  pendingVideo = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
let db: PGlite;
async function actor<T = Record<string, unknown>>(
  id: string,
  sql: string,
  params: unknown[] = [],
) {
  await db.exec("SAVEPOINT actor");
  try {
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec("SET ROLE authenticated");
    const r = await db.query<T>(sql, params);
    await db.exec("RESET ROLE; RELEASE SAVEPOINT actor");
    return r.rows;
  } catch (e) {
    await db.exec(
      "ROLLBACK TO SAVEPOINT actor; RESET ROLE; RELEASE SAVEPOINT actor",
    );
    throw e;
  }
}
async function owner<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
) {
  await db.exec("SAVEPOINT owner_call");
  try {
    const r = await db.query<T>(sql, params);
    await db.exec("RELEASE SAVEPOINT owner_call");
    return r.rows;
  } catch (e) {
    await db.exec(
      "ROLLBACK TO SAVEPOINT owner_call; RELEASE SAVEPOINT owner_call",
    );
    throw e;
  }
}
function document(mode: FitnessProgram["mode"] = "free", video = publicVideo) {
  const p = newProgram();
  p.title = "Verified structured program";
  p.description = "Four-week fitness plan";
  p.mode = mode;
  p.price_cents = mode === "native" ? 10000 : 0;
  p.external_url =
    mode === "external" ? "https://example.com/trainer-store" : "";
  p.weeks[0]!.days[0]!.workouts = [
    {
      id: crypto.randomUUID(),
      video_id: video,
      instructions: "Move with control",
    },
  ];
  return p;
}
async function draft(p: FitnessProgram, id?: string) {
  return (
    await actor<{ id: string }>(
      trainer,
      "SELECT save_fitness_program($1::jsonb,$2::uuid) AS id",
      [JSON.stringify(p), id ?? null],
    )
  )[0]!.id;
}
async function published(p: FitnessProgram) {
  const id = await draft(p);
  const e = (
    await actor<{ id: string }>(
      trainer,
      "SELECT submit_fitness_program($1) AS id",
      [id],
    )
  )[0]!.id;
  await actor(
    admin,
    "SELECT review_fitness_program($1,'approved','Reviewed schedule and safety labels')",
    [e],
  );
  return { id, edition: e, document: p };
}
async function paid() {
  const p = await published(document("native", premiumVideo));
  await owner(
    "SELECT approve_program_terms($1,true,1000,'fixture-approved-terms')",
    [admin],
  );
  const o = (
    await owner<{ id: string }>("SELECT * FROM begin_program_order($1,$2)", [
      member,
      p.id,
    ])
  )[0]!;
  return { ...p, order: o.id };
}
async function confirm(order: string, refunded = 0) {
  await owner("SELECT confirm_program_order($1,$2,$3,10000,300,$4)", [
    order,
    "cs_" + order,
    "pi_" + order,
    refunded,
  ]);
}
async function adjust(
  order: string,
  refund: number,
  dispute = "",
  status = "",
) {
  await owner("SELECT adjust_program_payment($1,$2,$3,$4,$5,$6)", [
    order,
    "cs_" + order,
    "pi_" + order,
    refund,
    dispute,
    status,
  ]);
}
async function claim(order: string) {
  return (
    await owner<{
      id: string;
      amount: number;
      kind: string;
      transfer_id: string;
    }>("SELECT * FROM claim_program_payout($1)", [order])
  )[0];
}
beforeAll(async () => {
  db = await createTestDatabase();
  for (const [id, role] of [
    [trainer, "trainer"],
    [other, "trainer"],
    [member, "member"],
    [stranger, "member"],
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
  await db.exec(`INSERT INTO user_roles(user_id,role) VALUES('${admin}','admin');
 INSERT INTO certifications(user_id,name,expires,status,verified_at,verified_by) VALUES('${trainer}','CPR/AED',(current_date+365)::text,'verified',now(),'${admin}'),('${other}','CPR/AED',(current_date+365)::text,'verified',now(),'${admin}');
 INSERT INTO video_uploads(guid,user_id,library_id,access_scope) VALUES('${premiumVideo}','${trainer}','999','program');
 INSERT INTO trainer_videos(id,user_id,title,path,minutes,review_status,access_scope) VALUES('${publicVideo}','${trainer}','Public approved','bunny:123:${publicVideo}',20,'approved','public'),('${premiumVideo}','${trainer}','Protected approved','bunny:999:${premiumVideo}',20,'approved','program'),('${pendingVideo}','${trainer}','Not reviewed','bunny:123:${pendingVideo}',20,'pending','public');
 INSERT INTO trainer_accounts(user_id,stripe_account_id,payouts_enabled) VALUES('${trainer}','acct_fixture',true);`);
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
describe("workout program creation, moderation, enrollment and immutable purchases", () => {
  it("allows verified program creators without a quota but requires five approved videos for live", async () => {
    expect(
      await owner("SELECT trainer_is_eligible($1,true) AS ok", [trainer]),
    ).toEqual([{ ok: false }]);
    const p = await published(document());
    await actor(member, "SELECT enroll_fitness_program($1)", [p.id]);
    const totals = (
      await actor<{
        totals: Record<string, { enrollments: number; sales: number }>;
      }>(trainer, "SELECT program_metrics() AS totals")
    )[0]!.totals;
    expect(totals[p.id]).toMatchObject({ enrollments: 1, sales: 0 });
    expect(await actor(member, "SELECT program_metrics() AS totals")).toEqual([
      { totals: {} },
    ]);
  });
  it("saves incomplete drafts but refuses publishing an empty or unapproved schedule", async () => {
    const p = document();
    p.weeks[0]!.days[0]!.workouts = [];
    const id = await draft(p);
    await expect(
      actor(trainer, "SELECT submit_fitness_program($1)", [id]),
    ).rejects.toThrow("1–500");
    const invalid = document("free", pendingVideo);
    await expect(draft(invalid)).rejects.toThrow("approved Bunny");
    await expect(
      actor(member, "SELECT save_fitness_program($1::jsonb)", [
        JSON.stringify(document()),
      ]),
    ).rejects.toThrow("verified trainer");
  });
  it("prevents cross-trainer edits, direct edition edits and direct structured-field spoofing", async () => {
    const p = await published(document());
    await expect(
      actor(other, "SELECT save_fitness_program($1::jsonb,$2)", [
        JSON.stringify(document()),
        p.id,
      ]),
    ).rejects.toThrow("Not your");
    await expect(
      actor(
        trainer,
        "UPDATE trainer_programs SET published=false WHERE id=$1",
        [p.id],
      ),
    ).rejects.toThrow("transactional");
    await expect(
      actor(trainer, "UPDATE program_editions SET document='{}' WHERE id=$1", [
        p.edition,
      ]),
    ).rejects.toThrow("permission denied");
    await expect(
      actor(
        trainer,
        "INSERT INTO trainer_programs(trainer_id,title,current_edition) VALUES($1,'Forged',$2)",
        [trainer, p.edition],
      ),
    ).rejects.toThrow("server-managed");
  });
  it("requires independent admin approval and keeps unpublished editions available to enrolled members", async () => {
    const p = document();
    const id = await draft(p);
    const edition = (
      await actor<{ id: string }>(
        trainer,
        "SELECT submit_fitness_program($1) AS id",
        [id],
      )
    )[0]!.id;
    await expect(
      actor(trainer, "SELECT review_fitness_program($1,'approved','self')", [
        edition,
      ]),
    ).rejects.toThrow("Admin review");
    await actor(
      admin,
      "SELECT review_fitness_program($1,'approved','Reviewed')",
      [edition],
    );
    await actor(member, "SELECT enroll_fitness_program($1)", [id]);
    await actor(trainer, "SELECT set_fitness_program_visibility($1,false)", [
      id,
    ]);
    expect(
      await actor(member, "SELECT id FROM program_editions WHERE id=$1", [
        edition,
      ]),
    ).toHaveLength(1);
    expect(
      await actor(stranger, "SELECT id FROM program_editions WHERE id=$1", [
        edition,
      ]),
    ).toHaveLength(0);
    await db.exec(
      "SELECT set_config('request.jwt.claim.sub','',false); SET ROLE anon",
    );
    try {
      expect(
        (await db.query("SELECT id FROM trainer_programs WHERE id=$1", [id]))
          .rows,
      ).toHaveLength(0);
    } finally {
      await db.exec("RESET ROLE");
    }
  });
  it("serves public catalog metadata without exposing a premium paths or private instructions to anonymous readers", async () => {
    const p = await published(document("native", premiumVideo));
    await db.exec(
      "SELECT set_config('request.jwt.claim.sub','',false); SET ROLE anon",
    );
    try {
      const r = await db.query("SELECT * FROM trainer_programs WHERE id=$1", [
        p.id,
      ]);
      expect(r.rows).toHaveLength(1);
      expect(JSON.stringify(r.rows)).not.toContain("bunny:");
      expect(JSON.stringify(r.rows)).not.toContain(premiumVideo);
      expect(JSON.stringify(r.rows)).not.toContain("Move with control");
      expect(JSON.stringify(r.rows)).toContain("included_schedule");
      expect(
        (
          await db.query("SELECT id,path FROM trainer_videos WHERE id=$1", [
            premiumVideo,
          ])
        ).rows,
      ).toHaveLength(0);
    } finally {
      await db.exec("RESET ROLE");
    }
    expect(
      await actor(stranger, "SELECT id,path FROM trainer_videos WHERE id=$1", [
        premiumVideo,
      ]),
    ).toHaveLength(0);
    await expect(
      actor(stranger, "SELECT * FROM program_media_access($1,$2,$3)", [
        member,
        p.edition,
        p.document.weeks[0]!.days[0]!.workouts[0]!.id,
      ]),
    ).rejects.toThrow("permission denied");
  });
  it("allows free enrollment idempotently and tracks ordered workout instances, not just repeated videos", async () => {
    const d = document();
    d.weeks.push({
      id: crypto.randomUUID(),
      title: "Week 2",
      days: [
        {
          id: crypto.randomUUID(),
          title: "Repeat practice",
          rest: false,
          instructions: "",
          workouts: [
            {
              id: crypto.randomUUID(),
              video_id: publicVideo,
              instructions: "Repeat the same approved video",
            },
          ],
        },
      ],
    });
    const p = await published(d);
    await actor(member, "SELECT enroll_fitness_program($1)", [p.id]);
    await actor(member, "SELECT enroll_fitness_program($1)", [p.id]);
    const step = d.weeks[0]!.days[0]!.workouts[0]!.id;
    await actor(member, "SELECT set_program_progress($1,$2,true)", [
      p.edition,
      step,
    ]);
    await actor(member, "SELECT set_program_progress($1,$2)", [
      p.edition,
      step,
    ]);
    expect(
      await actor(
        member,
        "SELECT completed FROM program_progress WHERE edition_id=$1",
        [p.edition],
      ),
    ).toEqual([{ completed: true }]);
    await expect(
      actor(stranger, "SELECT set_program_progress($1,$2,true)", [
        p.edition,
        step,
      ]),
    ).rejects.toThrow("Enrollment");
    await expect(
      actor(member, "SELECT set_program_progress($1,gen_random_uuid(),true)", [
        p.edition,
      ]),
    ).rejects.toThrow("valid workout");
  });
  it("pins enrollments, schedule, titles and progress when trainers edit and reorder a new edition", async () => {
    const d = document();
    const p = await published(d);
    await actor(member, "SELECT enroll_fitness_program($1)", [p.id]);
    const step = d.weeks[0]!.days[0]!.workouts[0]!.id;
    await actor(member, "SELECT set_program_progress($1,$2,true)", [
      p.edition,
      step,
    ]);
    d.title = "Updated sale";
    d.weeks[0]!.days[0]!.workouts[0]!.instructions = "New instructions";
    await draft(d, p.id);
    const e = (
      await actor<{ id: string }>(
        trainer,
        "SELECT submit_fitness_program($1) AS id",
        [p.id],
      )
    )[0]!.id;
    await actor(
      admin,
      "SELECT review_fitness_program($1,'approved','Reviewed v2')",
      [e],
    );
    const snapshot = await actor<{ document: FitnessProgram }>(
      member,
      "SELECT document FROM program_editions WHERE id=$1",
      [p.edition],
    );
    expect(snapshot[0]!.document.title).toBe("Verified structured program");
    expect(snapshot[0]!.document.weeks[0]!.days[0]!.workouts[0]!.title).toBe(
      "Public approved",
    );
    expect(
      await actor(member, "SELECT edition_id FROM program_enrollments"),
    ).toEqual([{ edition_id: p.edition }]);
    await expect(
      actor(
        trainer,
        "UPDATE trainer_videos SET title='Silently replace' WHERE id=$1",
        [publicVideo],
      ),
    ).rejects.toThrow("immutable");
  });
  it("blocks new work on expired credentials without removing approved content from existing purchasers", async () => {
    const p = await published(document("free", premiumVideo));
    await actor(member, "SELECT enroll_fitness_program($1)", [p.id]);
    await owner(
      "UPDATE certifications SET expires=(current_date-1)::text WHERE user_id=$1",
      [trainer],
    );
    await expect(draft(document())).rejects.toThrow("verified trainer");
    await expect(
      actor(stranger, "SELECT enroll_fitness_program($1)", [p.id]),
    ).rejects.toThrow("unavailable");
    const step = p.document.weeks[0]!.days[0]!.workouts[0]!.id;
    expect(
      await owner("SELECT * FROM program_media_access($1,$2,$3)", [
        member,
        p.edition,
        step,
      ]),
    ).toHaveLength(1);
  });
  it("does not infer external entitlements from a visit or a free-enrollment call", async () => {
    const p = await published(document("external", premiumVideo));
    await expect(
      actor(member, "SELECT enroll_fitness_program($1)", [p.id]),
    ).rejects.toThrow("verification");
    await expect(
      actor(
        trainer,
        "SELECT grant_external_program($1,$2,'seller receipt verified')",
        [p.edition, member],
      ),
    ).rejects.toThrow("Admin receipt");
    await actor(
      admin,
      "SELECT grant_external_program($1,$2,'verified-seller-receipt-123')",
      [p.edition, member],
    );
    expect(
      await actor(member, "SELECT source,state FROM program_enrollments"),
    ).toEqual([{ source: "external_reviewed", state: "active" }]);
    expect(await owner("SELECT * FROM program_orders")).toHaveLength(0);
  });
  it("protects variation demonstrations, preserves the step timer, and checkpoints only valid selections", async () => {
    const d = document();
    const step = d.weeks[0]!.days[0]!.workouts[0]!;
    step.duration_seconds = 120;
    const variant = crypto.randomUUID();
    step.variations = [
      {
        id: variant,
        label: "Trainer modification",
        video_id: premiumVideo,
        instructions: "Use the approved demonstration",
      },
    ];
    const p = await published(d);
    await actor(member, "SELECT enroll_fitness_program($1)", [p.id]);
    const media = await owner<{ id: string }>(
      "SELECT * FROM program_media_access($1,$2,$3,$4)",
      [member, p.edition, step.id, variant],
    );
    expect(media[0]!.id).toBe(premiumVideo);
    await actor(member, "SELECT checkpoint_program_step($1,$2,45,$3)", [
      p.edition,
      step.id,
      variant,
    ]);
    expect(
      await actor(
        member,
        "SELECT variation_id,elapsed_seconds FROM program_progress",
      ),
    ).toEqual([{ variation_id: variant, elapsed_seconds: 45 }]);
    await expect(
      actor(
        member,
        "SELECT checkpoint_program_step($1,$2,0,gen_random_uuid())",
        [p.edition, step.id],
      ),
    ).rejects.toThrow("unavailable");
    expect(
      await actor(member, "SELECT elapsed_seconds FROM program_progress"),
    ).toEqual([{ elapsed_seconds: 45 }]);
    expect(
      await actor(member, "SELECT document FROM program_editions WHERE id=$1", [
        p.edition,
      ]),
    ).toMatchObject([
      {
        document: {
          weeks: [
            {
              days: [
                {
                  workouts: [
                    {
                      duration_seconds: 120,
                      variations: [{ label: "Trainer modification" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    ]);
    await expect(
      actor(stranger, "SELECT checkpoint_program_step($1,$2,45,$3)", [
        p.edition,
        step.id,
        variant,
      ]),
    ).rejects.toThrow("Enrollment");
  });
  it("refuses unapproved variation media even when the primary workout is approved", async () => {
    const d = document();
    d.weeks[0]!.days[0]!.workouts[0]!.variations = [
      {
        id: crypto.randomUUID(),
        label: "Unreviewed alternate",
        video_id: pendingVideo,
        instructions: "",
      },
    ];
    await expect(draft(d)).rejects.toThrow("Demonstrations require");
  });
  it("keeps premium uploads out of legacy playlists and makes media audience immutable", async () => {
    await expect(
      actor(
        trainer,
        "UPDATE trainer_videos SET access_scope='public' WHERE id=$1",
        [premiumVideo],
      ),
    ).rejects.toThrow("immutable");
    const p = (
      await actor<{ id: string }>(
        trainer,
        "INSERT INTO trainer_programs(trainer_id,title) VALUES($1,'Legacy') RETURNING id",
        [trainer],
      )
    )[0]!.id;
    await expect(
      actor(
        trainer,
        "INSERT INTO trainer_program_workouts(program_id,video_id,position) VALUES($1,$2,0)",
        [p, premiumVideo],
      ),
    ).rejects.toThrow();
  });
  it("revokes unsafe editions and supports program-wide moderation without deleting records", async () => {
    const p = await published(document());
    await actor(member, "SELECT enroll_fitness_program($1)", [p.id]);
    await actor(
      admin,
      "SELECT moderate_fitness_program($1,true,'Safety investigation')",
      [p.id],
    );
    expect(
      await actor(member, "SELECT id FROM program_editions WHERE id=$1", [
        p.edition,
      ]),
    ).toHaveLength(0);
    await actor(
      admin,
      "SELECT moderate_fitness_program($1,false,'Investigation complete')",
      [p.id],
    );
    expect(
      await actor(member, "SELECT id FROM program_editions WHERE id=$1", [
        p.edition,
      ]),
    ).toHaveLength(1);
    await actor(
      admin,
      "SELECT review_fitness_program($1,'revoked','Unsafe instructions')",
      [p.edition],
    );
    expect(
      await actor(member, "SELECT id FROM program_editions WHERE id=$1", [
        p.edition,
      ]),
    ).toHaveLength(0);
  });
});
describe("native program payment authority, refunds and exact configurable commission", () => {
  it("starts disabled with the approved 10% default and denies client payment mutation", async () => {
    expect(
      await owner("SELECT enabled,commission_bps FROM program_commerce"),
    ).toEqual([{ enabled: false, commission_bps: 1000 }]);
    const p = await published(document("native"));
    await expect(
      actor(
        member,
        "SELECT approve_program_terms($1,true,1000,'not-authorized')",
        [member],
      ),
    ).rejects.toThrow("permission denied");
    await expect(
      owner("SELECT * FROM begin_program_order($1,$2)", [member, p.id]),
    ).rejects.toThrow("disabled");
  });
  it("freezes price, commission and edition; grants access only after verified settlement; replay is idempotent", async () => {
    const p = await paid();
    const again = (
      await owner<{ id: string }>("SELECT * FROM begin_program_order($1,$2)", [
        member,
        p.id,
      ])
    )[0]!;
    expect(again.id).toBe(p.order);
    expect(
      await actor(member, "SELECT id FROM program_editions WHERE id=$1", [
        p.edition,
      ]),
    ).toHaveLength(0);
    await expect(
      actor(member, "SELECT confirm_program_order($1,$2,$3,10000,300,0)", [
        p.order,
        "fake",
        "fake",
      ]),
    ).rejects.toThrow("permission denied");
    await confirm(p.order);
    await confirm(p.order);
    expect(
      await actor(member, "SELECT id FROM program_editions WHERE id=$1", [
        p.edition,
      ]),
    ).toHaveLength(1);
    await expect(
      owner(
        "SELECT approve_program_terms($1,true,9999,'different-future-terms')",
        [admin],
      ),
    ).rejects.toThrow("90/10");
    expect(
      await owner(
        "SELECT price_cents,commission_bps FROM program_orders WHERE id=$1",
        [p.order],
      ),
    ).toEqual([{ price_cents: 10000, commission_bps: 1000 }]);
    const op = await claim(p.order);
    expect(op).toMatchObject({ kind: "transfer", amount: 8730 });
  });
  it("rejects altered checkout identities, wrong amounts and changed fee allocations", async () => {
    const p = await paid();
    await db.exec("SAVEPOINT invalid_payment");
    await expect(
      owner("SELECT confirm_program_order($1,$2,$3,1,0,0)", [
        p.order,
        "cs_bad",
        "pi_bad",
      ]),
    ).rejects.toThrow("mismatch");
    await db.exec("ROLLBACK TO SAVEPOINT invalid_payment");
  });
  it("retains refund evidence arriving before checkout settlement and never reopens on an older payment event", async () => {
    const p = await paid();
    await adjust(p.order, 10000);
    await confirm(p.order, 0);
    expect(
      await actor(member, "SELECT state FROM program_enrollments"),
    ).toEqual([{ state: "revoked" }]);
    expect(await claim(p.order)).toBeUndefined();
  });
  it("revokes on partial refunds and reverses only the corresponding earned amount", async () => {
    const p = await paid();
    await confirm(p.order);
    const op = (await claim(p.order))!;
    await owner("SELECT finish_program_payout($1,$2)", [op.id, "tr_original"]);
    await adjust(p.order, 5000);
    expect(
      await actor(member, "SELECT state FROM program_enrollments"),
    ).toEqual([{ state: "revoked" }]);
    expect(await claim(p.order)).toMatchObject({
      kind: "reversal",
      amount: 4500,
      transfer_id: "tr_original",
    });
  });
  it("closes dispute replays, restores won access without duplicating transfers, and keeps refunds revoked", async () => {
    const p = await paid();
    await confirm(p.order);
    const op = (await claim(p.order))!;
    await owner("SELECT finish_program_payout($1,$2)", [op.id, "tr_disputed"]);
    await adjust(p.order, 0, "dp_fixture", "open");
    expect(
      await actor(member, "SELECT state FROM program_enrollments"),
    ).toEqual([{ state: "revoked" }]);
    const reversal = (await claim(p.order))!;
    await owner("SELECT finish_program_payout($1,$2)", [
      reversal.id,
      "trr_disputed",
    ]);
    await adjust(p.order, 0, "dp_fixture", "won");
    await adjust(p.order, 0, "dp_fixture", "open");
    expect(
      await actor(member, "SELECT state FROM program_enrollments"),
    ).toEqual([{ state: "active" }]);
    expect(await claim(p.order)).toMatchObject({
      kind: "transfer",
      amount: 8730,
    });
    await adjust(p.order, 10000);
    expect(
      await actor(member, "SELECT state FROM program_enrollments"),
    ).toEqual([{ state: "revoked" }]);
  });
  it("keeps a newer repurchase active when an old fully refunded checkout replays", async () => {
    const p = await paid();
    await confirm(p.order);
    await adjust(p.order, 10000);
    const next = (
      await owner<{ id: string }>("SELECT * FROM begin_program_order($1,$2)", [
        member,
        p.id,
      ])
    )[0]!;
    await confirm(next.id);
    await confirm(p.order, 0);
    expect(
      await actor(member, "SELECT state,order_id FROM program_enrollments"),
    ).toEqual([{ state: "active", order_id: next.id }]);
  });
  it("queues refunds and holds access/payouts without pretending the provider already refunded", async () => {
    const p = await paid();
    await confirm(p.order);
    await actor(
      admin,
      "SELECT request_program_refund($1,'Approved support refund')",
      [p.order],
    );
    expect(
      await actor(member, "SELECT state FROM program_enrollments"),
    ).toEqual([{ state: "revoked" }]);
    expect(await claim(p.order)).toBeUndefined();
    expect(
      await owner("SELECT refunded_cents,refund_pending FROM program_orders"),
    ).toEqual([{ refunded_cents: 0, refund_pending: true }]);
  });
  it("does not double-claim an in-flight payout and resumes the original key before reconciling a new refund", async () => {
    const p = await paid();
    await confirm(p.order);
    const op = (await claim(p.order))!;
    expect(await claim(p.order)).toBeUndefined();
    await adjust(p.order, 10000);
    await owner(
      "UPDATE program_payout_operations SET lease_until=now()-interval '1 second' WHERE id=$1",
      [op.id],
    );
    expect(await claim(p.order)).toMatchObject({ id: op.id, amount: 8730 });
    await owner("SELECT finish_program_payout($1,$2)", [op.id, "tr_raced"]);
    await owner("SELECT finish_program_payout($1,$2)", [op.id, "tr_raced"]);
    expect(await claim(p.order)).toMatchObject({
      kind: "reversal",
      amount: 8730,
    });
  });
});

describe("program access periods, rich exercises and delivery accounting", () => {
  it.each(["30", "90"] as const)(
    "starts %s-day access at confirmation and rejects expired API, RLS, media and progress access",
    async (period) => {
      const doc = document("native", premiumVideo);
      doc.access_period = period;
      const p = await published(doc);
      await owner(
        "SELECT approve_program_terms($1,true,1000,'approved-90-10')",
        [admin],
      );
      const order = (
        await owner<{ id: string }>(
          "SELECT * FROM begin_program_order($1,$2)",
          [member, p.id],
        )
      )[0]!.id;
      await confirm(order);
      expect(
        await owner(
          "SELECT round(extract(epoch FROM (n.expires_at-o.paid_at))/86400)::integer AS days FROM program_enrollments n JOIN program_orders o ON o.id=n.order_id",
        ),
      ).toEqual([{ days: Number(period) }]);
      await owner(
        "UPDATE program_orders SET paid_at=now()-($2::integer+1)*interval '1 day' WHERE id=$1",
        [order, Number(period)],
      );
      await owner("SELECT sync_program_entitlement($1)", [order]);
      expect(
        await actor(member, "SELECT program_access($1) AS ok", [p.edition]),
      ).toEqual([{ ok: false }]);
      expect(
        await actor(member, "SELECT id FROM program_editions WHERE id=$1", [
          p.edition,
        ]),
      ).toHaveLength(0);
      await expect(
        owner("SELECT * FROM program_media_access($1,$2,$3)", [
          member,
          p.edition,
          doc.weeks[0]!.days[0]!.workouts[0]!.id,
        ]),
      ).rejects.toThrow("access denied");
      await expect(
        actor(member, "SELECT set_program_progress($1,$2,true)", [
          p.edition,
          doc.weeks[0]!.days[0]!.workouts[0]!.id,
        ]),
      ).rejects.toThrow("Enrollment");
      const next = (
        await owner<{ id: string }>(
          "SELECT * FROM begin_program_order($1,$2)",
          [member, p.id],
        )
      )[0]!.id;
      expect(next).not.toBe(order);
      await confirm(next);
      await confirm(order);
      expect(
        await actor(
          member,
          "SELECT order_id FROM program_enrollments WHERE edition_id=$1",
          [p.edition],
        ),
      ).toEqual([{ order_id: next }]);
    },
  );
  it("keeps lifetime access after years and ignores failed or refunded unrelated purchases", async () => {
    const a = await paid();
    await confirm(a.order);
    await owner(
      "UPDATE program_orders SET paid_at=now()-interval '20 years' WHERE id=$1",
      [a.order],
    );
    await owner("SELECT sync_program_entitlement($1)", [a.order]);
    const b = await paid();
    await owner("SELECT attach_program_checkout($1,$2,$3)", [
      b.order,
      "cs_failed",
      "pi_failed",
    ]);
    await owner("SELECT cancel_program_order($1,$2)", [b.order, "cs_failed"]);
    expect(
      await actor(member, "SELECT program_access($1) AS ok", [a.edition]),
    ).toEqual([{ ok: true }]);
    expect(
      await actor(
        member,
        "SELECT expires_at FROM program_enrollments WHERE edition_id=$1",
        [a.edition],
      ),
    ).toEqual([{ expires_at: null }]);
  });
  it("allocates a $50 sale with $1.75 actual fee to trainer $43.42 / Tryumph $4.83 and keeps hosting separate", async () => {
    const doc = document("native", premiumVideo);
    doc.price_cents = 5000;
    const p = await published(doc);
    await owner("SELECT approve_program_terms($1,true,1000,'approved-90-10')", [
      admin,
    ]);
    const order = (
      await owner<{ id: string }>("SELECT * FROM begin_program_order($1,$2)", [
        member,
        p.id,
      ])
    )[0]!.id;
    await owner("SELECT confirm_program_order($1,$2,$3,5000,175,0)", [
      order,
      "cs_fifty",
      "pi_fifty",
    ]);
    expect(await claim(order)).toMatchObject({
      kind: "transfer",
      amount: 4342,
    });
    const report = (
      await actor<{
        r: {
          trainer_cents: number;
          platform_cents: number;
          processing_cents: number;
        }[];
      }>(admin, "SELECT program_admin_report() AS r")
    )[0]!.r;
    expect(report[0]).toMatchObject({
      trainer_cents: 4342,
      platform_cents: 483,
      processing_cents: 175,
    });
    await expect(
      actor(member, "SELECT program_admin_report()"),
    ).rejects.toThrow("Admins only");
  });
  it("reuses media across ordered exercises and variations, derives intervals and removes ads from purchased programs", async () => {
    const doc = document("native", publicVideo);
    const step = doc.weeks[0]!.days[0]!.workouts[0]!;
    const ex = crypto.randomUUID(),
      variant = crypto.randomUUID();
    step.exercises = [
      {
        id: ex,
        label: "Bodyweight exercise",
        description: "Trainer demonstration",
        equipment: [],
        instructions: "Controlled movement",
        variations: [
          {
            id: variant,
            label: "Dumbbells",
            equipment: ["Dumbbells"],
            safety_notes: "Use an individually appropriate weight",
            instructions: "Move slowly",
            video_id: premiumVideo,
          },
        ],
      },
    ];
    step.intervals = [
      {
        id: crypto.randomUUID(),
        label: "Work",
        kind: "work",
        seconds: 30,
        exercise_id: ex,
      },
      { id: crypto.randomUUID(), label: "Recover", kind: "rest", seconds: 15 },
    ];
    const p = await published(doc);
    await owner("SELECT approve_program_terms($1,true,1000,'approved-90-10')", [
      admin,
    ]);
    const order = (
      await owner<{ id: string }>("SELECT * FROM begin_program_order($1,$2)", [
        member,
        p.id,
      ])
    )[0]!.id;
    await confirm(order);
    expect(
      await actor<{
        document: {
          weeks: { days: { workouts: { duration_seconds: number }[] }[] }[];
        };
      }>(member, "SELECT document FROM program_editions WHERE id=$1", [
        p.edition,
      ]),
    ).toMatchObject([
      {
        document: {
          weeks: [{ days: [{ workouts: [{ duration_seconds: 45 }] }] }],
        },
      },
    ]);
    expect(
      await owner(
        "SELECT id,ads_allowed FROM program_media_access($1,$2,$3,$4)",
        [member, p.edition, step.id, variant],
      ),
    ).toEqual([{ id: premiumVideo, ads_allowed: false }]);
    expect(
      await owner(
        "SELECT id,ads_allowed FROM program_media_access($1,$2,$3,$4)",
        [member, p.edition, step.id, ex],
      ),
    ).toEqual([{ id: publicVideo, ads_allowed: false }]);
    expect(
      (
        await owner<{ count: number }>(
          "SELECT count(*)::integer AS count FROM trainer_videos",
        )
      )[0]!.count,
    ).toBe(3);
    expect(
      (
        await owner<{ count: number }>(
          "SELECT count(*)::integer AS count FROM program_edition_videos WHERE edition_id=$1",
          [p.edition],
        )
      )[0]!.count,
    ).toBe(2);
  });
  it("keeps private images owner-scoped, immutable, independently approved and gated by edition membership", async () => {
    const path = `${trainer}/demo.webp`;
    await expect(
      actor(
        other,
        "INSERT INTO storage.objects(bucket_id,name) VALUES('program-demonstrations',$1)",
        [path],
      ),
    ).rejects.toThrow();
    await actor(
      trainer,
      "INSERT INTO storage.objects(bucket_id,name) VALUES('program-demonstrations',$1)",
      [path],
    );
    const img = (
      await actor<{ id: string }>(
        trainer,
        "SELECT register_program_image($1) AS id",
        [path],
      )
    )[0]!.id;
    await expect(
      actor(trainer, "SELECT review_program_image($1,'approved')", [img]),
    ).rejects.toThrow("Independent");
    const doc = document();
    doc.weeks[0]!.days[0]!.workouts[0]!.variations = [
      {
        id: crypto.randomUUID(),
        label: "Image demonstration",
        image_id: img,
        instructions: "Individual guidance",
      },
    ];
    const id = await draft(doc);
    await expect(
      actor(trainer, "SELECT submit_fitness_program($1)", [id]),
    ).rejects.toThrow("Approved private image");
    await actor(admin, "SELECT review_program_image($1,'approved')", [img]);
    const e = (
      await actor<{ id: string }>(
        trainer,
        "SELECT submit_fitness_program($1) AS id",
        [id],
      )
    )[0]!.id;
    await actor(
      admin,
      "SELECT review_fitness_program($1,'approved','Reviewed')",
      [e],
    );
    await actor(member, "SELECT enroll_fitness_program($1)", [id]);
    expect(await actor(stranger, "SELECT * FROM program_images")).toHaveLength(
      0,
    );
    expect(
      await actor(
        trainer,
        "UPDATE storage.objects SET name=$2 WHERE name=$1 RETURNING name",
        [path, `${trainer}/changed.webp`],
      ),
    ).toHaveLength(0);
    expect(
      await actor(
        trainer,
        "DELETE FROM storage.objects WHERE name=$1 RETURNING name",
        [path],
      ),
    ).toHaveLength(0);
    expect(
      await actor(
        member,
        "SELECT name FROM storage.objects WHERE bucket_id='program-demonstrations'",
      ),
    ).toHaveLength(0);
    expect(
      await owner("SELECT image_path FROM program_media_access($1,$2,$3,$4)", [
        member,
        e,
        doc.weeks[0]!.days[0]!.workouts[0]!.id,
        doc.weeks[0]!.days[0]!.workouts[0]!.variations![0]!.id,
      ]),
    ).toEqual([{ image_path: path }]);
  });
  it("records bounded idempotent usage checkpoints without polling or changing the payment split", async () => {
    const p = await published(document());
    await actor(member, "SELECT enroll_fitness_program($1)", [p.id]);
    const step = p.document.weeks[0]!.days[0]!.workouts[0]!.id;
    const session = (
      await owner<{ id: string }>(
        "SELECT start_program_usage($1,$2,$3) AS id",
        [member, p.edition, step],
      )
    )[0]!.id;
    await owner(
      "UPDATE program_usage SET created_at=now()-interval '1 minute' WHERE id=$1",
      [session],
    );
    await actor(member, "SELECT report_program_usage($1,40)", [session]);
    await actor(member, "SELECT report_program_usage($1,20)", [session]);
    await actor(member, "SELECT report_program_usage($1,40)", [session]);
    await expect(
      actor(stranger, "SELECT report_program_usage($1,1)", [session]),
    ).rejects.toThrow("Invalid");
    await expect(
      actor(member, "SELECT report_program_usage($1,1000)", [session]),
    ).rejects.toThrow("Invalid");
    expect(
      await owner("SELECT reported_seconds FROM program_usage WHERE id=$1", [
        session,
      ]),
    ).toEqual([{ reported_seconds: 40 }]);
    expect(
      (
        await actor<{ r: unknown[] }>(
          admin,
          "SELECT program_admin_report() AS r",
        )
      )[0]!.r,
    ).toMatchObject([
      {
        reported_seconds: 40,
        playback_sessions: 1,
        sales: 0,
        platform_cents: 0,
      },
    ]);
    await expect(actor(member, "SELECT * FROM program_usage")).rejects.toThrow(
      "permission denied",
    );
  });
});

it("withdraws listings when included media loses approval and denies trainer republishing until review is restored", async () => {
  const p = await paid();
  await confirm(p.order);
  await actor(
    admin,
    "SELECT review_trainer_video($1,'rejected','Withdrawn after moderation')",
    [premiumVideo],
  );
  expect(
    await owner("SELECT published FROM trainer_programs WHERE id=$1", [p.id]),
  ).toEqual([{ published: false }]);
  await expect(
    actor(trainer, "SELECT set_fitness_program_visibility($1,true)", [p.id]),
  ).rejects.toThrow("cannot be published");
  await expect(
    actor(member, "SELECT checkpoint_program_step($1,$2,10)", [
      p.edition,
      p.document.weeks[0]!.days[0]!.workouts[0]!.id,
    ]),
  ).rejects.toThrow("Approved workout unavailable");
  expect(
    await owner(
      "SELECT count(*)::integer AS count FROM program_enrollments WHERE edition_id=$1",
      [p.edition],
    ),
  ).toEqual([{ count: 1 }]);
});

it("reuses the original checkout and purchased edition if the trainer publishes a new price during a payment retry", async () => {
  const p = await paid();
  const changed = { ...p.document, price_cents: 15000 };
  await draft(changed, p.id);
  const next = (
    await actor<{ id: string }>(
      trainer,
      "SELECT submit_fitness_program($1) AS id",
      [p.id],
    )
  )[0]!.id;
  await actor(
    admin,
    "SELECT review_fitness_program($1,'approved','New price and edition reviewed')",
    [next],
  );
  const retry = (
    await owner<{ id: string; price_cents: number; edition_id: string }>(
      "SELECT * FROM begin_program_order($1,$2)",
      [member, p.id],
    )
  )[0]!;
  expect(retry).toMatchObject({
    id: p.order,
    price_cents: 10000,
    edition_id: p.edition,
  });
  await confirm(p.order);
  await expect(
    owner("SELECT * FROM begin_program_order($1,$2)", [member, p.id]),
  ).rejects.toThrow("Already enrolled");
  expect(
    await actor(
      member,
      "SELECT edition_id FROM program_enrollments WHERE program_id=$1",
      [p.id],
    ),
  ).toEqual([{ edition_id: p.edition }]);
});
