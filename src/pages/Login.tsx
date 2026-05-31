import { useState, type FormEvent, type ReactNode } from "react"
import { AnimatePresence, motion, type Variants } from "framer-motion"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ALLOWED_EMAIL_DOMAINS } from "@/lib/config"
import { cn } from "@/lib/utils"

type AuthMode = "signin" | "signup"

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}
const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
}
const swap: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2, ease: "easeIn" } },
}

const GRID_BG =
  "linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px)," +
  "linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px)"

function Wordmark({ size = "text-2xl" }: { size?: string }) {
  return (
    <div className="flex items-baseline gap-0.5">
      <span className={cn("font-display font-semibold tracking-tight text-foreground", size)}>
        SquadWriter
      </span>
      <span
        aria-hidden
        className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.12em] bg-brand animate-caret-blink"
      />
    </div>
  )
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <Label
      htmlFor={htmlFor}
      className="font-mono text-[0.7rem] font-medium uppercase tracking-[0.18em] text-muted-foreground"
    >
      {children}
    </Label>
  )
}

const fieldInputClass = "font-mono focus-visible:border-brand focus-visible:ring-brand/25"

function AuthView() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<AuthMode>("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    const res = mode === "signin" ? await signIn(email, password) : await signUp(email, password)
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    if ("needsConfirmation" in res && res.needsConfirmation) {
      setInfo("Account created — check your inbox to confirm, then sign in.")
      setMode("signin")
      setPassword("")
    }
    // On success with a live session, AuthProvider routes us onward.
  }

  function toggle() {
    setMode((m) => (m === "signin" ? "signup" : "signin"))
    setError(null)
    setInfo(null)
  }

  return (
    <motion.div variants={swap} initial="hidden" animate="show" exit="exit">
      <div className="mb-7 space-y-1.5">
        <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight">
          {mode === "signin" ? "Welcome back." : "Create your account."}
        </h1>
        <p className="font-mono text-xs text-muted-foreground">
          {mode === "signin"
            ? "Sign in to your prompt workspace."
            : "Use your SquadStack email to get started."}
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@squadstack.ai"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={fieldInputClass}
          />
          <p className="pt-0.5 font-mono text-[0.7rem] text-muted-foreground/80">
            Restricted to {ALLOWED_EMAIL_DOMAINS.map((d) => `@${d}`).join(" · ")}
          </p>
        </div>

        <div className="space-y-1.5">
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            type="password"
            required
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={fieldInputClass}
          />
        </div>

        <AnimatePresence initial={false}>
          {(error || info) && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={cn("font-mono text-xs", error ? "text-destructive" : "text-brand")}
            >
              {error ?? info}
            </motion.p>
          )}
        </AnimatePresence>

        <Button
          type="submit"
          disabled={busy}
          className="w-full bg-brand font-medium text-brand-foreground hover:bg-brand/90"
        >
          {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center font-mono text-xs text-muted-foreground">
        {mode === "signin" ? "No account yet? " : "Already have one? "}
        <button
          type="button"
          onClick={toggle}
          className="text-foreground underline decoration-brand/60 underline-offset-4 hover:decoration-brand"
        >
          {mode === "signin" ? "Create one" : "Sign in"}
        </button>
      </p>
    </motion.div>
  )
}

function UsernameView() {
  const { setUsername, user, signOut } = useAuth()
  const [username, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const res = await setUsername(username)
    setBusy(false)
    if (res.error) setError(res.error)
    // On success, the profile is set and the app routes to the Dashboard.
  }

  return (
    <motion.div variants={swap} initial="hidden" animate="show" exit="exit">
      <div className="mb-7 space-y-1.5">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-brand">One last step</p>
        <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight">
          Claim your handle.
        </h1>
        <p className="font-mono text-xs text-muted-foreground">
          This is how teammates will see you across projects.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="username">Username</FieldLabel>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">@</span>
            <Input
              id="username"
              required
              autoFocus
              autoComplete="off"
              spellCheck={false}
              placeholder="jordan_p"
              value={username}
              onChange={(e) => setName(e.target.value)}
              className={fieldInputClass}
            />
          </div>
          <p className="pt-0.5 font-mono text-[0.7rem] text-muted-foreground/80">
            3–20 characters · letters, numbers, underscore
          </p>
        </div>

        <AnimatePresence initial={false}>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="font-mono text-xs text-destructive"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <Button
          type="submit"
          disabled={busy}
          className="w-full bg-brand font-medium text-brand-foreground hover:bg-brand/90"
        >
          {busy ? "Claiming…" : "Continue"}
        </Button>
      </form>

      <p className="mt-6 text-center font-mono text-xs text-muted-foreground">
        Signed in as {user?.email}.{" "}
        <button
          type="button"
          onClick={() => void signOut()}
          className="text-foreground underline decoration-brand/60 underline-offset-4 hover:decoration-brand"
        >
          Use a different account
        </button>
      </p>
    </motion.div>
  )
}

export function Login() {
  const { session, profile } = useAuth()
  const onboarding = !!session && !profile

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background text-foreground lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* LEFT — brand panel (desktop) */}
      <motion.aside
        variants={container}
        initial="hidden"
        animate="show"
        className="relative hidden flex-col justify-between overflow-hidden border-r border-border/60 bg-[#080808] p-12 lg:flex"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0" style={{ backgroundImage: GRID_BG, backgroundSize: "34px 34px" }} />
          <div className="absolute -left-28 -top-28 size-[28rem] rounded-full bg-brand/15 blur-[120px]" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
        </div>

        <motion.div variants={item} className="relative">
          <Wordmark />
        </motion.div>

        <motion.div variants={item} className="relative max-w-md">
          <p className="font-display text-[1.7rem] leading-snug text-foreground/90">
            Write the prompt once.
            <br />
            Version it forever.
          </p>
          <p className="mt-5 max-w-sm font-mono text-xs leading-relaxed text-muted-foreground">
            Draft, store, review, and co-edit your LLM prompts inside client projects — with
            history, comments, and live sessions.
          </p>
        </motion.div>

        <motion.div
          variants={item}
          className="relative flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground"
        >
          <span className="inline-block size-1.5 rounded-full bg-brand" />
          Internal · SquadStack
        </motion.div>
      </motion.aside>

      {/* RIGHT — form panel */}
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-12 px-6 py-14">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="lg:hidden"
        >
          <Wordmark size="text-xl" />
        </motion.div>

        <div className="w-full max-w-sm">
          <AnimatePresence mode="wait">
            {onboarding ? <UsernameView key="username" /> : <AuthView key="auth" />}
          </AnimatePresence>
        </div>

        <div className="h-4" />
      </div>
    </div>
  )
}
