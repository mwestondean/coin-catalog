const API_BASE = "/api"

function getToken(): string | null {
  return localStorage.getItem("coin_token")
}

export function setToken(token: string) {
  localStorage.setItem("coin_token", token)
}

export function clearToken() {
  localStorage.removeItem("coin_token")
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  // Only set Content-Type for non-FormData bodies
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json"
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (res.status === 401) {
    clearToken()
    window.location.href = "/login"
    throw new Error("Unauthorized")
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || "Request failed")
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

// Auth
export async function login(username: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
  })
  if (!res.ok) throw new Error("Invalid username or password")
  const data = await res.json()
  setToken(data.access_token)
  return data
}

export async function getMe() {
  return request<{ user_id: number; username: string; role: string }>("/auth/me")
}

// Coins
export interface Coin {
  coin_id: string
  denomination: string
  date_added: string
  year: number
  mint_mark: string | null
  km_number: string | null
  variety_code: string | null
  variety_attribution_source: string | null
  ngc_variety_attribution: string | null
  pcgs_variety_attribution: string | null
  source: string | null
  acquisition_date: string | null
  paid_usd: string | null
  raw_grade_estimate: string | null
  problem_flags: string[]
  details_risk: boolean
  obverse_image_path: string | null
  reverse_image_path: string | null
  image_capture_date: string | null
  predicted_grade_hand: string | null
  predicted_details_hand: boolean | null
  confidence_hand: string | null
  prediction_date_hand: string | null
  predicted_grade_screen: string | null
  predicted_details_screen: boolean | null
  prediction_date_screen: string | null
  grader: string
  submission_status: string
  tier: string | null
  declared_value_usd: string | null
  variety_plus_requested: boolean
  submission_invoice_number: string | null
  line_number_on_form: number | null
  ship_date: string | null
  cert_number: string | null
  actual_grade: string | null
  actual_details: string | null
  return_date: string | null
  ngc_pop_at_submission: number | null
  pcgs_pop_at_submission: number | null
  notes: string | null
  registry_set_id: string | null
  batch_id: number | null
}

export interface CoinCreate {
  denomination: string
  year: number
  mint_mark?: string
  km_number?: string
  variety_code?: string
  variety_attribution_source?: string
  source?: string
  acquisition_date?: string
  paid_usd?: number
  raw_grade_estimate?: string
  problem_flags?: string[]
  details_risk?: boolean
  notes?: string
}

export interface CoinWager {
  predicted_grade_hand: string
  predicted_details_hand?: boolean
  confidence_hand: string
  raw_grade_estimate?: string
  details_risk?: boolean
}

export async function createCoin(data: CoinCreate) {
  return request<Coin>("/coins/", { method: "POST", body: JSON.stringify(data) })
}

export async function updateCoin(coinId: string, data: Partial<CoinCreate> & Record<string, any>) {
  return request<Coin>(`/coins/${coinId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export async function deleteCoin(coinId: string) {
  return request<void>(`/coins/${coinId}`, { method: "DELETE" })
}

export async function setWager(coinId: string, data: CoinWager) {
  return request<Coin>(`/coins/${coinId}/wager`, { method: "POST", body: JSON.stringify(data) })
}

export async function listCoins(params?: Record<string, string>) {
  const qs = params ? "?" + new URLSearchParams(params).toString() : ""
  return request<Coin[]>(`/coins/${qs}`)
}

export async function getCoin(coinId: string) {
  return request<Coin>(`/coins/${coinId}`)
}

export async function uploadImages(coinId: string, obverse?: File, reverse?: File) {
  const form = new FormData()
  if (obverse) form.append("obverse", obverse)
  if (reverse) form.append("reverse", reverse)
  return request<{ coin_id: string; uploaded: Record<string, string> }>(
    `/images/${coinId}`,
    { method: "POST", body: form },
  )
}

// Review / notifications
export async function getPendingReview(limit = 10) {
  return request<Coin[]>(`/coins/pending-review?limit=${limit}`)
}

export async function getPendingReviewCount() {
  return request<{ count: number }>("/coins/pending-review/count")
}

export async function markReviewed(coinId: string) {
  return request<Coin>(`/coins/${coinId}/mark-reviewed`, { method: "POST" })
}

export async function markAllReviewed() {
  return request<{ marked: number }>("/coins/mark-all-reviewed", { method: "POST" })
}

// Variety autocomplete
export async function autocompleteVariety(q: string, denomination?: string, year?: number) {
  const params = new URLSearchParams({ q })
  if (denomination) params.set("denomination", denomination)
  if (year) params.set("year", String(year))
  return request<{ variety_code: string; official_name: string | null; grader: string }[]>(
    `/varieties/autocomplete?${params}`,
  )
}

// Filtered coin queries
export async function listCoinsFiltered(filters: {
  submission_status?: string
  batch_id?: number
  limit?: number
}) {
  const params = new URLSearchParams()
  if (filters.submission_status) params.set("submission_status", filters.submission_status)
  if (filters.batch_id !== undefined) params.set("batch_id", String(filters.batch_id))
  if (filters.limit) params.set("limit", String(filters.limit))
  return request<Coin[]>(`/coins/?${params}`)
}

// Batches
export interface Batch {
  batch_id: number
  name: string
  grader: string
  created_date: string
  shipped_date: string | null
  returned_date: string | null
  invoice_number: string | null
  coin_count: number
}

export async function listBatches() {
  return request<Batch[]>("/batches/")
}

export async function createBatch(data: { name: string; grader: string }) {
  return request<Batch>("/batches/", { method: "POST", body: JSON.stringify(data) })
}

export async function getBatch(batchId: number) {
  return request<Batch>(`/batches/${batchId}`)
}

export async function addCoinsToBatch(batchId: number, coinIds: string[]) {
  return request<Batch>(`/batches/${batchId}/add-coins`, {
    method: "POST",
    body: JSON.stringify(coinIds),
  })
}

export async function removeCoinsFromBatch(batchId: number, coinIds: string[]) {
  return request<Batch>(`/batches/${batchId}/remove-coins`, {
    method: "POST",
    body: JSON.stringify(coinIds),
  })
}

export async function updateBatch(
  batchId: number,
  data: Partial<{ name: string; shipped_date: string; returned_date: string; invoice_number: string }>,
) {
  return request<Batch>(`/batches/${batchId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export async function deleteBatch(batchId: number) {
  return request<void>(`/batches/${batchId}`, { method: "DELETE" })
}

export async function shipBatch(batchId: number, data: { invoice_number: string; ship_date?: string }) {
  return request<Batch>(`/batches/${batchId}/ship`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function markBatchAtGrader(batchId: number) {
  return request<Batch>(`/batches/${batchId}/mark-at-grader`, { method: "POST" })
}

export async function receiveBatch(batchId: number, data: { returned_date?: string } = {}) {
  return request<Batch>(`/batches/${batchId}/receive`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

// Grading / fees
export interface FeeItem {
  coin_id: string
  tier: string
  base_fee: string
  add_ons: Record<string, string>
  total: string
}

export interface FeeBreakdown {
  grader: string
  coin_count: number
  handling_fee: string
  subtotal_coins: string
  total: string
  items: FeeItem[]
}

export async function calculateFees(coinIds: string[], grader = "NGC") {
  const params = new URLSearchParams({ grader_name: grader })
  return request<FeeBreakdown>(`/grading/fees?${params}`, {
    method: "POST",
    body: JSON.stringify(coinIds),
  })
}

export interface ValidationResult {
  batch_id: number
  grader: string
  coin_count: number
  valid: boolean
  errors: string[]
}

export async function validateBatch(batchId: number) {
  return request<ValidationResult>(`/grading/validate-batch/${batchId}`, { method: "POST" })
}

export async function downloadBatchCsv(batchId: number) {
  const token = localStorage.getItem("coin_token")
  const res = await fetch(`${API_BASE}/grading/export-csv/${batchId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Export failed: ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `batch_${batchId}_submission.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// Reconciliation
export interface CoinReconcile {
  cert_number: string
  actual_grade: string
  actual_details?: string | null
  return_date?: string | null
}

export async function reconcileCoin(coinId: string, data: CoinReconcile) {
  return request<Coin>(`/coins/${coinId}/reconcile`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}
