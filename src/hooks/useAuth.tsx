import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { ALLOWED_EMAIL_DOMAINS, isAllowedEmailDomain } from "@/lib/config"
import type { Profile } from "@/lib/types"

export type AuthResult = { error: string | null }
export type SignUpResult = AuthResult & { needsConfirmation?: boolean }

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  /** Initial session resolution still in flight. */
  loading: boolean
  /** Profile fetch for the current user has settled (so we know if onboarding is needed). */
  profileReady: boolean
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (email: string, password: string) => Promise<SignUpResult>
  signOut: () => Promise<void>
  /** Create the profiles row with a unique username (post-signup onboarding). */
  setUsername: (username: string) => Promise<AuthResult>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const DOMAIN_ERROR = `Use your SquadStack email (${ALLOWED_EMAIL_DOMAINS.map((d) => `@${d}`).join(" or ")}).`
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileReady, setProfileReady] = useState(false)

  const user = session?.user ?? null
  const userId = user?.id ?? null

  // Resolve the initial session, then keep it in sync. We only set state inside
  // the listener (no other supabase calls there — that can deadlock).
  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  // Load the profile whenever the signed-in user changes.
  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setProfileReady(true)
      return
    }
    let active = true
    setProfileReady(false)
    supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return
        setProfile(data ?? null)
        setProfileReady(true)
      })
    return () => {
      active = false
    }
  }, [userId])

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (!isAllowedEmailDomain(email)) return { error: DOMAIN_ERROR }
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    return { error: error?.message ?? null }
  }, [])

  const signUp = useCallback(async (email: string, password: string): Promise<SignUpResult> => {
    if (!isAllowedEmailDomain(email)) return { error: DOMAIN_ERROR }
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
    if (error) return { error: error.message }
    // When "Confirm email" is enabled, signUp returns a user but no session.
    return { error: null, needsConfirmation: !data.session }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const setUsername = useCallback(
    async (username: string): Promise<AuthResult> => {
      if (!user) return { error: "Not signed in." }
      const clean = username.trim()
      if (!USERNAME_RE.test(clean)) {
        return { error: "Username must be 3–20 characters: letters, numbers, or underscore." }
      }
      const { data, error } = await supabase
        .from("profiles")
        .insert({ id: user.id, username: clean, email: user.email ?? "" })
        .select()
        .single()
      if (error) {
        if (error.code === "23505") return { error: "That username is already taken." }
        return { error: error.message }
      }
      setProfile(data)
      return { error: null }
    },
    [user],
  )

  const value = useMemo<AuthContextValue>(
    () => ({ session, user, profile, loading, profileReady, signIn, signUp, signOut, setUsername }),
    [session, user, profile, loading, profileReady, signIn, signUp, signOut, setUsername],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>")
  return ctx
}
