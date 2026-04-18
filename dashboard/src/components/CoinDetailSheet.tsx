import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getCoin,
  updateCoin,
  setWager,
  reconcileCoin,
  deleteCoin,
  uploadImages,
  type Coin,
} from "@/lib/api"
import { SHELDON_GRADES, PROBLEM_FLAGS } from "@/lib/sheldon"
import { Check, Coins as CoinsIcon, Lock, Trash2 } from "lucide-react"

interface Props {
  coinId: string
  onClose: () => void
  onUpdated: () => void
}

export default function CoinDetailSheet({ coinId, onClose, onUpdated }: Props) {
  const [coin, setCoin] = useState<Coin | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const c = await getCoin(coinId)
      setCoin(c)
    } catch (e: any) {
      toast.error(e.message)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coinId])

  async function handleDelete() {
    if (!coin) return
    if (!confirm(`Delete ${coin.coin_id}? This is permanent.`)) return
    try {
      await deleteCoin(coin.coin_id)
      toast.success(`${coin.coin_id} deleted`)
      onUpdated()
      onClose()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {loading || !coin ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <span className="font-mono">{coin.coin_id}</span>
                <Badge variant="secondary">{coin.submission_status.replace("_", " ")}</Badge>
                {coin.predicted_grade_hand && (
                  <Badge className="gap-1">
                    <Lock className="h-3 w-3" />
                    {coin.predicted_grade_hand}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                {coin.year}
                {coin.mint_mark ? ` ${coin.mint_mark}` : ""}
                {coin.variety_code ? ` · ${coin.variety_code}` : ""}
              </DialogDescription>
            </DialogHeader>

            {/* Images */}
            <ImagesSection coin={coin} onUpdated={load} />

            {/* Wager section */}
            <WagerSection coin={coin} onUpdated={() => {
              load()
              onUpdated()
            }} />

            {/* Objective fields */}
            <ObjectiveFieldsSection
              coin={coin}
              editMode={editMode}
              onToggleEdit={() => setEditMode((v) => !v)}
              onSaved={() => {
                setEditMode(false)
                load()
                onUpdated()
              }}
            />

            {/* Submission / reconcile */}
            <SubmissionSection coin={coin} onUpdated={() => {
              load()
              onUpdated()
            }} />

            {/* Danger zone */}
            <div className="flex justify-end border-t border-border pt-4">
              <Button variant="ghost" size="sm" onClick={handleDelete}>
                <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                Delete
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ImagesSection({ coin, onUpdated }: { coin: Coin; onUpdated: () => void }) {
  const [obverse, setObverseFile] = useState<File | null>(null)
  const [reverse, setReverseFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  async function handleUpload() {
    if (!obverse && !reverse) return
    setUploading(true)
    try {
      await uploadImages(coin.coin_id, obverse || undefined, reverse || undefined)
      toast.success("Images updated")
      setObverseFile(null)
      setReverseFile(null)
      onUpdated()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">Images</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <ImageSlot
          side="Obverse"
          existing={coin.obverse_image_path ? `/api/images/thumbs/${coin.coin_id}_O.jpg` : null}
          onSelect={setObverseFile}
          selected={obverse}
        />
        <ImageSlot
          side="Reverse"
          existing={coin.reverse_image_path ? `/api/images/thumbs/${coin.coin_id}_R.jpg` : null}
          onSelect={setReverseFile}
          selected={reverse}
        />
      </div>
      {(obverse || reverse) && (
        <Button size="sm" onClick={handleUpload} disabled={uploading}>
          {uploading ? "Uploading..." : "Upload new images"}
        </Button>
      )}
    </section>
  )
}

function ImageSlot({
  side,
  existing,
  onSelect,
  selected,
}: {
  side: string
  existing: string | null
  onSelect: (f: File | null) => void
  selected: File | null
}) {
  const preview = selected ? URL.createObjectURL(selected) : existing
  return (
    <div>
      <Label className="text-xs">{side}</Label>
      <div className="relative aspect-square overflow-hidden rounded border border-border bg-muted">
        {preview ? (
          <img src={preview} alt={side} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <CoinsIcon className="h-10 w-10 text-muted-foreground" />
          </div>
        )}
      </div>
      <Input
        type="file"
        accept="image/*"
        onChange={(e) => onSelect(e.target.files?.[0] || null)}
        className="mt-2 text-xs"
      />
    </div>
  )
}

function WagerSection({ coin, onUpdated }: { coin: Coin; onUpdated: () => void }) {
  const [grade, setGrade] = useState("")
  const [details, setDetails] = useState(false)
  const [confidence, setConfidence] = useState("medium")
  const [saving, setSaving] = useState(false)

  if (coin.predicted_grade_hand) {
    return (
      <section className="rounded-md border border-border bg-muted/40 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Lock className="h-4 w-4" />
          Wager locked
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Hand grade</dt>
          <dd className="font-mono">{coin.predicted_grade_hand}</dd>
          <dt className="text-muted-foreground">Details flag</dt>
          <dd>{coin.predicted_details_hand ? "Yes" : "No"}</dd>
          <dt className="text-muted-foreground">Confidence</dt>
          <dd>{coin.confidence_hand || "—"}</dd>
          <dt className="text-muted-foreground">Predicted on</dt>
          <dd>
            {coin.prediction_date_hand
              ? new Date(coin.prediction_date_hand).toLocaleDateString()
              : "—"}
          </dd>
        </dl>
      </section>
    )
  }

  async function handleSave() {
    if (!grade) {
      toast.error("Select a grade")
      return
    }
    setSaving(true)
    try {
      await setWager(coin.coin_id, {
        predicted_grade_hand: grade,
        predicted_details_hand: details,
        confidence_hand: confidence,
      })
      toast.success("Wager locked in")
      onUpdated()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-md border border-amber-500/40 bg-amber-50 p-4 dark:bg-amber-950/20">
      <h3 className="text-sm font-semibold">Set Wager</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Lock in your prediction. Immutable once saved.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div>
          <Label className="text-xs">Sheldon grade</Label>
          <Select value={grade} onValueChange={setGrade}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a grade" />
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
          <Label className="text-xs">Confidence</Label>
          <Select value={confidence} onValueChange={setConfidence}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={details}
              onChange={(e) => setDetails(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Expect details grade
          </label>
        </div>
      </div>
      <Button className="mt-3" size="sm" onClick={handleSave} disabled={saving}>
        <Lock className="mr-2 h-4 w-4" />
        Lock wager
      </Button>
    </section>
  )
}

function ObjectiveFieldsSection({
  coin,
  editMode,
  onToggleEdit,
  onSaved,
}: {
  coin: Coin
  editMode: boolean
  onToggleEdit: () => void
  onSaved: () => void
}) {
  const [mintMark, setMintMark] = useState(coin.mint_mark || "")
  const [kmNumber, setKmNumber] = useState(coin.km_number || "")
  const [varietyCode, setVarietyCode] = useState(coin.variety_code || "")
  const [source, setSource] = useState(coin.source || "")
  const [paidUsd, setPaidUsd] = useState(coin.paid_usd?.toString() || "")
  const [rawEstimate, setRawEstimate] = useState(coin.raw_grade_estimate || "")
  const [flags, setFlags] = useState<string[]>(coin.problem_flags || [])
  const [detailsRisk, setDetailsRisk] = useState(coin.details_risk)
  const [notes, setNotes] = useState(coin.notes || "")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setMintMark(coin.mint_mark || "")
    setKmNumber(coin.km_number || "")
    setVarietyCode(coin.variety_code || "")
    setSource(coin.source || "")
    setPaidUsd(coin.paid_usd?.toString() || "")
    setRawEstimate(coin.raw_grade_estimate || "")
    setFlags(coin.problem_flags || [])
    setDetailsRisk(coin.details_risk)
    setNotes(coin.notes || "")
  }, [coin])

  function toggleFlag(flag: string) {
    setFlags((prev) => {
      if (flag === "none") return prev.includes("none") ? [] : ["none"]
      const without = prev.filter((f) => f !== "none")
      return without.includes(flag) ? without.filter((f) => f !== flag) : [...without, flag]
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      await updateCoin(coin.coin_id, {
        mint_mark: mintMark || null,
        km_number: kmNumber || null,
        variety_code: varietyCode || null,
        source: source || null,
        paid_usd: paidUsd || null,
        raw_grade_estimate: rawEstimate || null,
        problem_flags: flags,
        details_risk: detailsRisk,
        notes: notes || null,
      })
      toast.success("Updated")
      onSaved()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-md border border-border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Details</h3>
        <Button size="sm" variant="ghost" onClick={onToggleEdit}>
          {editMode ? "Cancel" : "Edit"}
        </Button>
      </div>

      {!editMode ? (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm md:grid-cols-3">
          <Field label="Denomination" value={coin.denomination} />
          <Field label="Year" value={coin.year} />
          <Field label="Mint mark" value={coin.mint_mark} />
          <Field label="KM #" value={coin.km_number} />
          <Field label="Variety code" value={coin.variety_code} />
          <Field label="Source" value={coin.source} />
          <Field
            label="Paid"
            value={coin.paid_usd ? `$${coin.paid_usd}` : null}
          />
          <Field label="Acquired" value={coin.acquisition_date} />
          <Field label="Raw estimate" value={coin.raw_grade_estimate} />
          <Field
            label="Problem flags"
            value={coin.problem_flags.length > 0 ? coin.problem_flags.join(", ") : "none"}
          />
          <Field label="Details risk" value={coin.details_risk ? "Yes" : "No"} />
          <Field
            label="Added"
            value={new Date(coin.date_added).toLocaleDateString()}
          />
          {coin.notes && (
            <div className="col-span-full mt-2">
              <dt className="text-xs text-muted-foreground">Notes</dt>
              <dd className="whitespace-pre-wrap text-sm">{coin.notes}</dd>
            </div>
          )}
        </dl>
      ) : (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <Label className="text-xs">Mint mark</Label>
            <Input value={mintMark} onChange={(e) => setMintMark(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">KM number</Label>
            <Input value={kmNumber} onChange={(e) => setKmNumber(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Variety code</Label>
            <Input value={varietyCode} onChange={(e) => setVarietyCode(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Source</Label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Paid USD</Label>
            <Input
              type="number"
              step="0.01"
              value={paidUsd}
              onChange={(e) => setPaidUsd(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Raw estimate</Label>
            <Select value={rawEstimate} onValueChange={setRawEstimate}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">(none)</SelectItem>
                {SHELDON_GRADES.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Problem flags</Label>
            <div className="flex flex-wrap gap-2">
              {PROBLEM_FLAGS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => toggleFlag(f)}
                  className={`rounded border px-2 py-1 text-xs ${
                    flags.includes(f)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={detailsRisk}
                onChange={(e) => setDetailsRisk(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              High risk of a Details designation
            </label>
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <div className="md:col-span-2">
            <Button onClick={handleSave} disabled={saving}>
              <Check className="mr-2 h-4 w-4" />
              Save changes
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-mono text-sm">{value || "—"}</dd>
    </>
  )
}

function SubmissionSection({ coin, onUpdated }: { coin: Coin; onUpdated: () => void }) {
  const [certNumber, setCertNumber] = useState("")
  const [actualGrade, setActualGrade] = useState("")
  const [actualDetails, setActualDetailsValue] = useState("")
  const [saving, setSaving] = useState(false)

  const canReconcile =
    ["on_form", "shipped", "at_grader"].includes(coin.submission_status) && !coin.actual_grade

  async function handleReconcile() {
    if (!certNumber.trim() || !actualGrade) {
      toast.error("Cert and grade required")
      return
    }
    setSaving(true)
    try {
      await reconcileCoin(coin.coin_id, {
        cert_number: certNumber.trim(),
        actual_grade: actualGrade,
        actual_details: actualDetails.trim() || null,
      })
      toast.success("Reconciled")
      onUpdated()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-md border border-border p-4">
      <h3 className="text-sm font-semibold">Submission</h3>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm md:grid-cols-3">
        <Field label="Status" value={coin.submission_status.replace("_", " ")} />
        <Field label="Grader" value={coin.grader} />
        <Field label="Tier" value={coin.tier} />
        <Field label="Batch" value={coin.batch_id !== null ? `#${coin.batch_id}` : null} />
        <Field label="Invoice #" value={coin.submission_invoice_number} />
        <Field label="Ship date" value={coin.ship_date} />
        <Field label="Cert #" value={coin.cert_number} />
        <Field label="Actual grade" value={coin.actual_grade} />
        <Field label="Actual details" value={coin.actual_details} />
      </dl>

      {canReconcile && (
        <div className="mt-4 rounded border border-amber-500/40 bg-amber-50 p-3 dark:bg-amber-950/20">
          <h4 className="text-sm font-semibold">Record graded return</h4>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            <div>
              <Label className="text-xs">Cert number</Label>
              <Input value={certNumber} onChange={(e) => setCertNumber(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Actual grade</Label>
              <Select value={actualGrade} onValueChange={setActualGrade}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick" />
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
              <Label className="text-xs">Details designation (optional)</Label>
              <Input
                value={actualDetails}
                onChange={(e) => setActualDetailsValue(e.target.value)}
                placeholder="e.g. Cleaned"
              />
            </div>
          </div>
          <Button className="mt-3" size="sm" onClick={handleReconcile} disabled={saving}>
            Reconcile
          </Button>
        </div>
      )}
    </section>
  )
}
