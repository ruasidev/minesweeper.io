// Makes an account an admin, or a regular user again:  npm run set-role -- <email> <admin|user>
import { eq } from "drizzle-orm"
import { db, pool } from "../db/index.js"
import { user } from "../db/schema.js"

const [email, role] = process.argv.slice(2)
if (!email || (role !== "admin" && role !== "user")) {
  console.error("Usage: npm run set-role -- <email> <admin|user>")
  process.exit(1)
}

const updated = await db.update(user).set({ role }).where(eq(user.email, email.toLowerCase())).returning({ id: user.id })
if (updated.length === 0) {
  console.error(`No account with the email ${email}`)
  process.exitCode = 1
} else {
  console.log(`${email} is now ${role === "admin" ? "an admin" : "a regular user"}`)
}
await pool.end()
