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

// Variety autocomplete
export async function autocompleteVariety(q: string, denomination?: string, year?: number) {
  const params = new URLSearchParams({ q })
  if (denomination) params.set("denomination", denomination)
  if (year) params.set("year", String(year))
  return request<{ variety_code: string; official_name: string | null; grader: string }[]>(
    `/varieties/autocomplete?${params}`,
  )
}
