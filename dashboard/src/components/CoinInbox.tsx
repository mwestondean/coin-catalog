import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  getPendingReview,
  getPendingReviewCount,
  markReviewed,
  markAllReviewed,
  type Coin,
} from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Coins, Check, CheckCheck } from "lucide-react"

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function CoinInbox() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(0)
  const [coins, setCoins] = useState<Coin[]>([])

  useEffect(() => {
    refreshCount()
    const interval = setInterval(refreshCount, 30000)
    return () => clearInterval(interval)
  }, [])

  async function refreshCount() {
    try {
      const data = await getPendingReviewCount()
      setCount(data.count)
    } catch { /* ignore auth errors on mount */ }
  }

  async function handleOpen() {
    if (!open) {
      try {
        const data = await getPendingReview(10)
        setCoins(data)
      } catch { /* */ }
    }
    setOpen(!open)
  }

  async function handleMarkOne(coinId: string, e: React.MouseEvent) {
    e.stopPropagation()
    await markReviewed(coinId)
    setCoins((prev) => prev.filter((c) => c.coin_id !== coinId))
    setCount((prev) => Math.max(0, prev - 1))
  }

  async function handleMarkAll() {
    const result = await markAllReviewed()
    setCoins([])
    setCount(0)
    setOpen(false)
    void result
  }

  function handleCoinClick(coinId: string) {
    setOpen(false)
    navigate(`/review/${coinId}`)
  }

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        aria-label={`${count} coins pending review`}
      >
        <Coins className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="text-sm font-semibold">New Coins</span>
              {coins.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleMarkAll}
                >
                  <CheckCheck className="mr-1 h-3 w-3" />
                  Mark all reviewed
                </Button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {coins.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No new coins to review
                </div>
              ) : (
                coins.map((coin) => (
                  <div
                    key={coin.coin_id}
                    className="flex cursor-pointer items-center gap-3 border-b px-4 py-3 transition-colors last:border-b-0 hover:bg-accent/50"
                    onClick={() => handleCoinClick(coin.coin_id)}
                  >
                    {coin.obverse_image_path ? (
                      <img
                        src={`/api/images/thumbs/${coin.coin_id}_O.jpg`}
                        alt={coin.coin_id}
                        className="h-10 w-10 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                        <Coins className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{coin.coin_id}</span>
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {coin.predicted_grade_hand ? "Graded" : "Needs wager"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {coin.year} {coin.denomination} {coin.mint_mark || ""} · {timeAgo(coin.date_added)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleMarkOne(coin.coin_id, e)}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      title="Mark reviewed"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {count > coins.length && (
              <div className="border-t px-4 py-2 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => { setOpen(false); navigate("/review") }}
                >
                  View all {count} coins
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
