import { motion } from "framer-motion"
import { APP_NAME } from "@/lib/config"

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
        {/* GPU-friendly entrance: animates opacity + transform only (see CLAUDE.md §7) */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="flex flex-col items-center gap-4"
        >
          <div className="grid size-14 place-items-center rounded-2xl bg-primary text-2xl font-semibold text-primary-foreground shadow-sm">
            S
          </div>
          <div className="space-y-1.5">
            <h1 className="text-3xl font-semibold tracking-tight">{APP_NAME}</h1>
            <p className="text-sm text-muted-foreground">
              Internal prompt editor &amp; store for SquadStack
            </p>
          </div>
          <span className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            Stage 1 · scaffold ready
          </span>
        </motion.div>
      </main>
    </div>
  )
}

export default App
