import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "@/components/ui/sonner"
import { Button } from "@/components/ui/button"
import { isAuthenticated, clearToken, getMe } from "@/lib/api"
import { useEffect, useState } from "react"
import LoginPage from "@/pages/LoginPage"
import CataloguePage from "@/pages/CataloguePage"
import CoinInbox from "@/components/CoinInbox"
import { Coins, LogOut, Moon, Sun } from "lucide-react"

const queryClient = new QueryClient()

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("coin_dark_mode")
    if (saved !== null) return saved === "true"
    return window.matchMedia("(prefers-color-scheme: dark)").matches
  })

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
    localStorage.setItem("coin_dark_mode", String(dark))
  }, [dark])

  return [dark, () => setDark((d) => !d)] as const
}

function AppNav() {
  const navigate = useNavigate()
  const [username, setUsername] = useState("")
  const [dark, toggleDark] = useDarkMode()

  useEffect(() => {
    if (isAuthenticated()) {
      getMe().then((u) => setUsername(u.username)).catch(() => {})
    }
  }, [])

  function handleLogout() {
    clearToken()
    navigate("/login")
  }

  if (!isAuthenticated()) return null

  return (
    <nav className="border-b bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <img src="/turnip56-nav.png" alt="Turnip56" className="h-8 w-auto" />
            Coin Catalog
          </Link>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/">Add Coin</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/collection">Collection</Link>
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <CoinInbox />
          <button
            onClick={toggleDark}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            aria-label="Toggle dark mode"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <span className="text-sm text-muted-foreground">{username}</span>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="mr-1 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </nav>
  )
}

function CollectionPlaceholder() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center text-muted-foreground">
        <Coins className="mx-auto mb-4 h-12 w-12" />
        <h2 className="text-xl font-semibold">Collection View</h2>
        <p>Coming soon: browse and search your catalogued coins.</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppNav />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <CataloguePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/collection"
            element={
              <ProtectedRoute>
                <CollectionPlaceholder />
              </ProtectedRoute>
            }
          />
        </Routes>
        <Toaster position="top-right" />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
