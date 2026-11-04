import { cronJobs } from "convex/server"

// Automatic wallet credits are intentionally disabled until the payout
// formula, funding, legal requirements, and operational controls are reviewed.
// Do not schedule financial payouts automatically in production yet.
const crons = cronJobs()

export default crons
