import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { motion } from "framer-motion"
import { AuthProvider, useAuth } from "@/hooks/useAuth"
import { Login } from "@/pages/Login"
import { Dashboard } from "@/pages/Dashboard"
import { ProjectPage } from "@/pages/ProjectPage"

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

  // Still resolving the session, or the session is known but the profile fetch
  // hasn't settled yet — show the splash to avoid a flash of the wrong screen.
  if (loading || (session && !profileReady)) return <Splash />

  // Unauthenticated, or authenticated without a profile (needs a username).
  // Login renders sign-in / sign-up or the username step based on auth state.
  if (!session || !profile) return <Login />

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/projects/:id" element={<ProjectPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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
