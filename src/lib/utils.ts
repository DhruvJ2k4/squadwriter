import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/** Merge conditional class names with Tailwind-aware conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type ThemeMode = "dark" | "light" | "system"
const THEME_KEY = "sw-theme"

/** The user's stored app theme preference (defaults to dark — this is a dark-first tool). */
export function getThemeMode(): ThemeMode {
  const v = typeof localStorage !== "undefined" ? localStorage.getItem(THEME_KEY) : null
  return v === "light" || v === "system" || v === "dark" ? v : "dark"
}

/** Persist and apply a theme by toggling the `dark` class on <html>. */
export function applyThemeMode(mode: ThemeMode): void {
  if (typeof document === "undefined") return
  localStorage.setItem(THEME_KEY, mode)
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
  const dark = mode === "dark" || (mode === "system" && prefersDark)
  document.documentElement.classList.toggle("dark", dark)
}

/** Compact relative time, e.g. "just now", "5m ago", "3h ago", or a date. */
export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const sec = Math.round(diffMs / 1000)
  if (sec < 60) return "just now"
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(iso).toLocaleDateString()
}
