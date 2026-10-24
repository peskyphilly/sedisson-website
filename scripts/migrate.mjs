import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run migrations.");
}

const sql = neon(process.env.DATABASE_URL);
const migration = await readFile(new URL("../migrations/001_assessment_submissions.sql", import.meta.url), "utf8");
const statements = migration
  .split(/;\s*(?:\n|$)/)
  .map(statement => statement.trim())
  .filter(Boolean);

for (const statement of statements) {
  await sql.query(statement);
}
console.log("Assessment database migration complete.");
