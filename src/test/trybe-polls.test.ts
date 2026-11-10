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
import { createTestDatabase } from "./database";
import type { PGlite } from "@electric-sql/pglite";
import type { TrybePoll } from "../lib/polls";
const trainer = "11111111-1111-4111-8111-111111111111",
  member = "22222222-2222-4222-8222-222222222222",
  other = "33333333-3333-4333-8333-333333333333",
  admin = "44444444-4444-4444-8444-444444444444",
  owner = "55555555-5555-4555-8555-555555555555";
const group = `coach-${trainer}`;
let db: PGlite;
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
      "ROLLBACK TO SAVEPOINT actor; RESET ROLE; RELEASE SAVEPOINT actor",
    );
    throw e;
  }
}
async function root<T = Record<string, unknown>>(
  sql: string,
  args: unknown[] = [],
) {
  await db.exec("SAVEPOINT trusted");
  try {
    const r = await db.query<T>(sql, args);
    await db.exec("RELEASE SAVEPOINT trusted");
    return r.rows;
  } catch (e) {
    await db.exec("ROLLBACK TO SAVEPOINT trusted; RELEASE SAVEPOINT trusted");
    throw e;
  }
}
async function create({
  user = trainer,
  trybe = group,
  max = 1,
  notify = false,
  public: pub = false,
  options = ["6 AM", "Noon", "7 PM"],
  expiry = null as string | null,
} = {}) {
  return (
    await as<{ id: string }>(
      user,
      "SELECT save_trybe_poll($1,'What time works?','Schedule research',$2,$3,$4,$5,$6) AS id",
      [trybe, options, max, expiry, notify, pub],
    )
  )[0]!.id;
}
async function view(id: string, user: string | null = member) {
  return (
    await as<{ p: TrybePoll[] }>(user, "SELECT read_trybe_polls($1) AS p", [
      [id],
    ])
  )[0]!.p[0];
}
async function vote(id: string, ids: string[], user = member, revision = 1) {
  return (
    await as<{ p: TrybePoll }>(user, "SELECT vote_trybe_poll($1,$2,$3) AS p", [
      id,
      ids,
      revision,
    ])
  )[0]!.p;
}
beforeAll(async () => {
  db = await createTestDatabase();
  for (const [id, role] of [
    [trainer, "trainer"],
    [member, "member"],
    [other, "member"],
    [admin, "member"],
    [owner, "member"],
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
    `INSERT INTO user_roles(user_id,role) VALUES('${admin}','admin');INSERT INTO certifications(user_id,name,expires,status,verified_at,verified_by) VALUES('${trainer}','CPR/AED',(current_date+365)::text,'verified',now(),'${admin}');INSERT INTO trybe_memberships(user_id,trybe_id) VALUES('${member}','${group}');INSERT INTO trybes(id,name,owner_id,kind) VALUES('member-owned-group','Owned community','${owner}','member');`,
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
describe("Trybe poll authority, privacy and transactional ballots", () => {
  it("lets a current verified trainer create a real post and safely returns only public creator fields", async () => {
    const id = await create();
    expect(
      await as(trainer, "SELECT kind,trybe FROM posts WHERE id=$1", [id]),
    ).toEqual([{ kind: "Poll", trybe: group }]);
    expect(await view(id, trainer)).toMatchObject({
      question: "What time works?",
      voters: 0,
      resultsVisible: true,
      mayEdit: true,
    });
  });
  it("uses the actual non-trainer registry owner and joins the owner to their own community", async () => {
    const id = await create({ user: owner, trybe: "member-owned-group" });
    expect(await view(id, owner)).toMatchObject({
      mayEdit: true,
      resultsVisible: true,
    });
    expect(
      await as(owner, "SELECT trybe_id FROM trybe_memberships"),
    ).toContainEqual({ trybe_id: "member-owned-group" });
    await expect(
      create({ user: member, trybe: "member-owned-group" }),
    ).rejects.toThrow("actual Trybe owner");
  });
  it("denies ordinary members, other coaches and expired trainers poll creation", async () => {
    await expect(create({ user: member })).rejects.toThrow("Only");
    await expect(
      create({ user: trainer, trybe: `coach-${other}` }),
    ).rejects.toThrow("Only");
    await root(
      "UPDATE certifications SET expires=(current_date-1)::text WHERE user_id=$1",
      [trainer],
    );
    await expect(create()).rejects.toThrow("Only");
  });
  it.each([["", "Noon"], ["Noon", " noon "], ["one"]])(
    "rejects blank, duplicate or insufficient options %j",
    async (...options) => {
      await expect(create({ options: options as string[] })).rejects.toThrow(
        "Invalid",
      );
    },
  );
  it("rejects invalid selection limits and elapsed expiration times", async () => {
    await expect(create({ max: 4 })).rejects.toThrow("Invalid");
    await expect(create({ expiry: "2020-01-01T00:00:00Z" })).rejects.toThrow(
      "Invalid",
    );
  });
  it("shows private polls only to members, while public questions do not grant voting or result access", async () => {
    const id = await create();
    expect(await view(id, other)).toBeUndefined();
    expect(await view(id, null)).toBeUndefined();
    const pub = await create({ public: true });
    const anonymous = await view(pub, null);
    expect(anonymous).toMatchObject({ mayVote: false, resultsVisible: false });
    expect(anonymous!.options.every((o) => o.votes === null)).toBe(true);
    await expect(vote(pub, [anonymous!.options[0]!.id], other)).rejects.toThrow(
      "membership",
    );
  });
  it("accepts one ballot, replaces selections, and does not duplicate votes on retries", async () => {
    const id = await create();
    const p = (await view(id))!;
    const first = await vote(id, [p.options[0]!.id]);
    expect(first).toMatchObject({
      voters: 1,
      resultsVisible: true,
      mayEdit: false,
    });
    await vote(id, [p.options[0]!.id]);
    const changed = await vote(id, [p.options[1]!.id]);
    expect(changed.voters).toBe(1);
    expect(changed.options.map((o) => o.votes)).toEqual([0, 1, 0]);
    expect(
      await root("SELECT count(*)::integer AS n FROM trybe_poll_ballots"),
    ).toEqual([{ n: 1 }]);
  });
  it("counts multiple selections as one voter and enforces distinct selections, per-poll options and the maximum", async () => {
    const id = await create({ max: 2 });
    const p = (await view(id))!;
    const ids = p.options.map((o) => o.id);
    const result = await vote(id, ids.slice(0, 2));
    expect(result.voters).toBe(1);
    expect(result.options.map((o) => o.votes)).toEqual([1, 1, 0]);
    await expect(vote(id, ids)).rejects.toThrow("Invalid");
    await expect(vote(id, [ids[0]!, ids[0]!])).rejects.toThrow("Invalid");
    const otherPoll = await create();
    await expect(
      vote(id, [(await view(otherPoll))!.options[0]!.id]),
    ).rejects.toThrow("Invalid");
    await expect(vote(id, [])).rejects.toThrow("Invalid");
  });
  it("hides aggregates until a member votes and reveals final results after closure", async () => {
    const id = await create();
    const p = (await view(id))!;
    expect(p.resultsVisible).toBe(false);
    await vote(id, [p.options[0]!.id]);
    await as(
      other,
      "INSERT INTO trybe_memberships(user_id,trybe_id) VALUES($1,$2)",
      [other, group],
    );
    expect((await view(id, other))!.options[0]!.votes).toBeNull();
    await as(trainer, "SELECT close_trybe_poll($1)", [id]);
    expect(await view(id, other)).toMatchObject({
      closed: true,
      resultsVisible: true,
      voters: 1,
    });
  });
  it("enforces expiration during reads and votes without a scheduled closure job", async () => {
    const id = await create();
    const p = (await view(id))!;
    await root(
      "UPDATE trybe_polls SET expires_at=now()-interval '1 second' WHERE post_id=$1",
      [id],
    );
    expect(await view(id)).toMatchObject({
      closed: true,
      mayVote: false,
      resultsVisible: true,
    });
    await expect(vote(id, [p.options[0]!.id])).rejects.toThrow("closed");
  });
  it("preserves ballots on idempotent manual closing and rejects new votes and vote changes", async () => {
    const id = await create();
    const p = (await view(id))!;
    await vote(id, [p.options[0]!.id]);
    await as(trainer, "SELECT close_trybe_poll($1)", [id]);
    await as(trainer, "SELECT close_trybe_poll($1)", [id]);
    await expect(vote(id, [p.options[1]!.id])).rejects.toThrow("closed");
    expect(
      await root("SELECT count(*)::integer AS n FROM trybe_poll_ballots"),
    ).toEqual([{ n: 1 }]);
    expect(
      await root(
        "SELECT count(*)::integer AS n FROM moderation_actions WHERE target_id=$1 AND action='poll_closed'",
        [id],
      ),
    ).toEqual([{ n: 1 }]);
  });
  it("locks all wording and options once voting begins and detects stale editor and ballot revisions", async () => {
    const id = await create();
    const p = (await view(id))!;
    await as(
      trainer,
      "SELECT save_trybe_poll($1,'Updated question','Context',ARRAY['A','B'],1,NULL,false,false,$2,1)",
      [group, id],
    );
    await expect(vote(id, [p.options[0]!.id])).rejects.toThrow("stale");
    const current = (await view(id))!;
    await vote(id, [current.options[0]!.id], member, 2);
    await expect(
      as(
        trainer,
        "SELECT save_trybe_poll($1,'Misleading edit','',ARRAY['A','B'],1,NULL,false,false,$2,2)",
        [group, id],
      ),
    ).rejects.toThrow("has votes");
  });
  it("denies raw voter queries and mutations to members, creators, admins and anonymous users", async () => {
    const id = await create();
    for (const user of [trainer, member, admin, null]) {
      for (const table of [
        "trybe_polls",
        "trybe_poll_options",
        "trybe_poll_ballots",
        "trybe_poll_choices",
        "trybe_poll_notice_jobs",
      ])
        await expect(as(user, `SELECT * FROM ${table}`)).rejects.toThrow(
          "permission denied",
        );
    }
    await expect(as(member, "SELECT poll_view($1)", [id])).rejects.toThrow(
      "permission denied",
    );
    await expect(
      as(
        member,
        "INSERT INTO posts(author_id,author_name,trybe,kind,text) VALUES($1,'member',$2,'Poll','Fake')",
        [member, group],
      ),
    ).rejects.toThrow("transactional");
    await expect(
      as(trainer, "UPDATE posts SET visibility='public' WHERE id=$1", [id]),
    ).rejects.toThrow("transactional");
  });
  it("keeps ordinary posts, likes and comments intact and deletes poll children only with the parent", async () => {
    const id = await create();
    const p = (await view(id))!;
    await vote(id, [p.options[0]!.id]);
    await as(
      member,
      "INSERT INTO post_comments(post_id,author_id,author_name,text) VALUES($1,$2,'member','Useful question')",
      [id, member],
    );
    await as(member, "INSERT INTO post_likes(post_id,user_id) VALUES($1,$2)", [
      id,
      member,
    ]);
    await as(
      member,
      "INSERT INTO posts(author_id,author_name,trybe,kind,text) VALUES($1,'member',$2,'Win','Existing ordinary post')",
      [member, group],
    );
    await as(trainer, "DELETE FROM posts WHERE id=$1", [id]);
    expect(
      await root("SELECT count(*)::integer AS n FROM trybe_poll_ballots"),
    ).toEqual([{ n: 0 }]);
    expect(await as(member, "SELECT text FROM posts WHERE kind='Win'")).toEqual(
      [{ text: "Existing ordinary post" }],
    );
  });
  it("reuses reporting and admin moderation without exposing individual ballots", async () => {
    const id = await create();
    await as(
      member,
      "INSERT INTO content_reports(reporter_id,target_type,target_id,reason) VALUES($1,'post',$2,'other')",
      [member, id],
    );
    expect(
      await as(admin, "SELECT evidence FROM content_reports"),
    ).toMatchObject([{ evidence: "What time works?\nSchedule research" }]);
    await expect(
      as(admin, "SELECT close_trybe_poll($1,'')", [id]),
    ).rejects.toThrow("reason");
    await as(admin, "SELECT close_trybe_poll($1,'Moderation review')", [id]);
    await as(admin, "SELECT moderate_trybe_post($1,'hide',true)", [id]);
    expect(await view(id, member)).toBeUndefined();
    expect(await view(id, trainer)).toMatchObject({
      closed: true,
      resultsVisible: true,
    });
    expect(
      await as(
        admin,
        "SELECT action FROM moderation_actions WHERE target_id=$1",
        [id],
      ),
    ).toContainEqual({ action: "poll_closed" });
  });
  it("notifies only opted-in current members, deduplicates batches and links directly to the poll", async () => {
    await as(
      member,
      "INSERT INTO notification_preferences(user_id,poll_updates) VALUES($1,true)",
      [member],
    );
    await as(
      other,
      "INSERT INTO notification_preferences(user_id,poll_updates) VALUES($1,true)",
      [other],
    );
    const id = await create({ notify: true });
    await root("SELECT deliver_trybe_poll_notices(1)");
    await root("SELECT deliver_trybe_poll_notices(500)");
    await root("SELECT deliver_trybe_poll_notices(500)");
    expect(
      await as(
        member,
        "SELECT body,href FROM account_notifications WHERE category='poll'",
      ),
    ).toEqual([
      {
        body: "trainer posted a new poll: What time works?",
        href: `/trybes?poll=${id}`,
      },
    ]);
    expect(
      await as(
        other,
        "SELECT id FROM account_notifications WHERE category='poll'",
      ),
    ).toHaveLength(0);
    expect(
      await as(
        trainer,
        "SELECT id FROM account_notifications WHERE category='poll'",
      ),
    ).toHaveLength(0);
    await expect(create({ notify: true })).rejects.toThrow("one notified poll");
  });
  it("respects notification opt-outs, membership withdrawal, hidden polls and service-only fanout", async () => {
    const id = await create({ notify: true });
    await as(
      member,
      "INSERT INTO notification_preferences(user_id,poll_updates) VALUES($1,false)",
      [member],
    );
    await root("SELECT deliver_trybe_poll_notices()");
    expect(
      await as(
        member,
        "SELECT id FROM account_notifications WHERE category='poll'",
      ),
    ).toHaveLength(0);
    await expect(
      as(member, "SELECT deliver_trybe_poll_notices()"),
    ).rejects.toThrow("permission denied");
    await as(admin, "SELECT moderate_trybe_post($1,'hide',true)", [id]);
    expect(await view(id)).toBeUndefined();
  });
});

it("supports actual member joins to registered member Trybes and preserves ordinary membership behavior", async () => {
  const id = await create({ user: owner, trybe: "member-owned-group" });
  await as(
    member,
    "INSERT INTO trybe_memberships(user_id,trybe_id) VALUES($1,$2)",
    [member, "member-owned-group"],
  );
  const p = (await view(id, member))!;
  expect((await vote(id, [p.options[0]!.id])).voters).toBe(1);
  await as(member, "DELETE FROM trybe_memberships WHERE trybe_id=$1", [
    "member-owned-group",
  ]);
  await expect(vote(id, [p.options[1]!.id])).rejects.toThrow("membership");
});
it("does not deliver poll notifications after a member leaves or the parent becomes hidden", async () => {
  await as(
    member,
    "INSERT INTO notification_preferences(user_id,poll_updates) VALUES($1,true)",
    [member],
  );
  const id = await create({ notify: true });
  await as(member, "DELETE FROM trybe_memberships WHERE trybe_id=$1", [group]);
  await root("SELECT deliver_trybe_poll_notices()");
  expect(
    await as(
      member,
      "SELECT id FROM account_notifications WHERE category='poll'",
    ),
  ).toHaveLength(0);
  await as(
    member,
    "INSERT INTO trybe_memberships(user_id,trybe_id) VALUES($1,$2)",
    [member, group],
  );
  await root(
    "UPDATE trybe_poll_notice_jobs SET cursor_id=NULL,finished_at=NULL WHERE poll_id=$1",
    [id],
  );
  await as(admin, "SELECT moderate_trybe_post($1,'hide',true)", [id]);
  await root("SELECT deliver_trybe_poll_notices()");
  expect(
    await as(
      member,
      "SELECT id FROM account_notifications WHERE category='poll'",
    ),
  ).toHaveLength(0);
});
