import { useState } from "react"
import { Check, Monitor, Moon, Sun } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { applyThemeMode, getThemeMode, type ThemeMode } from "@/lib/utils"

const THEMES: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "dark", label: "Dark", icon: Moon },
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
]

export function UserMenu() {
  const { profile, signOut } = useAuth()
  const [mode, setMode] = useState<ThemeMode>(() => getThemeMode())

  function pick(next: ThemeMode) {
    setMode(next)
    applyThemeMode(next)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="font-mono text-xs text-muted-foreground">
          @{profile?.username}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
          Theme
        </DropdownMenuLabel>
        {THEMES.map((t) => {
          const Icon = t.icon
          return (
            <DropdownMenuItem key={t.value} onClick={() => pick(t.value)} className="font-mono text-xs">
              <Icon className="mr-2 size-3.5" />
              {t.label}
              {mode === t.value && <Check className="ml-auto size-3.5 text-brand" />}
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOut()} className="font-mono text-xs">
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
