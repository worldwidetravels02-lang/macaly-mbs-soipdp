/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ResendOTP from "../ResendOTP.js";
import type * as accountState from "../accountState.js";
import type * as admin from "../admin.js";
import type * as adminCredentials from "../adminCredentials.js";
import type * as adminPasscode from "../adminPasscode.js";
import type * as auth from "../auth.js";
import type * as backup from "../backup.js";
import type * as crons from "../crons.js";
import type * as cryptoPayments from "../cryptoPayments.js";
import type * as currency from "../currency.js";
import type * as enquiries from "../enquiries.js";
import type * as http from "../http.js";
import type * as investments from "../investments.js";
import type * as macaly from "../macaly.js";
import type * as memberLevel from "../memberLevel.js";
import type * as members from "../members.js";
import type * as membership from "../membership.js";
import type * as payments from "../payments.js";
import type * as posts from "../posts.js";
import type * as profitPayouts from "../profitPayouts.js";
import type * as promotions from "../promotions.js";
import type * as properties from "../properties.js";
import type * as stripe from "../stripe.js";
import type * as support from "../support.js";
import type * as tasks from "../tasks.js";
import type * as tiers from "../tiers.js";
import type * as verifications from "../verifications.js";
import type * as wallet from "../wallet.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ResendOTP: typeof ResendOTP;
  accountState: typeof accountState;
  admin: typeof admin;
  adminCredentials: typeof adminCredentials;
  adminPasscode: typeof adminPasscode;
  auth: typeof auth;
  backup: typeof backup;
  crons: typeof crons;
  cryptoPayments: typeof cryptoPayments;
  currency: typeof currency;
  enquiries: typeof enquiries;
  http: typeof http;
  investments: typeof investments;
  macaly: typeof macaly;
  memberLevel: typeof memberLevel;
  members: typeof members;
  membership: typeof membership;
  payments: typeof payments;
  posts: typeof posts;
  profitPayouts: typeof profitPayouts;
  promotions: typeof promotions;
  properties: typeof properties;
  stripe: typeof stripe;
  support: typeof support;
  tasks: typeof tasks;
  tiers: typeof tiers;
  verifications: typeof verifications;
  wallet: typeof wallet;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
