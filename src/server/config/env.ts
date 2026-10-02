import dotenv from "dotenv";
import { z } from "zod";
import { assertStartupConfig } from "./assertStartupConfig";
import { errorMessage } from "../auth/requestUser";

/**
 * Server start-up settings (F-01, moved from server.ts): loads .env, fills development-only
 * defaults, checks the variables the server needs (stops the process when one is missing) and
 * runs the start-up config check.
 */
export function loadServerEnv(): void {
  dotenv.config();

  // --- Environment Validation ---
  // Determine default NODE_ENV: fail-safe to "production" unless explicitly set to "development" or running ts source directly
  const isTsSourceRun = Boolean(process.argv[1]?.endsWith(".ts"));
  const defaultNodeEnv = process.env.NODE_ENV || (isTsSourceRun ? "development" : "production");
  process.env.NODE_ENV = defaultNodeEnv;

  if (process.env.NODE_ENV !== "production") {
    process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dev_dummy_stripe_key_12345";
    process.env.SESSION_SECRET = process.env.SESSION_SECRET || "dev_session_secret_32bytes_long_123456789";
    process.env.CURRENCY_API_KEY = process.env.CURRENCY_API_KEY || "dev_currency_api_key_12345";
    process.env.TAX_API_KEY = process.env.TAX_API_KEY || "dev_tax_api_key_12345";
    process.env.SYSTEM_SALT = process.env.SYSTEM_SALT || "dev_system_salt_12345";
    process.env.INVITE_SECRET = process.env.INVITE_SECRET || "dev_invite_secret_12345";
  }

  const EnvSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default(defaultNodeEnv as "development" | "production" | "test"),
    GEMINI_API_KEY: z.string().optional(),
    // Third-party keys are optional at startup: their features report "not set up" until added.
    STRIPE_SECRET_KEY: z.string().optional(),
    SESSION_SECRET: z.string().min(1),
    CURRENCY_API_KEY: z.string().optional(),
    TAX_API_KEY: z.string().optional(),
    SYSTEM_SALT: z.string().min(1),
    DATABASE_URL: z.string().optional(),
  });

  const envResult = EnvSchema.safeParse(process.env);
  if (!envResult.success) {
    console.error("❌ Invalid environment variables:", envResult.error.format());
    process.exit(1);
  }

  // Ensure validated/defaulted values propagate to process.env
  process.env.NODE_ENV = envResult.data.NODE_ENV;

  try {
    assertStartupConfig();
  } catch (err) {
    console.error("❌ Startup config assertion failed:", errorMessage(err));
    if (process.env.NODE_ENV !== "test") {
      process.exit(1);
    }
  }
}
