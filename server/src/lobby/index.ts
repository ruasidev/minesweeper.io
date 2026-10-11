import { randomSeed } from "../../../shared/engine/seed.js"
import { env } from "../env.js"
import { databaseLedger } from "../ledger.js"
import { dailySeedFrom } from "../modes/daily.js"
import { createLobby } from "./lobby.js"

export type { Connection } from "./types.js"

// The lobby everybody plays in. What it keeps goes in the database, and every board in it is made from a seed
// drawn from the system's cryptographic source (or, for the day's board, from the server's secret)
export const lobby = createLobby({ ledger: databaseLedger, freshSeed: randomSeed, dailySeed: dailySeedFrom(env.authSecret) })
