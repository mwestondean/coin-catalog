import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { createCoin, uploadImages, type CoinCreate } from "@/lib/api"
import { SHELDON_GRADES, PROBLEM_FLAGS, toShort } from "@/lib/sheldon"
import { Camera, CheckCircle2, Upload } from "lucide-react"

const DENOMINATIONS = [
  { value: "20c", label: "20 Centavos" },
  { value: "10c", label: "10 Centavos" },
  { value: "50c", label: "50 Centavos" },
  { value: "un_peso", label: "Un Peso" },
  { value: "5_peso", label: "5 Pesos" },
  { value: "8_reales", label: "8 Reales" },
]

const YEARS_20C = Array.from({ length: 39 }, (_, i) => 1905 + i)

const MINT_MARKS = ["Mo", "C", "S", "Puebla", "Brigada", "Ameca", "Guerrero", "Morelos", "Toluca", "Oaxaca", "Aguas-S"]

const CONFIDENCE_LEVELS = [
  { value: "low", label: "Low", description: "Not very confident" },
  { value: "medium", label: "Medium", description: "Reasonably confident" },
  { value: "high", label: "High", description: "Very confident" },
]

interface ImageFile {
  file: File
  preview: string
}

export default function CataloguePage() {
  const [saving, setSaving] = useState(false)
  const [savedCoinId, setSavedCoinId] = useState<string | null>(null)

  // Form state
  const [denomination, setDenomination] = useState("20c")
  const [year, setYear] = useState<number | "">("")
  const [mintMark, setMintMark] = useState("")
  const [kmNumber, setKmNumber] = useState("")
  const [varietyCode, setVarietyCode] = useState("")
  const [source, setSource] = useState("")
  const [acquisitionDate, setAcquisitionDate] = useState("")
  const [paidUsd, setPaidUsd] = useState("")
  const [rawGradeEstimate, setRawGradeEstimate] = useState("")
  const [problemFlags, setProblemFlags] = useState<string[]>(["none"])
  const [detailsRisk, setDetailsRisk] = useState(false)
  const [predictedGrade, setPredictedGrade] = useState("")
  const [predictedDetails, setPredictedDetails] = useState(false)
  const [confidence, setConfidence] = useState("")
  const [grader, setGrader] = useState("Raw")
  const [declaredValue, setDeclaredValue] = useState("")
  const [varietyPlus, setVarietyPlus] = useState(false)
  const [notes, setNotes] = useState("")

  // Images
  const [obverse, setObverse] = useState<ImageFile | null>(null)
  const [reverse, setReverse] = useState<ImageFile | null>(null)

  const onDropObverse = useCallback((files: File[]) => {
    if (files[0]) {
      setObverse({ file: files[0], preview: URL.createObjectURL(files[0]) })
    }
  }, [])

  const onDropReverse = useCallback((files: File[]) => {
    if (files[0]) {
      setReverse({ file: files[0], preview: URL.createObjectURL(files[0]) })
    }
  }, [])

  const obverseDropzone = useDropzone({
    onDrop: onDropObverse,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    maxFiles: 1,
  })

  const reverseDropzone = useDropzone({
    onDrop: onDropReverse,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    maxFiles: 1,
  })

  function toggleProblemFlag(flag: string) {
    setProblemFlags((prev) => {
      if (flag === "none") return ["none"]
      const without = prev.filter((f) => f !== "none")
      if (without.includes(flag)) {
        const result = without.filter((f) => f !== flag)
        return result.length === 0 ? ["none"] : result
      }
      return [...without, flag]
    })
  }

  function resetForm() {
    setYear("")
    setMintMark("")
    setKmNumber("")
    setVarietyCode("")
    setSource("")
    setAcquisitionDate("")
    setPaidUsd("")
    setRawGradeEstimate("")
    setProblemFlags(["none"])
    setDetailsRisk(false)
    setPredictedGrade("")
    setPredictedDetails(false)
    setConfidence("")
    setGrader("Raw")
    setDeclaredValue("")
    setVarietyPlus(false)
    setNotes("")
    setObverse(null)
    setReverse(null)
    setSavedCoinId(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!year) {
      toast.error("Year is required")
      return
    }
    if (!predictedGrade) {
      toast.error("Your grade prediction (the wager) is required before saving")
      return
    }
    if (!confidence) {
      toast.error("Confidence level is required")
      return
    }

    setSaving(true)
    try {
      const data: CoinCreate = {
        denomination,
        year: Number(year),
        predicted_grade_hand: toShort(predictedGrade),
        confidence_hand: confidence,
        grader,
        problem_flags: problemFlags,
        details_risk: detailsRisk,
        predicted_details_hand: predictedDetails,
      }

      if (mintMark) data.mint_mark = mintMark
      if (kmNumber) data.km_number = kmNumber
      if (varietyCode) data.variety_code = varietyCode
      if (source) data.source = source
      if (acquisitionDate) data.acquisition_date = acquisitionDate
      if (paidUsd) data.paid_usd = Number(paidUsd)
      if (rawGradeEstimate) data.raw_grade_estimate = toShort(rawGradeEstimate)
      if (declaredValue) data.declared_value_usd = Number(declaredValue)
      if (varietyPlus) data.variety_plus_requested = true
      if (notes) data.notes = notes

      const coin = await createCoin(data)
      setSavedCoinId(coin.coin_id)

      // Upload images if present
      if (obverse || reverse) {
        await uploadImages(coin.coin_id, obverse?.file, reverse?.file)
      }

      toast.success(`Coin ${coin.coin_id} saved successfully!`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save coin")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Add a Coin</h1>
          <p className="text-muted-foreground">
            Catalogue a new coin and make your grade prediction
          </p>
        </div>
        {savedCoinId && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-2 text-green-700">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">{savedCoinId}</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Images */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Photos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label className="mb-2 block">Obverse (Front)</Label>
                <div
                  {...obverseDropzone.getRootProps()}
                  className={`flex h-48 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
                    obverseDropzone.isDragActive
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 hover:border-primary/50"
                  }`}
                >
                  <input {...obverseDropzone.getInputProps()} />
                  {obverse ? (
                    <img
                      src={obverse.preview}
                      alt="Obverse"
                      className="h-full w-full rounded-lg object-contain p-2"
                    />
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <Upload className="mx-auto mb-2 h-8 w-8" />
                      <p className="text-sm">Drop obverse photo here</p>
                      <p className="text-xs">or click to browse</p>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <Label className="mb-2 block">Reverse (Back)</Label>
                <div
                  {...reverseDropzone.getRootProps()}
                  className={`flex h-48 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
                    reverseDropzone.isDragActive
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 hover:border-primary/50"
                  }`}
                >
                  <input {...reverseDropzone.getInputProps()} />
                  {reverse ? (
                    <img
                      src={reverse.preview}
                      alt="Reverse"
                      className="h-full w-full rounded-lg object-contain p-2"
                    />
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <Upload className="mx-auto mb-2 h-8 w-8" />
                      <p className="text-sm">Drop reverse photo here</p>
                      <p className="text-xs">or click to browse</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Identity */}
        <Card>
          <CardHeader>
            <CardTitle>Coin Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Denomination</Label>
              <Select value={denomination} onValueChange={setDenomination}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DENOMINATIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Year *</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                <SelectContent>
                  {YEARS_20C.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mint Mark</Label>
              <Select value={mintMark} onValueChange={setMintMark}>
                <SelectTrigger><SelectValue placeholder="Select mint" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none_selected">None</SelectItem>
                  {MINT_MARKS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>KM Number</Label>
              <Input
                value={kmNumber}
                onChange={(e) => setKmNumber(e.target.value)}
                placeholder="e.g. KM 435"
              />
            </div>
            <div className="space-y-2">
              <Label>Variety Code</Label>
              <Input
                value={varietyCode}
                onChange={(e) => setVarietyCode(e.target.value)}
                placeholder="e.g. STR7, CRV7"
              />
            </div>
            <div className="space-y-2">
              <Label>Raw Grade Estimate</Label>
              <Select value={rawGradeEstimate} onValueChange={setRawGradeEstimate}>
                <SelectTrigger><SelectValue placeholder="Estimate" /></SelectTrigger>
                <SelectContent>
                  {SHELDON_GRADES.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Provenance */}
        <Card>
          <CardHeader>
            <CardTitle>Where Did You Get It?</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Source</Label>
              <Input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Dealer, eBay seller, show..."
              />
            </div>
            <div className="space-y-2">
              <Label>Date Acquired</Label>
              <Input
                type="date"
                value={acquisitionDate}
                onChange={(e) => setAcquisitionDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Price Paid (USD)</Label>
              <Input
                type="number"
                step="0.01"
                value={paidUsd}
                onChange={(e) => setPaidUsd(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </CardContent>
        </Card>

        {/* Condition */}
        <Card>
          <CardHeader>
            <CardTitle>Condition Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-2 block">Problem Flags</Label>
              <div className="flex flex-wrap gap-2">
                {PROBLEM_FLAGS.map((flag) => (
                  <Badge
                    key={flag}
                    variant={problemFlags.includes(flag) ? "default" : "outline"}
                    className="cursor-pointer select-none capitalize"
                    onClick={() => toggleProblemFlag(flag)}
                  >
                    {flag}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="details-risk"
                checked={detailsRisk}
                onCheckedChange={(v) => setDetailsRisk(v === true)}
              />
              <Label htmlFor="details-risk" className="cursor-pointer">
                Details grade risk (likely to receive a "Details" grade)
              </Label>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* The Wager */}
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle>Your Prediction (The Wager) *</CardTitle>
            <p className="text-sm text-muted-foreground">
              Lock in your grade prediction before submitting. This is your wager
              and cannot be changed after saving.
            </p>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Predicted Grade *</Label>
              <Select value={predictedGrade} onValueChange={setPredictedGrade}>
                <SelectTrigger><SelectValue placeholder="Your prediction" /></SelectTrigger>
                <SelectContent>
                  {SHELDON_GRADES.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Confidence *</Label>
              <Select value={confidence} onValueChange={setConfidence}>
                <SelectTrigger><SelectValue placeholder="How sure?" /></SelectTrigger>
                <SelectContent>
                  {CONFIDENCE_LEVELS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label} - {c.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end pb-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="predicted-details"
                  checked={predictedDetails}
                  onCheckedChange={(v) => setPredictedDetails(v === true)}
                />
                <Label htmlFor="predicted-details" className="cursor-pointer">
                  Predict Details grade
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submission Info */}
        <Card>
          <CardHeader>
            <CardTitle>Submission Plans</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Grading Service</Label>
              <Select value={grader} onValueChange={setGrader}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Raw">Raw (not submitting)</SelectItem>
                  <SelectItem value="NGC">NGC</SelectItem>
                  <SelectItem value="PCGS">PCGS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Declared Value (USD)</Label>
              <Input
                type="number"
                step="0.01"
                value={declaredValue}
                onChange={(e) => setDeclaredValue(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="flex items-end pb-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="variety-plus"
                  checked={varietyPlus}
                  onCheckedChange={(v) => setVarietyPlus(v === true)}
                />
                <Label htmlFor="variety-plus" className="cursor-pointer">
                  Request VarietyPlus (+$20)
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes about this coin..."
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <Button type="submit" size="lg" disabled={saving}>
            {saving ? "Saving..." : "Save Coin"}
          </Button>
          {savedCoinId && (
            <Button type="button" variant="outline" size="lg" onClick={resetForm}>
              Add Another Coin
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
