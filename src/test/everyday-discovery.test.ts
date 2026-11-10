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
const trainer = "11111111-1111-4111-8111-111111111111",
  admin = "22222222-2222-4222-8222-222222222222";
const members = Array.from(
  { length: 11 },
  (_, i) => `33333333-3333-4333-8333-${String(i + 1).padStart(12, "0")}`,
);
let db: PGlite, v: string;
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
const vote = (i: number, tags: string[] = ["fun"]) =>
  as(members[i]!, "SELECT save_workout_feedback($1,$2)", [v, tags]);
const tags = async (user: string | null = null) =>
  (
    await as<{ tags: Record<string, { tags: string[]; respondents: number }> }>(
      user,
      "SELECT workout_community_tags($1) tags",
      [[v]],
    )
  )[0]!.tags;
beforeAll(async () => {
  db = await createTestDatabase();
  for (const id of [trainer, admin, ...members])
    await db.query(
      "INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)",
      [
        id,
        `${id}@fixture.invalid`,
        JSON.stringify({
          requested_role: id === trainer ? "trainer" : "member",
          name: "Fixture",
        }),
      ],
    );
  await db.exec(
    `INSERT INTO user_roles(user_id,role) VALUES('${admin}','admin')`,
  );
  v = (
    await db.query<{ id: string }>(
      `INSERT INTO trainer_videos(user_id,title,path,minutes,review_status) VALUES('${trainer}','Public','owned/workout.mp4',10,'approved') RETURNING id`,
    )
  ).rows[0]!.id;
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
describe("private subjective workout feedback", () => {
  it("allows exactly one active ballot per member, updates counts and removes without exposing individual feedback", async () => {
    await vote(0, ["fun", "great_instructions"]);
    await vote(0, ["relaxing"]);
    expect(
      await q(
        "SELECT respondents,counts FROM workout_feedback_totals WHERE video_id=$1",
        [v],
      ),
    ).toEqual([
      {
        respondents: 1,
        counts: { fun: 0, great_instructions: 0, relaxing: 1 },
      },
    ]);
    expect(await as(members[1]!, "SELECT * FROM workout_feedback")).toEqual([]);
    await expect(as(null, "SELECT * FROM workout_feedback")).rejects.toThrow(
      "permission",
    );
    await expect(
      as(
        members[0]!,
        `INSERT INTO workout_feedback(video_id,user_id,tags) VALUES($1,'${members[1]}',ARRAY['fun'])`,
        [v],
      ),
    ).rejects.toThrow("permission");
    await as(members[0]!, "SELECT remove_workout_feedback($1)", [v]);
    expect(
      await q(
        "SELECT respondents FROM workout_feedback_totals WHERE video_id=$1",
        [v],
      ),
    ).toEqual([{ respondents: 0 }]);
  });
  it("enforces minimum ten unique responses and at least seventy percent agreement", async () => {
    for (let i = 0; i < 9; i++) await vote(i, i < 7 ? ["fun"] : ["relaxing"]);
    expect(await tags()).toEqual({});
    await vote(9, ["relaxing"]);
    expect((await tags())[v]).toEqual({ tags: ["fun"], respondents: 10 });
    await vote(10, ["relaxing"]);
    expect(await tags()).toEqual({});
    await vote(10, ["fun"]);
    expect((await tags())[v]?.tags).toEqual(["fun"]);
  });
  it("allows configurable stricter thresholds with admin-only audit and moderation", async () => {
    for (let i = 0; i < 10; i++) await vote(i);
    await expect(
      as(members[0]!, "SELECT configure_workout_feedback(10,7000)"),
    ).rejects.toThrow("Administrators");
    await as(admin, "SELECT configure_workout_feedback(11,8000)");
    expect(await tags()).toEqual({});
    await vote(10);
    expect((await tags())[v]?.respondents).toBe(11);
    await as(
      admin,
      "SELECT moderate_workout_feedback($1,$2,true,'Suspicious response reviewed')",
      [v, members[0]],
    );
    expect(await tags()).toEqual({});
    await expect(vote(0)).rejects.toThrow("moderation");
    await expect(
      as(
        members[1]!,
        "SELECT moderate_workout_feedback($1,$2,false,'forged')",
        [v, members[0]],
      ),
    ).rejects.toThrow("Administrator");
  });
  it("never allows subjective tags to create medical labels, pending-workout access or premium access", async () => {
    await expect(vote(0, ["pregnancy_safe"])).rejects.toThrow("subjective");
    await expect(vote(0, ["fun", "fun"])).rejects.toThrow("distinct");
    await q("UPDATE trainer_videos SET review_status='pending' WHERE id=$1", [
      v,
    ]);
    await expect(vote(0)).rejects.toThrow("approved");
    await q(
      "INSERT INTO video_uploads(guid,user_id,library_id,access_scope) VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',$1,'999','program')",
      [trainer],
    );
    const p = (
      await q<{ id: string }>(
        `INSERT INTO trainer_videos(user_id,title,path,minutes,review_status,access_scope) VALUES('${trainer}','Private','bunny:999:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',10,'approved','program') RETURNING id`,
      )
    )[0]!.id;
    await expect(
      as(members[0]!, "SELECT save_workout_feedback($1,ARRAY['fun'])", [p]),
    ).rejects.toThrow("access");
    expect(
      await as(null, "SELECT id FROM public_workout_catalog WHERE id=$1", [p]),
    ).toEqual([]);
  });
  it("hides withdrawn workout aggregates and allows owners to remove feedback after withdrawal", async () => {
    for (let i = 0; i < 10; i++) await vote(i);
    await q("UPDATE trainer_videos SET review_status='rejected' WHERE id=$1", [
      v,
    ]);
    expect(await tags()).toEqual({});
    await as(members[0]!, "SELECT remove_workout_feedback($1)", [v]);
    expect(await as(members[0]!, "SELECT * FROM workout_feedback")).toEqual([]);
  });
  it("filters the public pick catalog before limiting results and preserves legacy no-equipment and prenatal metadata", async () => {
    await q(
      "UPDATE trainer_videos SET pregnancy_safe=true,category='Strength',level='Beginner',required_equipment=ARRAY[]::text[],discovery_tags=ARRAY['postpartum','seated'],intensity='gentle' WHERE id=$1",
      [v],
    );
    const query =
      "SELECT pick_workout_catalog(15,ARRAY[]::text[],'any','Beginner',ARRAY['prenatal','seated'],'gentle',false) items";
    const result = await as<{ items: { id: string }[] }>(null, query);
    expect(result[0]!.items.map((x) => x.id)).toEqual([v]);
    await q(
      "UPDATE trainer_videos SET required_equipment=ARRAY['Dumbbells'] WHERE id=$1",
      [v],
    );
    expect(await as(null, query)).toEqual([{ items: [] }]);
    await q("UPDATE trainer_videos SET review_status='rejected' WHERE id=$1", [
      v,
    ]);
    expect(
      await as(
        null,
        "SELECT pick_workout_catalog(15,ARRAY['Dumbbells'],'any','any',ARRAY[]::text[],'any',false) items",
      ),
    ).toEqual([{ items: [] }]);
  });
  it("does not let a moderated member evade an exclusion by removing and resubmitting feedback", async () => {
    await vote(0);
    await as(
      admin,
      "SELECT moderate_workout_feedback($1,$2,true,'Reviewed suspicious voting')",
      [v, members[0]],
    );
    await as(members[0]!, "SELECT remove_workout_feedback($1)", [v]);
    await expect(vote(0)).rejects.toThrow("moderation");
  });
});
