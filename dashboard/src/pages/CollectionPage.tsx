import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { listCoinsFiltered, type Coin } from "@/lib/api"
import CoinDetailSheet from "@/components/CoinDetailSheet"
import { Coins as CoinsIcon, Search } from "lucide-react"

const DENOMINATIONS = [
  { value: "all", label: "All denominations" },
  { value: "20c", label: "20 Centavos" },
  { value: "10c", label: "10 Centavos" },
  { value: "50c", label: "50 Centavos" },
  { value: "un_peso", label: "Un Peso" },
  { value: "5_peso", label: "5 Pesos" },
  { value: "8_reales", label: "8 Reales" },
]

const STATUSES = [
  { value: "all", label: "All statuses" },
  { value: "staged", label: "Staged" },
  { value: "on_form", label: "On form" },
  { value: "shipped", label: "Shipped" },
  { value: "at_grader", label: "At grader" },
  { value: "graded", label: "Graded" },
  { value: "returned", label: "Returned" },
  { value: "held_back", label: "Held back" },
]

function statusTone(status: string): string {
  switch (status) {
    case "staged":
      return "bg-muted text-muted-foreground"
    case "on_form":
      return "bg-blue-100 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200"
    case "shipped":
      return "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
    case "at_grader":
      return "bg-purple-100 text-purple-900 dark:bg-purple-950/40 dark:text-purple-200"
    case "returned":
    case "graded":
      return "bg-green-100 text-green-900 dark:bg-green-950/40 dark:text-green-200"
    case "held_back":
      return "bg-rose-100 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
    default:
      return "bg-muted text-muted-foreground"
  }
}

export default function CollectionPage() {
  const [coins, setCoins] = useState<Coin[]>([])
  const [loading, setLoading] = useState(false)
  const [denomination, setDenomination] = useState("all")
  const [status, setStatus] = useState("all")
  const [needsWagerOnly, setNeedsWagerOnly] = useState(false)
  const [query, setQuery] = useState("")
  const [selectedCoinId, setSelectedCoinId] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      const list = await listCoinsFiltered({
        submission_status: status === "all" ? undefined : status,
        limit: 500,
      })
      setCoins(list)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const filtered = useMemo(() => {
    return coins.filter((c) => {
      if (denomination !== "all" && c.denomination !== denomination) return false
      if (needsWagerOnly && c.predicted_grade_hand) return false
      if (query.trim()) {
        const q = query.trim().toLowerCase()
        const haystack = [
          c.coin_id,
          c.year,
          c.mint_mark,
          c.km_number,
          c.variety_code,
          c.notes,
          c.source,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [coins, denomination, needsWagerOnly, query])

  const needsWagerCount = coins.filter((c) => !c.predicted_grade_hand).length

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Collection</h1>
          <p className="text-sm text-muted-foreground">
            {coins.length} coin{coins.length === 1 ? "" : "s"}
            {needsWagerCount > 0 && (
              <>
                {" · "}
                <span className="text-amber-600 dark:text-amber-400">
                  {needsWagerCount} awaiting wager
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-[1fr,200px,200px,auto]">
            <div>
              <Label htmlFor="search" className="text-xs">
                Search
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="coin_id, year, mint, variety, notes..."
                  className="pl-8"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Denomination</Label>
              <Select value={denomination} onValueChange={setDenomination}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DENOMINATIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant={needsWagerOnly ? "default" : "outline"}
                onClick={() => setNeedsWagerOnly((v) => !v)}
                className="w-full"
              >
                Needs wager
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <CoinsIcon className="h-10 w-10" />
          <p className="text-sm">No coins match these filters.</p>
          {coins.length === 0 && (
            <p className="text-xs">Catalogue your first coin from the Add Coin tab.</p>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((c) => (
            <button
              key={c.coin_id}
              onClick={() => setSelectedCoinId(c.coin_id)}
              className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card text-left transition-all hover:border-primary hover:shadow-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <div className="relative aspect-square bg-muted">
                {c.obverse_image_path ? (
                  <img
                    src={`/api/images/thumbs/${c.coin_id}_O.jpg`}
                    alt={c.coin_id}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none"
                    }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <CoinsIcon className="h-10 w-10 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute left-2 top-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${statusTone(c.submission_status)}`}
                  >
                    {c.submission_status.replace("_", " ")}
                  </span>
                </div>
                {!c.predicted_grade_hand && (
                  <div className="absolute right-2 top-2">
                    <Badge variant="destructive" className="text-xs">
                      needs wager
                    </Badge>
                  </div>
                )}
              </div>
              <div className="space-y-1 p-3">
                <div className="font-mono text-xs text-muted-foreground">{c.coin_id}</div>
                <div className="font-semibold">
                  {c.year}
                  {c.mint_mark ? ` ${c.mint_mark}` : ""}
                  {c.variety_code ? ` · ${c.variety_code}` : ""}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {c.predicted_grade_hand ? (
                      <span className="font-mono text-foreground">
                        wager {c.predicted_grade_hand}
                      </span>
                    ) : (
                      <span className="italic">no wager</span>
                    )}
                  </span>
                  {c.actual_grade && (
                    <span className="font-mono font-semibold text-green-700 dark:text-green-400">
                      {c.actual_grade}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedCoinId && (
        <CoinDetailSheet
          coinId={selectedCoinId}
          onClose={() => setSelectedCoinId(null)}
          onUpdated={refresh}
        />
      )}
    </div>
  )
}
