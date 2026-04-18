import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { listBatches, listCoinsFiltered, type Batch, type Coin } from "@/lib/api"
import { Camera, Coins as CoinsIcon, LayoutGrid, PackageCheck, Package, ScrollText } from "lucide-react"
import { SHELDON_GRADES, SHELDON_SHORT } from "@/lib/sheldon"

function gradeDistance(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null
  const ia = SHELDON_GRADES.indexOf(a as (typeof SHELDON_GRADES)[number])
  const sa = ia === -1 ? SHELDON_SHORT.indexOf(a) : ia
  const ib = SHELDON_GRADES.indexOf(b as (typeof SHELDON_GRADES)[number])
  const sb = ib === -1 ? SHELDON_SHORT.indexOf(b) : ib
  if (sa === -1 || sb === -1) return null
  return Math.abs(sa - sb)
}

export default function DashboardPage() {
  const [coins, setCoins] = useState<Coin[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [allCoins, allBatches] = await Promise.all([
          listCoinsFiltered({ limit: 500 }),
          listBatches(),
        ])
        setCoins(allCoins)
        setBatches(allBatches)
      } catch (e: any) {
        toast.error(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const staged = coins.filter((c) => c.submission_status === "staged")
  const needsWager = coins.filter((c) => !c.predicted_grade_hand)
  const inTransit = coins.filter((c) =>
    ["shipped", "at_grader", "on_form"].includes(c.submission_status),
  )
  const reconciled = coins.filter((c) => c.actual_grade)
  const exactHits = reconciled.filter(
    (c) => gradeDistance(c.predicted_grade_hand, c.actual_grade) === 0,
  ).length
  const hitRate = reconciled.length > 0 ? Math.round((exactHits / reconciled.length) * 100) : 0

  const activeBatches = batches.filter((b) => !b.returned_date)
  const recent = coins.slice(0, 5)

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-6">
          {/* Stat strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard label="Total coins" value={coins.length} />
            <StatCard
              label="Need wager"
              value={needsWager.length}
              tone={needsWager.length > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
            />
            <StatCard label="Staged" value={staged.length} />
            <StatCard label="In transit" value={inTransit.length} />
            <StatCard
              label="Hit rate"
              value={reconciled.length > 0 ? `${hitRate}%` : "—"}
              hint={reconciled.length > 0 ? `${exactHits}/${reconciled.length} exact` : "no returns yet"}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
            {/* Quick actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick actions</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <QuickLink to="/" icon={Camera} label="Add coin" />
                <QuickLink to="/collection" icon={LayoutGrid} label="Collection" />
                <QuickLink to="/batches" icon={Package} label="Batches" />
                <QuickLink to="/reconcile" icon={PackageCheck} label="Reconcile" />
              </CardContent>
            </Card>

            {/* Active batches */}
            <Card>
              <CardHeader>
                <CardTitle>Active batches</CardTitle>
              </CardHeader>
              <CardContent>
                {activeBatches.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No active batches. Stage coins then build one.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {activeBatches.map((b) => (
                      <Link
                        key={b.batch_id}
                        to="/batches"
                        className="flex items-center justify-between rounded border border-border p-2 text-sm hover:border-primary"
                      >
                        <div>
                          <div className="font-semibold">{b.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {b.grader} · {b.coin_count} coins
                          </div>
                        </div>
                        <Badge variant="secondary">
                          {b.shipped_date ? "Shipped" : "Draft"}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent additions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Recent additions</span>
                <Button size="sm" variant="ghost" asChild>
                  <Link to="/collection">View all</Link>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Your collection is empty. Add your first coin.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                  {recent.map((c) => (
                    <Link
                      key={c.coin_id}
                      to="/collection"
                      className="group overflow-hidden rounded border border-border"
                    >
                      <div className="aspect-square bg-muted">
                        {c.obverse_image_path ? (
                          <img
                            src={`/api/images/thumbs/${c.coin_id}_O.jpg`}
                            alt={c.coin_id}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              ;(e.currentTarget as HTMLImageElement).style.display = "none"
                            }}
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <CoinsIcon className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <div className="truncate font-mono text-xs text-muted-foreground">
                          {c.coin_id}
                        </div>
                        <div className="text-xs">
                          {c.year}
                          {c.mint_mark ? ` ${c.mint_mark}` : ""}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: number | string
  hint?: string
  tone?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${tone || ""}`}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}

function QuickLink({
  to,
  icon: Icon,
  label,
}: {
  to: string
  icon: typeof ScrollText
  label: string
}) {
  return (
    <Button variant="outline" asChild className="h-auto justify-start py-4">
      <Link to={to}>
        <Icon className="mr-3 h-5 w-5" />
        <span className="text-base">{label}</span>
      </Link>
    </Button>
  )
}
