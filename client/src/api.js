import axios from 'axios'

const API_BASE_URL = 'http://localhost:8001/api'

const buildUrl = (path, params) => {
  const qs = params.toString()
  return qs ? `${API_BASE_URL}${path}?${qs}` : `${API_BASE_URL}${path}`
}

// Backend uses snake_case + boolean `completed`; the frontend uses
// camelCase `dueDate` and string `status` ('pending' | 'completed') so that
// API-backed and seeded mock tasks share one shape.
const toClientTask = (t) => ({
  ...t,
  dueDate: t.due_date ?? t.dueDate ?? null,
  status: t.completed ? 'completed' : 'pending'
})

const toServerTask = ({ title, priority, dueDate }) => ({
  title,
  priority,
  due_date: dueDate || null
})

const reportParams = (filters) => {
  const params = new URLSearchParams()
  if (filters.warehouse && filters.warehouse !== 'all') params.append('warehouse', filters.warehouse)
  if (filters.category && filters.category !== 'all') params.append('category', filters.category)
  if (filters.month && filters.month !== 'all') params.append('month', filters.month)
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
    const response = await axios.get(`${API_BASE_URL}/inventory/${id}`)
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
    const response = await axios.get(`${API_BASE_URL}/orders/${id}`)
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
    const response = await axios.get(buildUrl('/reports/quarterly', reportParams(filters)))
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
    const response = await axios.delete(`${API_BASE_URL}/tasks/${taskId}`)
    return response.data
  },

  async toggleTask(taskId) {
    const response = await axios.patch(`${API_BASE_URL}/tasks/${taskId}`)
    return toClientTask(response.data)
  },

  async createPurchaseOrder(purchaseOrderData) {
    const response = await axios.post(`${API_BASE_URL}/purchase-orders`, purchaseOrderData)
    return response.data
  },

  async getPurchaseOrderByBacklogItem(backlogItemId) {
    // The server returns the first matching PO; the create endpoint enforces
    // one-PO-per-backlog-item via a 409 guard, so this stays consistent in
    // normal usage. Bulk-imported data could violate that invariant.
    const response = await axios.get(`${API_BASE_URL}/purchase-orders/${backlogItemId}`)
    return response.data
  }
}
