import { lazy, Suspense } from "react"
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom"
import { motion } from "framer-motion"
import { AuthProvider, useAuth } from "@/hooks/useAuth"
import { Login } from "@/pages/Login"
import { Dashboard } from "@/pages/Dashboard"
import { ProjectPage } from "@/pages/ProjectPage"

// Heavy/admin routes are code-split so Login + Dashboard stay light.
const PromptPage = lazy(() => import("@/pages/PromptPage").then((m) => ({ default: m.PromptPage })))
const SessionPage = lazy(() => import("@/pages/SessionPage").then((m) => ({ default: m.SessionPage })))
const AdminConsole = lazy(() =>
  import("@/components/admin/AdminConsole").then((m) => ({ default: m.AdminConsole })),
)

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex items-baseline gap-0.5"
      >
        <span className="font-display text-xl font-semibold tracking-tight">SquadWriter</span>
        <span
          aria-hidden
          className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.12em] bg-brand animate-caret-blink"
        />
      </motion.div>
    </div>
  )
}

function AppRoutes() {
  const { session, profile, loading, profileReady } = useAuth()
  const location = useLocation()

  if (loading || (session && !profileReady)) return <Splash />
  if (!session || !profile) return <Login />

  return (
    <Suspense fallback={<Splash />}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        <Routes location={location}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects/:id" element={<ProjectPage />} />
          <Route path="/prompts/:promptId" element={<PromptPage />} />
          <Route path="/sessions/:id" element={<SessionPage />} />
          <Route
            path="/admin"
            element={profile.is_admin ? <AdminConsole /> : <Navigate to="/" replace />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </motion.div>
    </Suspense>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
