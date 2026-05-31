import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App.tsx"
import { applyThemeMode, getThemeMode } from "@/lib/utils"
import "./index.css"

applyThemeMode(getThemeMode())

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
