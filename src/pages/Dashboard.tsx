import { motion } from "framer-motion"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"

export function Dashboard() {
  const { profile, user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border/60 px-6 py-4">
        <div className="flex items-baseline gap-0.5">
          <span className="font-display text-lg font-semibold tracking-tight">SquadWriter</span>
          <span
            aria-hidden
            className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.1em] bg-brand animate-caret-blink"
          />
        </div>
        <div className="flex items-center gap-4 font-mono text-xs text-muted-foreground">
          <span>@{profile?.username}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void signOut()}
            className="font-mono text-xs"
          >
            Sign out
          </Button>
        </div>
      </header>

      <motion.main
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mx-auto max-w-4xl px-6 py-20"
      >
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-brand">Dashboard</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">
          Welcome, {profile?.username}.
        </h1>
        <p className="mt-4 max-w-prose font-mono text-sm leading-relaxed text-muted-foreground">
          You're signed in as {user?.email}. Projects, prompts, and the editor arrive in the
          coming stages.
        </p>

        <div className="mt-12 rounded-lg border border-dashed border-border/70 bg-card/40 p-10 text-center">
          <p className="font-mono text-xs text-muted-foreground">
            Stage 4 will list your projects here.
          </p>
        </div>
      </motion.main>
    </div>
  )
}
