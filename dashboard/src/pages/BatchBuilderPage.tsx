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
import {
  listBatches,
  createBatch,
  addCoinsToBatch,
  removeCoinsFromBatch,
  listCoinsFiltered,
  calculateFees,
  validateBatch,
  downloadBatchCsv,
  deleteBatch,
  shipBatch,
  markBatchAtGrader,
  receiveBatch,
  type Batch,
  type Coin,
  type FeeBreakdown,
} from "@/lib/api"
import { Download, FileCheck2, Package, PackageCheck, Plus, Send, Trash2, X } from "lucide-react"
import { formatDate } from "@/lib/date"

function formatCoin(c: Coin): string {
  const parts = [c.coin_id, `${c.year}${c.mint_mark ? " " + c.mint_mark : ""}`]
  if (c.variety_code) parts.push(c.variety_code)
  if (c.predicted_grade_hand) parts.push(`(wager ${c.predicted_grade_hand})`)
  return parts.join(" · ")
}

export default function BatchBuilderPage() {
  const [batches, setBatches] = useState<Batch[]>([])
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null)
  const [staged, setStaged] = useState<Coin[]>([])
  const [batchCoins, setBatchCoins] = useState<Coin[]>([])
  const [fees, setFees] = useState<FeeBreakdown | null>(null)
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[] } | null>(null)
  const [newBatchName, setNewBatchName] = useState("")
  const [newBatchGrader, setNewBatchGrader] = useState("NGC")
  const [loading, setLoading] = useState(false)

  async function refreshBatches() {
    const list = await listBatches()
    setBatches(list)
    if (selectedBatchId === null && list.length > 0) {
      setSelectedBatchId(list[0].batch_id)
    }
  }

  async function refreshStaged() {
    const list = await listCoinsFiltered({ submission_status: "staged", limit: 500 })
    setStaged(list)
  }

  async function refreshBatchCoins(batchId: number) {
    const list = await listCoinsFiltered({ batch_id: batchId, limit: 500 })
    setBatchCoins(list)
    if (list.length > 0) {
      const breakdown = await calculateFees(
        list.map((c) => c.coin_id),
        batches.find((b) => b.batch_id === batchId)?.grader || "NGC",
      )
      setFees(breakdown)
    } else {
      setFees(null)
    }
  }

  useEffect(() => {
    refreshBatches()
    refreshStaged()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (selectedBatchId !== null) {
      refreshBatchCoins(selectedBatchId)
      setValidation(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBatchId, batches.length])

  const selectedBatch = useMemo(
    () => batches.find((b) => b.batch_id === selectedBatchId) || null,
    [batches, selectedBatchId],
  )

  async function handleCreateBatch() {
    if (!newBatchName.trim()) {
      toast.error("Batch name required")
      return
    }
    setLoading(true)
    try {
      const b = await createBatch({ name: newBatchName.trim(), grader: newBatchGrader })
      setNewBatchName("")
      await refreshBatches()
      setSelectedBatchId(b.batch_id)
      toast.success(`Batch "${b.name}" created`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(coinId: string) {
    if (!selectedBatchId) {
      toast.error("Select or create a batch first")
      return
    }
    if (batchCoins.length >= 50) {
      toast.error("Batch full (50-coin NGC limit)")
      return
    }
    setLoading(true)
    try {
      await addCoinsToBatch(selectedBatchId, [coinId])
      await Promise.all([refreshStaged(), refreshBatchCoins(selectedBatchId), refreshBatches()])
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleRemove(coinId: string) {
    if (!selectedBatchId) return
    setLoading(true)
    try {
      await removeCoinsFromBatch(selectedBatchId, [coinId])
      await Promise.all([refreshStaged(), refreshBatchCoins(selectedBatchId), refreshBatches()])
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleValidate() {
    if (!selectedBatchId) return
    setLoading(true)
    try {
      const result = await validateBatch(selectedBatchId)
      setValidation({ valid: result.valid, errors: result.errors })
      if (result.valid) {
        toast.success("Batch valid: ready to export")
      } else {
        toast.error(`${result.errors.length} validation error(s)`)
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleExport() {
    if (!selectedBatchId) return
    try {
      await downloadBatchCsv(selectedBatchId)
      toast.success("CSV downloaded")
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  async function handleDeleteBatch() {
    if (!selectedBatchId) return
    if (!confirm(`Delete batch "${selectedBatch?.name}"? Coins return to staged.`)) return
    try {
      await deleteBatch(selectedBatchId)
      setSelectedBatchId(null)
      await Promise.all([refreshBatches(), refreshStaged()])
      toast.success("Batch deleted")
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const missingWager = batchCoins.filter((c) => !c.predicted_grade_hand).length
  const capacity = selectedBatch ? 50 - batchCoins.length : 0

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Batch Builder</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr,1.2fr]">
        {/* Left: staged coins */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Staged Coins</span>
              <Badge variant="secondary">{staged.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {staged.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No staged coins. Catalogue coins and set wagers to stage them.
              </p>
            ) : (
              <div className="space-y-2">
                {staged.map((c) => (
                  <div
                    key={c.coin_id}
                    className="flex items-center justify-between rounded-md border border-border bg-card p-3 text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs text-muted-foreground">{c.coin_id}</div>
                      <div>{formatCoin(c)}</div>
                      {!c.predicted_grade_hand && (
                        <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                          No wager set
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!selectedBatchId || loading || capacity <= 0}
                      onClick={() => handleAdd(c.coin_id)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: batch panel */}
        <div className="space-y-4">
          {/* Batch selector / create */}
          <Card>
            <CardHeader>
              <CardTitle>Batches</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Select
                  value={selectedBatchId !== null ? String(selectedBatchId) : ""}
                  onValueChange={(v) => setSelectedBatchId(v ? Number(v) : null)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a batch" />
                  </SelectTrigger>
                  <SelectContent>
                    {batches.map((b) => (
                      <SelectItem key={b.batch_id} value={String(b.batch_id)}>
                        {b.name} ({b.grader}, {b.coin_count} coins)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedBatchId && (
                  <Button variant="ghost" size="sm" onClick={handleDeleteBatch}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>

              <div className="flex gap-2 border-t border-border pt-4">
                <Input
                  placeholder="New batch name"
                  value={newBatchName}
                  onChange={(e) => setNewBatchName(e.target.value)}
                />
                <Select value={newBatchGrader} onValueChange={setNewBatchGrader}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NGC">NGC</SelectItem>
                    <SelectItem value="PCGS">PCGS</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleCreateBatch} disabled={loading}>
                  Create
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Active batch contents */}
          {selectedBatch && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>
                    {selectedBatch.name} <span className="text-sm text-muted-foreground">({selectedBatch.grader})</span>
                  </span>
                  <Badge variant={capacity <= 5 ? "destructive" : "secondary"}>
                    {batchCoins.length} / 50
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {batchCoins.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Empty. Add coins from the staged list.</p>
                ) : (
                  <div className="space-y-1 max-h-96 overflow-y-auto">
                    {batchCoins.map((c, i) => (
                      <div
                        key={c.coin_id}
                        className="flex items-center gap-2 rounded border border-border p-2 text-sm"
                      >
                        <span className="w-8 text-right font-mono text-xs text-muted-foreground">
                          {i + 1}.
                        </span>
                        <span className="flex-1">{formatCoin(c)}</span>
                        {!c.predicted_grade_hand && (
                          <Badge variant="destructive" className="text-xs">
                            no wager
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemove(c.coin_id)}
                          disabled={loading}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {missingWager > 0 && (
                  <div className="rounded border border-amber-500/50 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    {missingWager} coin(s) in batch have no wager. Set wagers before shipping so the
                    scorecard can reconcile them.
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Fees */}
          {fees && (
            <Card>
              <CardHeader>
                <CardTitle>Fees ({fees.grader})</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Subtotal ({fees.coin_count} coins)</dt>
                    <dd className="font-mono">${fees.subtotal_coins}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Handling</dt>
                    <dd className="font-mono">${fees.handling_fee}</dd>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2 font-semibold">
                    <dt>Total</dt>
                    <dd className="font-mono">${fees.total}</dd>
                  </div>
                </dl>
                {fees.items.some((i) => Object.keys(i.add_ons).length > 0) && (
                  <details className="mt-3 text-xs text-muted-foreground">
                    <summary className="cursor-pointer">Per-coin breakdown</summary>
                    <ul className="mt-2 space-y-1">
                      {fees.items.map((it) => (
                        <li key={it.coin_id} className="flex justify-between">
                          <span className="font-mono">{it.coin_id}</span>
                          <span className="font-mono">${it.total}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          {selectedBatch && batchCoins.length > 0 && (
            <Card>
              <CardContent className="space-y-3 pt-6">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleValidate} disabled={loading} className="flex-1">
                    <FileCheck2 className="mr-2 h-4 w-4" />
                    Validate
                  </Button>
                  <Button onClick={handleExport} disabled={loading} className="flex-1">
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                  </Button>
                </div>

                {validation && (
                  <div
                    className={`rounded border p-3 text-sm ${
                      validation.valid
                        ? "border-green-500/50 bg-green-50 text-green-900 dark:bg-green-950/30 dark:text-green-200"
                        : "border-destructive bg-destructive/10 text-destructive"
                    }`}
                  >
                    {validation.valid ? (
                      <p>All descriptions complete. Ready to print and mail.</p>
                    ) : (
                      <ul className="list-disc space-y-1 pl-5">
                        {validation.errors.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Shipment workflow */}
          {selectedBatch && batchCoins.length > 0 && (
            <ShipmentCard
              batch={selectedBatch}
              onChanged={() => {
                refreshBatches()
                if (selectedBatchId) refreshBatchCoins(selectedBatchId)
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function ShipmentCard({ batch, onChanged }: { batch: Batch; onChanged: () => void }) {
  const [invoice, setInvoice] = useState(batch.invoice_number || "")
  const [shipDate, setShipDate] = useState(
    batch.shipped_date || new Date().toISOString().slice(0, 10),
  )
  const [returnedDate, setReturnedDate] = useState(
    batch.returned_date || new Date().toISOString().slice(0, 10),
  )
  const [busy, setBusy] = useState(false)

  const isShipped = !!batch.shipped_date
  const isReturned = !!batch.returned_date

  async function handleShip() {
    if (!invoice.trim()) {
      toast.error("Invoice number required")
      return
    }
    setBusy(true)
    try {
      await shipBatch(batch.batch_id, { invoice_number: invoice.trim(), ship_date: shipDate })
      toast.success("Batch marked shipped")
      onChanged()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleAtGrader() {
    setBusy(true)
    try {
      await markBatchAtGrader(batch.batch_id)
      toast.success("Batch marked at grader")
      onChanged()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleReceive() {
    setBusy(true)
    try {
      await receiveBatch(batch.batch_id, { returned_date: returnedDate })
      toast.success("Batch received. Reconcile coins individually.")
      onChanged()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shipment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-xs">
          <Phase label="Staged" active={!isShipped} done={isShipped} />
          <span className="text-muted-foreground">→</span>
          <Phase label="Shipped" active={isShipped && !isReturned} done={isReturned} />
          <span className="text-muted-foreground">→</span>
          <Phase label="Returned" active={isReturned} done={isReturned} />
        </div>

        {!isShipped ? (
          <div className="space-y-3">
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <Label className="text-xs">Invoice number</Label>
                <Input
                  value={invoice}
                  onChange={(e) => setInvoice(e.target.value)}
                  placeholder="NGC invoice # once confirmed"
                />
              </div>
              <div>
                <Label className="text-xs">Ship date</Label>
                <Input type="date" value={shipDate} onChange={(e) => setShipDate(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleShip} disabled={busy}>
              <Send className="mr-2 h-4 w-4" />
              Mark shipped
            </Button>
          </div>
        ) : (
          <dl className="grid grid-cols-2 gap-1 text-sm">
            <dt className="text-muted-foreground">Invoice</dt>
            <dd className="font-mono">{batch.invoice_number}</dd>
            <dt className="text-muted-foreground">Shipped</dt>
            <dd className="font-mono">{formatDate(batch.shipped_date)}</dd>
            {batch.returned_date && (
              <>
                <dt className="text-muted-foreground">Returned</dt>
                <dd className="font-mono">{formatDate(batch.returned_date)}</dd>
              </>
            )}
          </dl>
        )}

        {isShipped && !isReturned && (
          <div className="space-y-3 border-t border-border pt-3">
            <Button variant="outline" onClick={handleAtGrader} disabled={busy}>
              <Package className="mr-2 h-4 w-4" />
              Mark at grader
            </Button>
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <Label className="text-xs">Returned date</Label>
                <Input
                  type="date"
                  value={returnedDate}
                  onChange={(e) => setReturnedDate(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleReceive} disabled={busy} className="w-full">
                  <PackageCheck className="mr-2 h-4 w-4" />
                  Mark returned
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Phase({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 ${
        active
          ? "bg-primary text-primary-foreground"
          : done
            ? "bg-green-100 text-green-900 dark:bg-green-950/40 dark:text-green-200"
            : "bg-muted text-muted-foreground"
      }`}
    >
      {label}
    </span>
  )
}
