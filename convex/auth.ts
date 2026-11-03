import { convexAuth } from "@convex-dev/auth/server"
import { Password } from "@convex-dev/auth/providers/Password"
import { ResendOTP } from "./ResendOTP"

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    ResendOTP,
    Password({
      reset: ResendOTP,
      profile(params) {
        // Normalise so sign-in matches the stored account even when the member
        // types capitals or extra spaces around the address.
        const email = String(params.email ?? "").trim().toLowerCase()
        const rawName = typeof params.name === "string" ? params.name.trim() : ""
        return { email, name: rawName || email.split("@")[0] }
      },
    }),
  ],
})
