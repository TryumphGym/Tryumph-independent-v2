// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { createHostedDatabase, hostedFixture } from "./hosted-database";
import { asUser } from "./database";
import {
  appObject,
  compareMetadata,
  parseInspection,
  type MetadataRow,
} from "../../scripts/schema-metadata";

const apply = await readFile(
  new URL(
    "../../docs/launch/reconciliation/01_stage_apply.sql",
    import.meta.url,
  ),
  "utf8",
);
const validate = await readFile(
  new URL(
    "../../docs/launch/reconciliation/02_validate_staging.sql",
    import.meta.url,
  ),
  "utf8",
);
const inspection = await readFile(
  new URL("../../docs/launch/inspect-hosted-schema.sql", import.meta.url),
  "utf8",
);
const trainer = "11111111-1111-4111-8111-111111111111",
  member = "22222222-2222-4222-8222-222222222222",
  friend = "33333333-3333-4333-8333-333333333333",
  admin = "44444444-4444-4444-8444-444444444444",
  stranger = "55555555-5555-4555-8555-555555555555";
let db: PGlite;
let before: Record<string, unknown>[];
const preserved = [
  "profiles",
  "friend_requests",
  "friendships",
  "messages",
  "certifications",
  "trainer_videos",
  "private_session_access",
  "checkout_payment_state",
  "trainer_earnings",
  "wallet_token_lots",
  "wallet_token_units",
  "trainer_store_items",
  "trybes",
];
async function records(database: PGlite) {
  const result = [];
  for (const table of preserved)
    result.push({
      table,
      rows: (
        await database.query(
          `SELECT to_jsonb(t) - ARRAY['payment_version','total_cents','deposit_cents','balance_cents','terms_version','both_present_at','delivered_at','member_confirmed_at','deposit_origin','transfer_used','transfer_from','fulfillment_pending'] AS row FROM ${table} t ORDER BY to_jsonb(t)::text`,
        )
      ).rows,
    });
  return result;
}
async function seed(database: PGlite) {
  for (const [id, role] of [
    [trainer, "trainer"],
    [member, "member"],
    [friend, "member"],
    [admin, "member"],
    [stranger, "member"],
  ]) {
    await database.query("INSERT INTO auth.users(id,email) VALUES($1,$2)", [
      id,
      `${id}@fixture.invalid`,
    ]);
    // The export does not include the auth.users trigger binding. These fixtures
    // insert profiles explicitly; they do not claim hosted signup verification.
    await database.query(
      "INSERT INTO profiles(id,name,role) VALUES($1,$2,$3)",
      [id, role, role],
    );
  }
  await database.exec(`INSERT INTO user_roles(user_id,role) VALUES('${admin}','admin');
   UPDATE profiles SET extra='{"trainer":{"rate":100}}' WHERE id='${trainer}';
   INSERT INTO certifications(user_id,name,expires,status,verified_at,verified_by) VALUES('${trainer}','CPR/AED',(current_date+365)::text,'verified',now(),'${admin}');
   INSERT INTO trainer_videos(user_id,title,path,minutes,review_status,reviewed_by,reviewed_at) SELECT '${trainer}','Approved','${trainer}/video.mp4',20,'approved','${admin}',now() FROM generate_series(1,5);
   INSERT INTO trainer_videos(user_id,title,path,minutes,review_status) VALUES('${trainer}','Pending','${trainer}/pending.mp4',20,'pending');
   INSERT INTO friendships(user_id,friend_id,friend_name,partner) VALUES('${member}','${friend}','Friend',false),('${friend}','${member}','Member',false),('${stranger}','${member}','Unaccepted unilateral row',true);
   INSERT INTO friend_requests(requester_id,recipient_id,requester_name,recipient_name) VALUES('${stranger}','${member}','Stranger','Member');
   INSERT INTO messages(sender_id,recipient_id,sender_name,text) VALUES('${member}','${friend}','Member','Existing private message');
   INSERT INTO trainer_store_items(trainer_id,title,external_url) VALUES('${trainer}','Existing trainer store','https://example.com/owned-store');
   INSERT INTO trybes(id,name,owner_id) VALUES('member-existing','Existing member Trybe','${member}');
   INSERT INTO private_session_access(checkout_id,trainer_id,member_id,day,time,starts_at,status) VALUES('cs_legacy_booking','${trainer}','${member}',current_date+5,'10:00',(current_date+5)::timestamp AT TIME ZONE 'America/Chicago'+interval '10 hours','paid');
   INSERT INTO checkout_payment_state(checkout_id,kind,user_id,gross_cents,fee_cents) VALUES('cs_legacy_booking','booking','${member}',5000,200);
   INSERT INTO trainer_earnings(trainer_slug,source,ref,gross_cents,fee_cents,net_cents,share_pct,payout_cents) VALUES('${trainer}','oneonone','cs_legacy_booking',5000,200,4800,90,4320);
   SELECT apply_paid_token_checkout('cs_legacy_tokens','${member}',2,1000,59);
  `);
}

beforeAll(async () => {
  db = await createHostedDatabase();
  const actual = (await db.query<MetadataRow>(inspection)).rows;
  expect(
    compareMetadata(hostedFixture.rows, actual).filter(
      (r) => r.status !== "matches",
    ),
  ).toEqual([]);
  await seed(db);
  before = await records(db);
  await db.exec(apply);
  await db.exec(validate);
}, 30000);
afterAll(async () => {
  await db?.close();
});

describe("reconciliation from the actual hosted metadata", () => {
  it("preserves every seeded account, pending request, message, video, payment and store row", async () => {
    expect(await records(db)).toEqual(before);
    expect(
      (
        await db.query(
          "SELECT payment_version,status FROM private_session_access WHERE checkout_id='cs_legacy_booking'",
        )
      ).rows,
    ).toEqual([{ payment_version: 1, status: "paid" }]);
    expect(
      (await db.query("SELECT * FROM private_booking_payments")).rows,
    ).toEqual([]);
    expect(
      (await db.query("SELECT * FROM private_balance_operations")).rows,
    ).toEqual([]);
  });
  it("keeps the manual inquiry policy name, fixes its expression and avoids a duplicate permissive policy", async () => {
    const policies = (
      await db.query<Record<string, unknown>>(
        "SELECT policyname,with_check,permissive FROM pg_policies WHERE schemaname='public' AND tablename='messages'",
      )
    ).rows;
    expect(policies).toContainEqual({
      policyname: "Trainer inquiries may be sent without friendship",
      with_check: "can_send_message(sender_id, recipient_id)",
      permissive: "PERMISSIVE",
    });
    expect(
      policies.some((p) => p["policyname"] === "launch_trainer_inquiries"),
    ).toBe(false);
    expect(
      policies.some(
        (p) =>
          p["policyname"] === "launch_message_permission" &&
          p["permissive"] === "RESTRICTIVE",
      ),
    ).toBe(true);
  });
  it("preserves accepted friend messages; permits eligible inquiries/replies; denies strangers, spoofing, blocks and admin surveillance", async () => {
    await asUser(
      db,
      member,
      `INSERT INTO messages(sender_id,recipient_id,sender_name,text) VALUES('${member}','${friend}','Member','Friend still works')`,
    );
    await asUser(
      db,
      member,
      `INSERT INTO messages(sender_id,recipient_id,sender_name,text) VALUES('${member}','${trainer}','Forged','Inquiry')`,
    );
    await asUser(
      db,
      trainer,
      `INSERT INTO messages(sender_id,recipient_id,sender_name,text) VALUES('${trainer}','${member}','Trainer','Reply')`,
    );
    await expect(
      asUser(
        db,
        stranger,
        `INSERT INTO messages(sender_id,recipient_id,sender_name,text) VALUES('${stranger}','${member}','Stranger','Unaccepted')`,
      ),
    ).rejects.toThrow();
    await expect(
      asUser(
        db,
        member,
        `INSERT INTO messages(sender_id,recipient_id,sender_name,text) VALUES('${friend}','${member}','Forged','Spoof')`,
      ),
    ).rejects.toThrow();
    expect(
      (await asUser(db, admin, "SELECT * FROM messages")).rows,
    ).toHaveLength(0);
    await asUser(
      db,
      trainer,
      `INSERT INTO message_controls(user_id,other_id,blocked) VALUES('${trainer}','${member}',true)`,
    );
    await expect(
      asUser(
        db,
        member,
        `INSERT INTO messages(sender_id,recipient_id,sender_name,text) VALUES('${member}','${trainer}','Member','Blocked')`,
      ),
    ).rejects.toThrow();
  });
  it("retains pending requests until an authorized recipient accepts, and unfriend preserves history", async () => {
    await expect(
      asUser(db, friend, `SELECT accept_friend_request('${stranger}')`),
    ).rejects.toThrow("No incoming request");
    await asUser(db, member, `SELECT accept_friend_request('${stranger}')`);
    await asUser(
      db,
      stranger,
      `INSERT INTO messages(sender_id,recipient_id,sender_name,text) VALUES('${stranger}','${member}','Stranger','Accepted')`,
    );
    await asUser(db, member, `SELECT unfriend_user('${stranger}')`);
    expect(
      (
        await asUser(
          db,
          member,
          "SELECT text FROM messages WHERE text='Accepted'",
        )
      ).rows,
    ).toHaveLength(1);
    await expect(
      asUser(
        db,
        stranger,
        `INSERT INTO messages(sender_id,recipient_id,sender_name,text) VALUES('${stranger}','${member}','Stranger','After unfriend')`,
      ),
    ).rejects.toThrow();
  });
  it("publishes official content with both existing and new triggers and preserves private audiences", async () => {
    await asUser(
      db,
      admin,
      "SELECT publish_official_announcement('Actual official')",
    );
    await asUser(
      db,
      admin,
      "SELECT publish_targeted_announcement('Trainers only','trainers')",
    );
    expect(
      (
        await db.query(
          "SELECT trybe,official,author_name FROM posts WHERE text='Actual official'",
        )
      ).rows,
    ).toEqual([
      { trybe: "official", official: true, author_name: "Tryumph Gym" },
    ]);
    expect(
      (await asUser(db, member, "SELECT * FROM audience_announcements")).rows,
    ).toHaveLength(0);
    expect(
      (await asUser(db, trainer, "SELECT * FROM audience_announcements")).rows,
    ).toHaveLength(1);
    await db.exec("SET ROLE anon");
    try {
      expect(
        (await db.query("SELECT title FROM trainer_videos")).rows,
      ).toHaveLength(5);
      expect(
        (await db.query("SELECT text FROM posts WHERE text='Actual official'"))
          .rows,
      ).toHaveLength(1);
    } finally {
      await db.exec("RESET ROLE");
    }
  });
  it("retains strict column ACLs and prevents client truncation and payment RPC execution", async () => {
    expect(
      (
        await db.query(
          "SELECT has_table_privilege('authenticated','certifications','UPDATE') AS broad,has_column_privilege('authenticated','certifications','status','UPDATE') AS review",
        )
      ).rows,
    ).toEqual([{ broad: false, review: true }]);
    await expect(asUser(db, member, "TRUNCATE refund_jobs")).rejects.toThrow(
      "permission denied",
    );
    await expect(
      asUser(
        db,
        member,
        `SELECT consume_attended_live_token('${member}',gen_random_uuid())`,
      ),
    ).rejects.toThrow("permission denied");
  });
  it("never creates a new balance for a legacy paid booking, and new deposits replay once", async () => {
    expect(
      (
        await db.query(
          "SELECT record_private_both_present('cs_legacy_booking') AS ready",
        )
      ).rows,
    ).toEqual([{ ready: false }]);
    expect(
      (
        await db.query(
          "SELECT * FROM claim_private_balance('cs_legacy_booking')",
        )
      ).rows,
    ).toHaveLength(0);
    const hold = (
      await db.query<{ id: string }>(
        `SELECT prepare_deposit_booking('${trainer}','${member}',current_date+7,'09:00','private-deposit-v1') AS id`,
      )
    ).rows[0]!.id;
    const settle = `SELECT apply_private_deposit('cs_new_fixture','${hold}','${member}',2500,103,'cus_fixture','pm_fixture','pi_fixture')`;
    await db.exec(settle);
    await db.exec(settle);
    expect(
      (
        await db.query(
          "SELECT payment_version,total_cents,deposit_cents,balance_cents FROM private_session_access WHERE checkout_id='cs_new_fixture'",
        )
      ).rows,
    ).toEqual([
      {
        payment_version: 2,
        total_cents: 10000,
        deposit_cents: 2500,
        balance_cents: 7500,
      },
    ]);
    expect(
      (
        await db.query(
          "SELECT * FROM private_booking_payments WHERE booking_id='cs_new_fixture'",
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query(
          "SELECT * FROM trainer_earnings WHERE ref='cs_new_fixture'",
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("refuses a replay before applying any additional state changes", async () => {
    await expect(db.exec(apply)).rejects.toThrow("Schema has advanced");
    await db.exec("ROLLBACK");
  });
  it("rejects unexpected schema drift atomically", async () => {
    const drift = await createHostedDatabase();
    try {
      await drift.exec(
        "CREATE POLICY unexpected_message_access ON messages FOR SELECT TO authenticated USING(true)",
      );
      await expect(drift.exec(apply)).rejects.toThrow(
        "Inspected schema changed",
      );
      await drift.exec("ROLLBACK");
      expect(
        (
          await drift.query(
            "SELECT to_regclass('public.private_payment_methods') AS t",
          )
        ).rows,
      ).toEqual([{ t: null }]);
    } finally {
      await drift.close();
    }
  });
});

describe("the unmodified bundles are not the reconciliation", () => {
  it("keeps the reviewed source fingerprints and staging artifact in sync", async () => {
    const manifest = JSON.parse(
      await readFile(
        new URL(
          "../../docs/launch/reconciliation/sources.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as { artifact_sha256: string; sources: Record<string, string> };
    expect(createHash("sha256").update(apply).digest("hex")).toBe(
      manifest.artifact_sha256,
    );
    for (const [file, hash] of Object.entries(manifest.sources))
      expect(
        createHash("sha256")
          .update(
            await readFile(
              new URL("../../migrations/" + file, import.meta.url),
            ),
          )
          .digest("hex"),
      ).toBe(hash);
  });
  it("rolls the entire reconciliation back if an original record changes", async () => {
    const legacy = await createHostedDatabase();
    try {
      await seed(legacy);
      const original = await records(legacy);
      const regression = apply.replace(
        "DO $after$",
        "UPDATE public.profiles SET name='REGRESSION';\nDO $after$",
      );
      await expect(legacy.exec(regression)).rejects.toThrow(
        "Existing data changed",
      );
      await legacy.exec("ROLLBACK");
      expect(await records(legacy)).toEqual(original);
      expect(
        (
          await legacy.query(
            "SELECT to_regclass('public.private_payment_methods') AS t",
          )
        ).rows,
      ).toEqual([{ t: null }]);
    } finally {
      await legacy.close();
    }
  });
  it("reproduces the full upgrade's incompatible removal of the hosted RPC default", async () => {
    const legacy = await createHostedDatabase();
    try {
      await expect(
        legacy.exec(
          await readFile(
            new URL("../../docs/launch/upgrade.sql", import.meta.url),
            "utf8",
          ),
        ),
      ).rejects.toThrow(/cannot remove parameter defaults/);
      await legacy.exec("ROLLBACK");
      expect(
        (
          await legacy.query(
            "SELECT to_regclass('public.private_payment_methods') AS t",
          )
        ).rows,
      ).toEqual([{ t: null }]);
    } finally {
      await legacy.close();
    }
  });
  it("shows that completion can apply yet still fail with the existing announcement trigger", async () => {
    const legacy = await createHostedDatabase();
    try {
      await seed(legacy);
      await legacy.exec(
        await readFile(
          new URL("../../docs/launch/completion.sql", import.meta.url),
          "utf8",
        ),
      );
      await expect(
        asUser(
          legacy,
          admin,
          "SELECT publish_official_announcement('Official')",
        ),
      ).rejects.toThrow(
        /Only leaders publish public posts|Invalid official post/,
      );
    } finally {
      await legacy.close();
    }
  });
});

describe("inspection input validation", () => {
  const rows = [
    { section: "00_context", object_name: "database", details: {} },
    {
      section: "99_report_complete",
      object_name: "summary",
      details: { report_rows: 2, baseline_selected: false },
    },
  ];
  it("accepts JSON and CSV including embedded quotes, commas and multiline cells", () => {
    const csv =
      "section,object_name,details\r\n" +
      rows
        .map((r) =>
          [r.section, r.object_name, JSON.stringify(r.details, null, 2)]
            .map((x) => '"' + x.replaceAll('"', '""') + '"')
            .join(","),
        )
        .join("\r\n");
    expect(parseInspection(csv)).toEqual(rows);
    expect(parseInspection(JSON.stringify(rows))).toEqual(rows);
  });
  it("rejects truncation, mismatched counts and duplicate objects", () => {
    expect(() => parseInspection(JSON.stringify(rows.slice(0, 1)))).toThrow(
      "completion",
    );
    expect(() => parseInspection(JSON.stringify([...rows, rows[0]]))).toThrow(
      "Duplicate",
    );
    expect(() =>
      parseInspection('section,object_name,details\n"unfinished'),
    ).toThrow("Unterminated");
  });
  it("compares PG17/18 NOT NULL correctly and normalizes only line endings", () => {
    expect(
      appObject({
        section: "04_constraint",
        object_name: "public.t.not_null",
        details: { kind: "n" },
      }),
    ).toBe(false);
    expect(
      compareMetadata(
        [
          {
            section: "08_routine",
            object_name: "public.f()",
            details: { definition: "a\r\nb" },
          },
        ],
        [
          {
            section: "08_routine",
            object_name: "public.f()",
            details: { definition: "a\nb" },
          },
        ],
      )[0]?.status,
    ).toBe("matches");
  });
});
