import { httpRouter } from "convex/server"
import { httpAction } from "./_generated/server"
import { internal } from "./_generated/api"
import { auth } from "./auth"

const http = httpRouter()

auth.addHttpRoutes(http)

http.route({
  path: "/stripe/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const signature = req.headers.get("stripe-signature")
    if (!signature) return new Response(JSON.stringify({ received: false }), { status: 400 })

    const mode = (req.headers.get("x-stripe-mode") ?? "test") === "live" ? "live" : "test"
    const payload = await req.text()
    const result = await ctx.runAction(internal.stripe.handleWebhook, {
      payload,
      signature,
      mode,
    })
    return new Response(JSON.stringify({ received: result.success }), {
      status: result.success ? 200 : 400,
    })
  }),
})

export default http
