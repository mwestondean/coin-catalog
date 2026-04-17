import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { listCoinsFiltered, reconcileCoin, type Coin } from "@/lib/api"
import { SHELDON_GRADES, SHELDON_SHORT } from "@/lib/sheldon"
import { Check } from "lucide-react"

/**
 * Grade distance: index delta on the Sheldon scale. Supports both long (AU-55) and
 * short (AU55) storage forms. Returns null if either side can't be located.
 */
function gradeDistance(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null
  const ia = SHELDON_GRADES.indexOf(a as (typeof SHELDON_GRADES)[number])
  const sa = ia === -1 ? SHELDON_SHORT.indexOf(a) : ia
  const ib = SHELDON_GRADES.indexOf(b as (typeof SHELDON_GRADES)[number])
  const sb = ib === -1 ? SHELDON_SHORT.indexOf(b) : ib
  if (sa === -1 || sb === -1) return null
  return Math.abs(sa - sb)
}

function hitLabel(distance: number | null): { label: string; tone: string } {
  if (distance === null) return { label: "?", tone: "text-muted-foreground" }
  if (distance === 0) return { label: "Exact", tone: "text-green-600 dark:text-green-400" }
  if (distance === 1) return { label: "Within 1", tone: "text-lime-600 dark:text-lime-400" }
  if (distance === 2) return { label: "Within 2", tone: "text-amber-600 dark:text-amber-400" }
  return { label: `Miss (${distance})`, tone: "text-destructive" }
}

export default function ReconciliationPage() {
  const [pending, setPending] = useState<Coin[]>([])
  const [reconciled, setReconciled] = useState<Coin[]>([])
  const [selectedCoinId, setSelectedCoinId] = useState<string>("")
  const [certNumber, setCertNumber] = useState("")
  const [actualGrade, setActualGrade] = useState("")
  const [actualDetails, setActualDetails] = useState("")
  const [saving, setSaving] = useState(false)

  async function refresh() {
    const [onForm, shipped, atGrader, returned] = await Promise.all([
      listCoinsFiltered({ submission_status: "on_form", limit: 500 }),
      listCoinsFiltered({ submission_status: "shipped", limit: 500 }),
      listCoinsFiltered({ submission_status: "at_grader", limit: 500 }),
      listCoinsFiltered({ submission_status: "returned", limit: 500 }),
    ])
    setPending([...onForm, ...shipped, ...atGrader].filter((c) => !c.actual_grade))
    setReconciled(returned.filter((c) => c.actual_grade))
  }

  useEffect(() => {
    refresh()
  }, [])

  const selectedCoin = useMemo(
    () => pending.find((c) => c.coin_id === selectedCoinId) || null,
    [pending, selectedCoinId],
  )

  async function handleReconcile(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCoin || !certNumber.trim() || !actualGrade) {
      toast.error("Coin, cert number, and actual grade required")
      return
    }
    setSaving(true)
    try {
      await reconcileCoin(selectedCoin.coin_id, {
        cert_number: certNumber.trim(),
        actual_grade: actualGrade,
        actual_details: actualDetails.trim() || null,
      })
      toast.success(`${selectedCoin.coin_id} reconciled as ${actualGrade}`)
      setSelectedCoinId("")
      setCertNumber("")
      setActualGrade("")
      setActualDetails("")
      await refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const scorecard = useMemo(() => {
    const withWager = reconciled.filter((c) => c.predicted_grade_hand && c.actual_grade)
    const total = withWager.length
    if (total === 0) {
      return null
    }

    let exact = 0
    let within1 = 0
    let within2 = 0
    let misses = 0
    let distanceSum = 0
    let distanceN = 0

    for (const c of withWager) {
      const d = gradeDistance(c.predicted_grade_hand, c.actual_grade)
      if (d === null) continue
      distanceSum += d
      distanceN += 1
      if (d === 0) exact += 1
      else if (d === 1) within1 += 1
      else if (d === 2) within2 += 1
      else misses += 1
    }

    const byConfidence: Record<string, { n: number; exact: number }> = {}
    for (const c of withWager) {
      const conf = c.confidence_hand || "unknown"
      if (!byConfidence[conf]) byConfidence[conf] = { n: 0, exact: 0 }
      byConfidence[conf].n += 1
      const d = gradeDistance(c.predicted_grade_hand, c.actual_grade)
      if (d === 0) byConfidence[conf].exact += 1
    }

    const detailsPredicted = withWager.filter((c) => c.predicted_details_hand).length
    const detailsActual = withWager.filter((c) => c.actual_details).length
    const detailsCorrect = withWager.filter(
      (c) => !!c.predicted_details_hand === !!c.actual_details,
    ).length

    return {
      total,
      exact,
      within1,
      within2,
      misses,
      avgDistance: distanceN > 0 ? distanceSum / distanceN : 0,
      byConfidence,
      detailsPredicted,
      detailsActual,
      detailsAccuracy: total > 0 ? (detailsCorrect / total) * 100 : 0,
    }
  }, [reconciled])

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Reconciliation</h1>

      {/* Reconcile form */}
      <Card>
        <CardHeader>
          <CardTitle>Record a Graded Return</CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No coins awaiting reconciliation. Ship a batch to NGC first.
            </p>
          ) : (
            <form onSubmit={handleReconcile} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Coin</Label>
                  <Select value={selectedCoinId} onValueChange={setSelectedCoinId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a shipped coin" />
                    </SelectTrigger>
                    <SelectContent>
                      {pending.map((c) => (
                        <SelectItem key={c.coin_id} value={c.coin_id}>
                          {c.coin_id} · {c.year}
                          {c.mint_mark ? " " + c.mint_mark : ""}
                          {c.predicted_grade_hand ? ` · wager ${c.predicted_grade_hand}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Cert number</Label>
                  <Input
                    value={certNumber}
                    onChange={(e) => setCertNumber(e.target.value)}
                    placeholder="e.g. 1234567-001"
                    required
                  />
                </div>
                <div>
                  <Label>Actual grade</Label>
                  <Select value={actualGrade} onValueChange={setActualGrade}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sheldon grade" />
                    </SelectTrigger>
                    <SelectContent>
                      {SHELDON_GRADES.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Details designation (optional)</Label>
                  <Input
                    value={actualDetails}
                    onChange={(e) => setActualDetails(e.target.value)}
                    placeholder="e.g. Cleaned, Scratch"
                  />
                </div>
              </div>

              {selectedCoin && selectedCoin.predicted_grade_hand && actualGrade && (
                <div className="rounded border border-border bg-muted p-3 text-sm">
                  Wager: <span className="font-mono">{selectedCoin.predicted_grade_hand}</span>
                  {" → "}
                  Actual: <span className="font-mono">{actualGrade}</span>
                  {" = "}
                  <span
                    className={
                      hitLabel(gradeDistance(selectedCoin.predicted_grade_hand, actualGrade)).tone
                    }
                  >
                    {hitLabel(gradeDistance(selectedCoin.predicted_grade_hand, actualGrade)).label}
                  </span>
                </div>
              )}

              <Button type="submit" disabled={saving}>
                <Check className="mr-2 h-4 w-4" />
                Reconcile
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Scorecard */}
      <Card>
        <CardHeader>
          <CardTitle>Wager Scorecard</CardTitle>
        </CardHeader>
        <CardContent>
          {!scorecard ? (
            <p className="text-sm text-muted-foreground">
              No reconciled coins yet with wagers. Scorecard populates once returns are recorded.
            </p>
          ) : (
            <div className="space-y-6">
              {/* Headline stats */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <Stat label="Reconciled" value={String(scorecard.total)} />
                <Stat
                  label="Exact"
                  value={`${scorecard.exact} (${pct(scorecard.exact, scorecard.total)}%)`}
                  tone="text-green-600 dark:text-green-400"
                />
                <Stat
                  label="Within 1"
                  value={`${scorecard.within1} (${pct(scorecard.within1, scorecard.total)}%)`}
                />
                <Stat
                  label="Within 2"
                  value={`${scorecard.within2} (${pct(scorecard.within2, scorecard.total)}%)`}
                />
                <Stat
                  label="Misses"
                  value={`${scorecard.misses} (${pct(scorecard.misses, scorecard.total)}%)`}
                  tone="text-destructive"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Stat
                  label="Avg miss distance"
                  value={scorecard.avgDistance.toFixed(2) + " pts"}
                />
                <Stat
                  label="Details flag accuracy"
                  value={scorecard.detailsAccuracy.toFixed(0) + "%"}
                />
              </div>

              {/* By confidence */}
              <div>
                <h3 className="mb-2 text-sm font-semibold">By confidence level</h3>
                <div className="space-y-1">
                  {Object.entries(scorecard.byConfidence).map(([conf, v]) => (
                    <div
                      key={conf}
                      className="flex items-center justify-between rounded border border-border bg-card p-2 text-sm"
                    >
                      <Badge variant="outline">{conf}</Badge>
                      <span className="text-muted-foreground">
                        {v.n} wagers · {v.exact} exact ({pct(v.exact, v.n)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Individual log */}
              <div>
                <h3 className="mb-2 text-sm font-semibold">Reconciled coins</h3>
                <div className="max-h-80 space-y-1 overflow-y-auto">
                  {reconciled.map((c) => {
                    const d = gradeDistance(c.predicted_grade_hand, c.actual_grade)
                    const hit = hitLabel(d)
                    return (
                      <div
                        key={c.coin_id}
                        className="flex items-center justify-between rounded border border-border p-2 text-xs"
                      >
                        <span className="font-mono">{c.coin_id}</span>
                        <span>
                          <span className="text-muted-foreground">wager </span>
                          <span className="font-mono">{c.predicted_grade_hand || "—"}</span>
                          <span className="text-muted-foreground"> → </span>
                          <span className="font-mono">{c.actual_grade}</span>
                        </span>
                        <span className={hit.tone}>{hit.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded border border-border bg-card p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${tone || ""}`}>{value}</div>
    </div>
  )
}

function pct(n: number, d: number): number {
  if (d === 0) return 0
  return Math.round((n / d) * 100)
}
