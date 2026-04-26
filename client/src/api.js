import axios from 'axios'

// Env-overridable so staging/production deployments don't silently keep
// hitting localhost. .env.example documents the expected variable.
// Surface a missing-PROD-env as an exported sentinel rather than a
// module-load throw — the entry point in main.js renders a real
// "configuration error" page using this, so a misconfigured deploy is
// diagnosable from the browser instead of a blank document with the
// trace only visible in devtools.
export const apiConfigError = (import.meta.env.PROD && !import.meta.env.VITE_API_BASE_URL)
  ? new Error(
      'VITE_API_BASE_URL is required for production builds. ' +
      'Set it at build time (see client/.env.example).'
    )
  : null
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001/api'

const buildUrl = (path, params) => {
  const qs = params.toString()
  return qs ? `${API_BASE_URL}${path}?${qs}` : `${API_BASE_URL}${path}`
}

// Backend uses snake_case + boolean `completed`; the frontend uses
// camelCase `dueDate` and string `status` ('pending' | 'completed') so that
// API-backed and seeded mock tasks share one shape.
const toClientTask = (t) => {
  // Strip the snake_case keys we're remapping so the resulting object
  // has only the camelCase frontend shape — keeping both shapes around
  // would confuse anyone debugging task state.
  const { due_date, completed, ...rest } = t
  return {
    ...rest,
    dueDate: due_date ?? t.dueDate ?? null,
    status: completed ? 'completed' : 'pending'
  }
}

const toServerTask = ({ title, priority, dueDate }) => ({
  title,
  priority,
  due_date: dueDate || null
})

// `includeMonth: false` is used for endpoints that intentionally don't
// scope by month (e.g. /reports/quarterly always covers a full quarter).
// Stripping it client-side guards against a future backend change
// silently honouring the param.
const reportParams = (filters, { includeMonth = true } = {}) => {
  const params = new URLSearchParams()
  if (filters.warehouse && filters.warehouse !== 'all') params.append('warehouse', filters.warehouse)
  if (filters.category && filters.category !== 'all') params.append('category', filters.category)
  if (includeMonth && filters.month && filters.month !== 'all') params.append('month', filters.month)
  return params
}

export const api = {
  async getInventory(filters = {}) {
    const params = new URLSearchParams()
    if (filters.warehouse && filters.warehouse !== 'all') params.append('warehouse', filters.warehouse)
    if (filters.category && filters.category !== 'all') params.append('category', filters.category)

    const response = await axios.get(buildUrl('/inventory', params))
    return response.data
  },

  async getInventoryItem(id) {
    const response = await axios.get(`${API_BASE_URL}/inventory/${encodeURIComponent(id)}`)
    return response.data
  },

  async getOrders(filters = {}) {
    const params = new URLSearchParams()
    if (filters.warehouse && filters.warehouse !== 'all') params.append('warehouse', filters.warehouse)
    if (filters.category && filters.category !== 'all') params.append('category', filters.category)
    if (filters.status && filters.status !== 'all') params.append('status', filters.status)
    if (filters.month && filters.month !== 'all') params.append('month', filters.month)

    const response = await axios.get(buildUrl('/orders', params))
    return response.data
  },

  async getOrder(id) {
    const response = await axios.get(`${API_BASE_URL}/orders/${encodeURIComponent(id)}`)
    return response.data
  },

  async getDemandForecasts() {
    const response = await axios.get(`${API_BASE_URL}/demand`)
    return response.data
  },

  async getBacklog() {
    const response = await axios.get(`${API_BASE_URL}/backlog`)
    return response.data
  },

  async getDashboardSummary(filters = {}) {
    const params = new URLSearchParams()
    if (filters.warehouse && filters.warehouse !== 'all') params.append('warehouse', filters.warehouse)
    if (filters.category && filters.category !== 'all') params.append('category', filters.category)
    if (filters.status && filters.status !== 'all') params.append('status', filters.status)
    if (filters.month && filters.month !== 'all') params.append('month', filters.month)

    const response = await axios.get(buildUrl('/dashboard/summary', params))
    return response.data
  },

  async getSpendingSummary() {
    const response = await axios.get(`${API_BASE_URL}/spending/summary`)
    return response.data
  },

  async getMonthlySpending() {
    const response = await axios.get(`${API_BASE_URL}/spending/monthly`)
    return response.data
  },

  async getCategorySpending() {
    const response = await axios.get(`${API_BASE_URL}/spending/categories`)
    return response.data
  },

  async getTransactions() {
    const response = await axios.get(`${API_BASE_URL}/spending/transactions`)
    return response.data
  },

  async getQuarterlyReports(filters = {}) {
    const response = await axios.get(buildUrl('/reports/quarterly', reportParams(filters, { includeMonth: false })))
    return response.data
  },

  async getMonthlyTrends(filters = {}) {
    const response = await axios.get(buildUrl('/reports/monthly-trends', reportParams(filters)))
    return response.data
  },

  async getTasks() {
    const response = await axios.get(`${API_BASE_URL}/tasks`)
    return response.data.map(toClientTask)
  },

  async createTask(taskData) {
    const response = await axios.post(`${API_BASE_URL}/tasks`, toServerTask(taskData))
    return toClientTask(response.data)
  },

  async deleteTask(taskId) {
    const response = await axios.delete(`${API_BASE_URL}/tasks/${encodeURIComponent(taskId)}`)
    return response.data
  },

  async toggleTask(taskId) {
    const response = await axios.patch(`${API_BASE_URL}/tasks/${encodeURIComponent(taskId)}`)
    return toClientTask(response.data)
  },

  async createPurchaseOrder(purchaseOrderData) {
    const response = await axios.post(`${API_BASE_URL}/purchase-orders`, purchaseOrderData)
    return response.data
  },

  async getPurchaseOrderByBacklogItem(backlogItemId) {
    // Nested under /api/backlog/{id}/purchase-order so the path matches
    // the resource we're addressing. The server enforces one-PO-per-
    // backlog-item via a 409 at create time, so this stays single-valued
    // in normal usage; bulk-imported data could violate that invariant.
    const response = await axios.get(`${API_BASE_URL}/backlog/${encodeURIComponent(backlogItemId)}/purchase-order`)
    return response.data
  }
}
