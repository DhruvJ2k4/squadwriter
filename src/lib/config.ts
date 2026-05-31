/**
 * App-wide configuration for SquadWriter.
 */

export const APP_NAME = "SquadWriter" as const

/**
 * Email domains permitted to register / sign in.
 * The domain lock is enforced in Stage 3 (Auth).
 */
export const ALLOWED_EMAIL_DOMAINS = ["squadstack.ai", "squadstack.com"] as const

/** Returns true if `email` belongs to an allowed SquadStack domain. */
export function isAllowedEmailDomain(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1]
  return domain !== undefined && (ALLOWED_EMAIL_DOMAINS as readonly string[]).includes(domain)
}
