// Brings the database up to date with the migrations in drizzle/. It does what `npm run db:migrate` does, without
// drizzle-kit: that is a development tool, and isn't installed where the server is hosted.
// Run from server/, after building:  node dist/server/src/scripts/migrate.js
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { db, pool } from "../db/index.js"

await migrate(db, { migrationsFolder: "drizzle" })
console.log("The database is up to date")
await pool.end()
