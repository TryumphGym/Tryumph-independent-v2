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
import type { PGlite } from "@electric-sql/pglite";
import { createTestDatabase } from "./database";
const trainer = "11111111-1111-4111-8111-111111111111",
  member = "22222222-2222-4222-8222-222222222222",
  outsider = "33333333-3333-4333-8333-333333333333",
  admin = "44444444-4444-4444-8444-444444444444",
  session = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
let db: PGlite, posts: string[];
async function q<T = Record<string, unknown>>(
  sql: string,
  args: unknown[] = [],
) {
  await db.exec("SAVEPOINT q");
  try {
    const r = await db.query<T>(sql, args);
    await db.exec("RELEASE SAVEPOINT q");
    return r.rows;
  } catch (e) {
    await db.exec("ROLLBACK TO SAVEPOINT q;RELEASE SAVEPOINT q");
    throw e;
  }
}
async function as<T = Record<string, unknown>>(
  id: string | null,
  sql: string,
  args: unknown[] = [],
) {
  await db.exec("SAVEPOINT a");
  try {
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [
      id ?? "",
    ]);
    await db.exec(id ? "SET ROLE authenticated" : "SET ROLE anon");
    const r = await db.query<T>(sql, args);
    await db.exec("RESET ROLE;RELEASE SAVEPOINT a");
    return r.rows;
  } catch (e) {
    await db.exec("ROLLBACK TO SAVEPOINT a;RESET ROLE;RELEASE SAVEPOINT a");
    throw e;
  }
}
async function photo() {
  return (
    await as<{ id: string; original_path: string }>(
      trainer,
      `SELECT id,original_path FROM begin_post_photo($1,'Trainer demonstrates a seated modification','png')`,
      [posts[0]],
    )
  )[0]!;
}
const slot = (ids: string[], sid = session, user = member) =>
  q<{ id: string | null }>("SELECT community_ad_slot($1,$2,$3) id", [
    sid,
    user,
    ids,
  ]);
beforeAll(async () => {
  db = await createTestDatabase();
  for (const [id, role] of [
    [trainer, "trainer"],
    [member, "member"],
    [outsider, "member"],
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
    `INSERT INTO user_roles(user_id,role) VALUES('${admin}','admin');INSERT INTO certifications(user_id,name,expires,status,verified_at,verified_by) VALUES('${trainer}','CPR/AED',(current_date+365)::text,'verified',now(),'${admin}');INSERT INTO trybe_memberships(user_id,trybe_id) VALUES('${member}','coach-${trainer}');`,
  );
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [
    admin,
  ]);
  posts = (
    await db.query<{ id: string }>(
      `INSERT INTO posts(author_id,author_name,trybe,kind,text,visibility,ad_safe) SELECT '${trainer}','Trainer','coach-${trainer}','Post','Community update '||n,'public',true FROM generate_series(1,30)n RETURNING id`,
    )
  ).rows.map((r) => r.id);
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec("BEGIN");
  await q("UPDATE community_media_config SET enabled=true");
  await q("UPDATE community_ad_config SET enabled=true");
  await q(
    `INSERT INTO community_ad_placements(trybe_id,enabled,sensitive) VALUES('coach-${trainer}',true,false)`,
  );
});
afterEach(async () => {
  await db.exec("ROLLBACK");
});
describe("private community photo permission and moderation boundaries", () => {
  it("validates ownership, descriptions and four-photo limits while hiding pending attachments and the entire post", async () => {
    await expect(
      as(member, "SELECT begin_post_photo($1,'forged','jpg')", [posts[0]]),
    ).rejects.toThrow("ownership");
    await expect(
      as(trainer, "SELECT begin_post_photo($1,'','jpg')", [posts[0]]),
    ).rejects.toThrow("description");
    await photo();
    expect(
      await as(null, "SELECT id FROM posts WHERE id=$1", [posts[0]]),
    ).toEqual([]);
    expect(
      await as(member, "SELECT read_post_photos($1) p", [[posts[0]]]),
    ).toEqual([{ p: [] }]);
    for (let i = 1; i < 4; i++) await photo();
    await expect(photo()).rejects.toThrow("limit");
  });
  it("allows only immutable own uploads and never serves originals to members or ordinary administrators", async () => {
    const a = await photo();
    await as(
      trainer,
      "INSERT INTO storage.objects(bucket_id,name) VALUES('community-photo-uploads',$1)",
      [a.original_path],
    );
    await expect(
      as(
        member,
        "INSERT INTO storage.objects(bucket_id,name) VALUES('community-photo-uploads',$1)",
        [`${outsider}/forged.jpg`],
      ),
    ).rejects.toThrow("row-level security");
    for (const user of [trainer, member, admin])
      expect(
        await as(
          user,
          "SELECT name FROM storage.objects WHERE bucket_id='community-photo-uploads'",
        ),
      ).toEqual([]);
    expect(
      (
        await as(
          trainer,
          "UPDATE storage.objects SET name='replaced' WHERE bucket_id='community-photo-uploads'",
        )
      ).length,
    ).toBe(0);
    await expect(
      as(trainer, "SELECT review_post_photo($1,'approved',1,'x','y',true)", [
        a.id,
      ]),
    ).rejects.toThrow("permission");
  });
  it("fails closed without specialist clearance, keeps illegal-content holds out of ordinary admin preview and supports independent review", async () => {
    const a = await photo();
    await expect(
      q("SELECT review_post_photo($1,'approved',1,$2,$3,false)", [
        a.id,
        `${trainer}/safe.webp`,
        `${trainer}/thumb.webp`,
      ]),
    ).rejects.toThrow("specialist");
    await q("SELECT review_post_photo($1,'specialist',1,'','',false)", [a.id]);
    expect(
      await q("SELECT * FROM post_photo_access($1,$2,true)", [admin, a.id]),
    ).toEqual([]);
    await expect(
      as(admin, "SELECT admin_review_post_photo($1,true,'ordinary override')", [
        a.id,
      ]),
    ).rejects.toThrow("specialist-cleared");
    await q("SELECT review_post_photo($1,'review',1,$2,$3,true)", [
      a.id,
      `${trainer}/safe.webp`,
      `${trainer}/thumb.webp`,
    ]);
    await expect(
      as(member, "SELECT admin_review_post_photo($1,true,'forged review')", [
        a.id,
      ]),
    ).rejects.toThrow("Administrator");
    await as(
      admin,
      "SELECT admin_review_post_photo($1,true,'Reviewed fitness image in context')",
      [a.id],
    );
    expect(
      (
        await q("SELECT path FROM post_photo_access($1,$2,false)", [
          outsider,
          a.id,
        ])
      )[0],
    ).toEqual({ path: `${trainer}/safe.webp` });
  });
  it("protects private and subscriber photos and rechecks text edits and removals", async () => {
    const a = await photo();
    await q("SELECT review_post_photo($1,'approved',1,$2,$3,true)", [
      a.id,
      `${trainer}/safe.webp`,
      `${trainer}/thumb.webp`,
    ]);
    await q("UPDATE posts SET visibility='private' WHERE id=$1", [posts[0]]);
    expect(
      await q("SELECT * FROM post_photo_access($1,$2,false)", [outsider, a.id]),
    ).toEqual([]);
    expect(
      (await q("SELECT * FROM post_photo_access($1,$2,false)", [member, a.id]))
        .length,
    ).toBe(1);
    await q("UPDATE posts SET audience='subscribers' WHERE id=$1", [posts[0]]);
    expect(
      await q("SELECT * FROM post_photo_access($1,$2,false)", [member, a.id]),
    ).toEqual([]);
    await q(
      "UPDATE posts SET audience='community',text='New context' WHERE id=$1",
      [posts[0]],
    );
    expect(
      await q("SELECT * FROM post_photo_access($1,$2,false)", [member, a.id]),
    ).toEqual([]);
    await expect(
      q("SELECT review_post_photo($1,'approved',1,$2,$3,true)", [
        a.id,
        `${trainer}/safe.webp`,
        `${trainer}/thumb.webp`,
      ]),
    ).rejects.toThrow("Current");
    await as(trainer, "SELECT remove_post_photo($1)", [a.id]);
    expect(
      await as(member, "SELECT id FROM posts WHERE id=$1", [posts[0]]),
    ).toEqual([{ id: posts[0] }]);
  });
  it("soft-removes an owned post without orphaning retention evidence or breaking ordinary text posts", async () => {
    const a = await photo();
    await as(trainer, "SELECT delete_community_post($1)", [posts[0]]);
    expect(
      await as(member, "SELECT id FROM posts WHERE id=$1", [posts[0]]),
    ).toEqual([]);
    expect(
      await q(
        "SELECT removed_at IS NOT NULL removed FROM post_photos WHERE id=$1",
        [a.id],
      ),
    ).toEqual([{ removed: true }]);
    await expect(
      as(member, "SELECT delete_community_post($1)", [posts[1]]),
    ).rejects.toThrow("Not your");
  });
});
describe("anonymous photo identity", () => {
  it("authorizes public previews using null identity rather than an impersonated sentinel account", async () => {
    const a = await photo();
    await q("SELECT review_post_photo($1,'approved',1,$2,$3,true)", [
      a.id,
      `${trainer}/safe.webp`,
      `${trainer}/thumb.webp`,
    ]);
    expect(
      (await q("SELECT * FROM public_post_photo_access($1)", [a.id])).length,
    ).toBe(1);
    const zero = "00000000-0000-0000-0000-000000000000";
    await q("INSERT INTO auth.users(id,email) VALUES($1,$2)", [
      zero,
      "sentinel@fixture.invalid",
    ]);
    await q(
      `INSERT INTO trybe_memberships(user_id,trybe_id) VALUES($1,'coach-${trainer}')`,
      [zero],
    );
    await q("UPDATE posts SET visibility='private' WHERE id=$1", [posts[0]]);
    expect(
      (await q("SELECT * FROM post_photo_access($1,$2,false)", [zero, a.id]))
        .length,
    ).toBe(1);
    expect(
      await q("SELECT * FROM public_post_photo_access($1)", [a.id]),
    ).toEqual([]);
  });
});

describe("server-only community advertising policy and separate 100% platform accounting", () => {
  it("never inserts an ad into empty or sparse feeds, begins only after six organic posts and spaces across pagination", async () => {
    expect(await slot([])).toEqual([{ id: null }]);
    expect(await slot(posts.slice(0, 5))).toEqual([{ id: null }]);
    expect(await slot([posts[5]!])).toEqual([{ id: posts[5] }]);
    expect(await slot(posts.slice(6, 13))).toEqual([{ id: null }]);
    expect(await slot([posts[13]!])).toEqual([{ id: posts[13] }]);
    expect(await slot(posts.slice(0, 14))).toEqual([{ id: null }]);
  });
  it("preserves spacing across feed switches, ignores sponsored or unsafe content, and supports global/per-community disable", async () => {
    await q("UPDATE posts SET kind='Sponsored' WHERE id=$1", [posts[0]]);
    await q(
      "UPDATE posts SET text='Pregnancy recovery discussion' WHERE id=$1",
      [posts[1]],
    );
    expect(await slot(posts.slice(0, 6))).toEqual([{ id: null }]);
    expect(await slot(posts.slice(6, 8))).toEqual([{ id: posts[7] }]);
    await q("UPDATE community_ad_placements SET enabled=false");
    expect(await slot(posts.slice(8, 30))).toEqual([{ id: null }]);
    await q("UPDATE community_ad_placements SET enabled=true");
    await q("UPDATE community_ad_config SET enabled=false");
    expect(await slot(posts.slice(8, 30))).toEqual([{ id: null }]);
  });
  it("cannot fabricate placements or revenue through public client requests and keeps community revenue out of trainer video earnings", async () => {
    await expect(
      as(member, "SELECT community_ad_slot($1,$2,$3)", [
        session,
        member,
        posts.slice(0, 6),
      ]),
    ).rejects.toThrow("permission");
    await expect(
      as(
        trainer,
        `INSERT INTO posts(author_id,author_name,trybe,kind,text,ad_safe) VALUES('${trainer}','Coach','coach-${trainer}','Post','forged ad',true)`,
      ),
    ).rejects.toThrow("Only admins");
    await q(
      "INSERT INTO community_ad_receipts(provider_event,provider,gross_cents,fee_cents) VALUES('actual-provider-reference','sandbox-fixture',10000,300)",
    );
    expect(
      await q("SELECT platform_net_cents FROM community_ad_receipts"),
    ).toEqual([{ platform_net_cents: 9700 }]);
    expect(await q("SELECT count(*)::int n FROM trainer_earnings")).toEqual([
      { n: 0 },
    ]);
    await expect(
      as(
        member,
        "INSERT INTO community_ad_receipts(provider_event,provider,gross_cents,fee_cents) VALUES('fake','client',10000,0)",
      ),
    ).rejects.toThrow("permission");
  });
});
