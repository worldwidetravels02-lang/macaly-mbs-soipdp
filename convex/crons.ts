import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()

/** Credits monthly membership profit to every funded wallet on the first of the month. */
crons.monthly(
  "monthly profit payouts",
  { day: 1, hourUTC: 2, minuteUTC: 0 },
  internal.profitPayouts.runScheduled,
  {},
)

export default crons
