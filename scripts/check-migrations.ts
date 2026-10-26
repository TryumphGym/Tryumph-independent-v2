import { createTestDatabase } from "../src/test/database.ts";
const db = await createTestDatabase();
console.log(
  "All ordered migrations applied to isolated PostgreSQL successfully.",
);
await db.close();
