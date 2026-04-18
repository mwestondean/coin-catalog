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
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import GradeCombobox from "@/components/GradeCombobox"
import {
  getCoin,
  updateCoin,
  setWager,
  reconcileCoin,
  deleteCoin,
  uploadImages,
  type Coin,
} from "@/lib/api"
import { PROBLEM_FLAGS } from "@/lib/sheldon"
import {
  Check,
  Coins as CoinsIcon,
  Lock,
  Pencil,
  Trash2,
  Upload,
  X,
} from "lucide-react"

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

  const refresh = () => {
    load()
    onUpdated()
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] w-[92vw] max-w-6xl sm:max-w-6xl overflow-y-auto p-0">
        {loading || !coin ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div>
            {/* Header */}
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-4">
              <span className="font-mono text-lg font-semibold">{coin.coin_id}</span>
              <Badge variant="secondary">{coin.submission_status.replace("_", " ")}</Badge>
              {coin.predicted_grade_hand && (
                <Badge className="gap-1">
                  <Lock className="h-3 w-3" />
                  wager {coin.predicted_grade_hand}
                </Badge>
              )}
              {coin.actual_grade && (
                <Badge className="gap-1 bg-green-600 hover:bg-green-600">
                  graded {coin.actual_grade}
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">
                {coin.year}
                {coin.mint_mark ? ` ${coin.mint_mark}` : ""}
                {coin.km_number ? ` · KM ${coin.km_number}` : ""}
                {coin.variety_code ? ` · ${coin.variety_code}` : ""}
              </span>
            </div>

            {/* Body */}
            <div className="space-y-4 p-6">
              <ImagesSection coin={coin} onUpdated={refresh} />

              <WagerSection coin={coin} onUpdated={refresh} />

              <DetailsSection
                coin={coin}
                editMode={editMode}
                onToggleEdit={() => setEditMode((v) => !v)}
                onSaved={() => {
                  setEditMode(false)
                  refresh()
                }}
              />

              <SubmissionSection coin={coin} onUpdated={refresh} />
            </div>

            <div className="flex items-center justify-between border-t border-border px-6 py-3">
              <Button variant="ghost" size="sm" onClick={handleDelete}>
                <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                Delete coin
              </Button>
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// -------------- Images --------------
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
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4 md:max-w-2xl">
        <ImageSlot
          side="Obverse"
          existing={coin.obverse_image_path ? `/api/images/${coin.coin_id}_O${getExt(coin.obverse_image_path)}` : null}
          thumb={coin.obverse_image_path ? `/api/images/thumbs/${coin.coin_id}_O.jpg` : null}
          onSelect={setObverseFile}
          selected={obverse}
        />
        <ImageSlot
          side="Reverse"
          existing={coin.reverse_image_path ? `/api/images/${coin.coin_id}_R${getExt(coin.reverse_image_path)}` : null}
          thumb={coin.reverse_image_path ? `/api/images/thumbs/${coin.coin_id}_R.jpg` : null}
          onSelect={setReverseFile}
          selected={reverse}
        />
      </div>
      {(obverse || reverse) && (
        <Button size="sm" onClick={handleUpload} disabled={uploading}>
          <Upload className="mr-2 h-4 w-4" />
          {uploading ? "Uploading..." : "Save new images"}
        </Button>
      )}
    </div>
  )
}

function getExt(path: string): string {
  const m = path.match(/\.[^.]+$/)
  return m ? m[0] : ".jpg"
}

function ImageSlot({
  side,
  existing,
  thumb,
  onSelect,
  selected,
}: {
  side: string
  existing: string | null
  thumb: string | null
  onSelect: (f: File | null) => void
  selected: File | null
}) {
  // Use full-res image for detail view, not the 200px thumbnail.
  // Falls back to thumb if full-path encoding goes wrong.
  const preview = selected ? URL.createObjectURL(selected) : existing || thumb
  const [lightbox, setLightbox] = useState(false)

  return (
    <div>
      <Label className="text-xs">{side}</Label>
      <div className="relative aspect-square overflow-hidden rounded border border-border bg-muted">
        {preview ? (
          <button
            type="button"
            onClick={() => existing && setLightbox(true)}
            className="block h-full w-full cursor-zoom-in"
          >
            <img
              src={preview}
              alt={side}
              className="h-full w-full object-cover"
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement
                if (thumb && img.src !== thumb) img.src = thumb
                else img.style.display = "none"
              }}
            />
          </button>
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
        className="mt-2 h-8 text-xs"
      />

      {lightbox && existing && (
        <div
          role="dialog"
          onClick={() => setLightbox(false)}
          className="fixed inset-0 z-[100] flex cursor-zoom-out items-center justify-center bg-black/90 p-8"
        >
          <img
            src={existing}
            alt={side}
            className="max-h-full max-w-full rounded shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setLightbox(false)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  )
}

// -------------- Wager --------------
function WagerSection({ coin, onUpdated }: { coin: Coin; onUpdated: () => void }) {
  const [grade, setGrade] = useState("")
  const [details, setDetails] = useState(false)
  const [confidence, setConfidence] = useState("medium")
  const [saving, setSaving] = useState(false)

  if (coin.predicted_grade_hand) {
    return (
      <Section title="Wager (locked)" icon={<Lock className="h-4 w-4" />}>
        <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-sm">
          <InfoBlock label="Grade" value={coin.predicted_grade_hand} mono />
          <InfoBlock label="Details flag" value={coin.predicted_details_hand ? "Yes" : "No"} />
          <InfoBlock label="Confidence" value={coin.confidence_hand || "—"} />
        </div>
      </Section>
    )
  }

  async function handleSave() {
    if (!grade) {
      toast.error("Pick a grade")
      return
    }
    setSaving(true)
    try {
      await setWager(coin.coin_id, {
        predicted_grade_hand: grade,
        predicted_details_hand: details,
        confidence_hand: confidence,
      })
      toast.success("Wager locked")
      onUpdated()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section
      title="Set wager"
      hint="Immutable once saved"
      className="border-primary/50 bg-primary/5"
    >
      <div className="grid gap-3 md:grid-cols-[1fr,140px,auto,auto]">
        <div>
          <Label className="text-xs">Grade</Label>
          <GradeCombobox value={grade} onChange={setGrade} autoFocus />
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
        <label className="flex cursor-pointer items-end gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={details}
            onChange={(e) => setDetails(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Details
        </label>
        <div className="flex items-end">
          <Button size="sm" onClick={handleSave} disabled={saving || !grade}>
            <Lock className="mr-2 h-4 w-4" />
            Lock
          </Button>
        </div>
      </div>
    </Section>
  )
}

// -------------- Details --------------
function DetailsSection({
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
    <Section
      title="Details"
      actions={
        <Button size="sm" variant="ghost" onClick={onToggleEdit}>
          {editMode ? <X className="mr-1 h-3 w-3" /> : <Pencil className="mr-1 h-3 w-3" />}
          {editMode ? "Cancel" : "Edit"}
        </Button>
      }
    >
      {!editMode ? (
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-3">
          <InfoBlock label="Denomination" value={coin.denomination} mono />
          <InfoBlock label="Year" value={coin.year} mono />
          <InfoBlock label="Mint mark" value={coin.mint_mark} mono />
          <InfoBlock label="KM #" value={coin.km_number} mono />
          <InfoBlock label="Variety" value={coin.variety_code} mono />
          <InfoBlock label="Source" value={coin.source} />
          <InfoBlock label="Paid" value={coin.paid_usd ? `$${coin.paid_usd}` : null} mono />
          <InfoBlock label="Acquired" value={coin.acquisition_date} mono />
          <InfoBlock label="Raw estimate" value={coin.raw_grade_estimate} mono />
          <InfoBlock
            label="Problem flags"
            value={coin.problem_flags.length > 0 ? coin.problem_flags.join(", ") : "none"}
          />
          <InfoBlock label="Details risk" value={coin.details_risk ? "Yes" : "No"} />
          <InfoBlock label="Added" value={new Date(coin.date_added).toLocaleDateString()} />
          {coin.notes && (
            <div className="col-span-full">
              <div className="text-xs text-muted-foreground">Notes</div>
              <div className="whitespace-pre-wrap text-sm">{coin.notes}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label className="text-xs">Mint mark</Label>
            <Input value={mintMark} onChange={(e) => setMintMark(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">KM #</Label>
            <Input value={kmNumber} onChange={(e) => setKmNumber(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Variety</Label>
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
            <GradeCombobox value={rawEstimate} onChange={setRawEstimate} placeholder="(none)" />
          </div>
          <div className="md:col-span-3">
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
          <div className="md:col-span-3">
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
          <div className="md:col-span-3">
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <div className="md:col-span-3">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Check className="mr-2 h-4 w-4" />
              Save
            </Button>
          </div>
        </div>
      )}
    </Section>
  )
}

// -------------- Submission --------------
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
    <Section title="Submission">
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-4">
        <InfoBlock label="Grader" value={coin.grader} />
        <InfoBlock label="Tier" value={coin.tier} />
        <InfoBlock label="Batch" value={coin.batch_id !== null ? `#${coin.batch_id}` : null} />
        <InfoBlock label="Invoice" value={coin.submission_invoice_number} mono />
        <InfoBlock label="Ship date" value={coin.ship_date} mono />
        <InfoBlock label="Cert #" value={coin.cert_number} mono />
        <InfoBlock label="Actual grade" value={coin.actual_grade} mono />
        <InfoBlock label="Actual details" value={coin.actual_details} />
      </div>

      {canReconcile && (
        <div className="mt-4 rounded border border-primary/40 bg-primary/5 p-3">
          <div className="text-sm font-semibold">Record graded return</div>
          <div className="mt-2 grid gap-2 md:grid-cols-[1fr,1fr,1fr,auto]">
            <div>
              <Label className="text-xs">Cert number</Label>
              <Input value={certNumber} onChange={(e) => setCertNumber(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Actual grade</Label>
              <GradeCombobox value={actualGrade} onChange={setActualGrade} />
            </div>
            <div>
              <Label className="text-xs">Details (optional)</Label>
              <Input
                value={actualDetails}
                onChange={(e) => setActualDetailsValue(e.target.value)}
                placeholder="e.g. Cleaned"
              />
            </div>
            <div className="flex items-end">
              <Button size="sm" onClick={handleReconcile} disabled={saving}>
                Reconcile
              </Button>
            </div>
          </div>
        </div>
      )}
    </Section>
  )
}

// -------------- Helpers --------------
function Section({
  title,
  hint,
  icon,
  actions,
  children,
  className = "",
}: {
  title: string
  hint?: string
  icon?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-md border border-border p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold">{title}</h3>
          {hint && <span className="text-xs text-muted-foreground">· {hint}</span>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  )
}

function InfoBlock({
  label,
  value,
  mono,
}: {
  label: string
  value: string | number | null | undefined
  mono?: boolean
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-sm ${mono ? "font-mono" : ""}`}>{value || "—"}</div>
    </div>
  )
}
