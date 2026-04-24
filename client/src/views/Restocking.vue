<template>
  <div class="view-container">
    <div class="page-header">
      <h2>Restocking Recommendations</h2>
      <p>Purchase order recommendations based on current stock levels and demand forecasts.</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card danger">
        <div class="stat-label">Below Reorder Point</div>
        <div class="stat-value">{{ belowReorderCount }}</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-label">Increasing Demand</div>
        <div class="stat-value">{{ increasingDemandCount }}</div>
      </div>
      <div class="stat-card info">
        <div class="stat-label">Total Candidates</div>
        <div class="stat-value">{{ sortedRecommendations.length }}</div>
      </div>
      <div class="stat-card" :class="isOverBudget ? 'danger' : 'success'">
        <div class="stat-label">Budget Utilization</div>
        <div class="stat-value">{{ budgetPercent }}%</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">Budget Ceiling</span>
      </div>
      <div class="budget-input-row">
        <label for="budget-input" class="budget-label">Budget ceiling ($)</label>
        <input
          id="budget-input"
          v-model.number="budgetCeiling"
          type="number"
          min="0"
          step="1000"
          class="budget-input"
        />
      </div>
    </div>

    <div v-if="loading" class="loading">Loading recommendations...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <template v-else>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Recommended Purchase Orders</span>
          <span class="result-count">{{ sortedRecommendations.length }} items</span>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Priority</th>
                <th>SKU</th>
                <th>Name</th>
                <th>Category</th>
                <th>On Hand</th>
                <th>Reorder Point</th>
                <th>Demand Forecast</th>
                <th>Qty to Order</th>
                <th>Unit Cost</th>
                <th>Est. Cost</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in sortedRecommendations"
                :key="item.sku"
                :class="{ 'row-over-budget': isItemOverRemainingBudget(item) }"
              >
                <td>
                  <span class="badge" :class="item.priority.toLowerCase()">
                    {{ item.priority }}
                  </span>
                </td>
                <td class="sku-cell">{{ item.sku }}</td>
                <td>{{ item.name }}</td>
                <td>{{ item.category }}</td>
                <td :class="{ 'text-danger': item.quantity_on_hand <= item.reorder_point }">
                  {{ item.quantity_on_hand.toLocaleString() }}
                </td>
                <td>{{ item.reorder_point.toLocaleString() }}</td>
                <td>
                  <span v-if="item.forecasted_demand !== null">{{ item.forecasted_demand.toLocaleString() }}</span>
                  <span v-else class="text-muted">—</span>
                </td>
                <td>
                  <input
                    v-model.number="item.qty_to_order"
                    type="number"
                    min="0"
                    class="qty-input"
                    @input="clampQty(item)"
                  />
                </td>
                <td>${{ item.unit_cost.toFixed(2) }}</td>
                <td>
                  <span class="est-cost">${{ (item.qty_to_order * item.unit_cost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
                  <span v-if="isItemOverRemainingBudget(item)" class="badge danger over-budget-badge">Over budget</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card budget-summary-card">
        <div class="budget-summary-header">
          <span class="budget-summary-text">
            Total selected:
            <strong>${{ totalSelected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</strong>
            of
            <strong>${{ budgetCeiling.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }}</strong>
            budget ({{ budgetPercent }}%)
          </span>
          <span v-if="isOverBudget" class="badge danger">Over Budget</span>
        </div>
        <div class="progress-bar-track">
          <div
            class="progress-bar-fill"
            :class="{ 'progress-over': isOverBudget }"
            :style="{ width: progressBarWidth + '%' }"
          ></div>
        </div>
      </div>

      <div class="actions-row">
        <button class="btn-primary" @click="generatePurchaseOrders">
          Generate Purchase Orders
        </button>
      </div>

      <div v-if="successMessage" class="success-alert">
        <strong>Purchase orders generated successfully.</strong>
        <ul>
          <li v-for="item in confirmedItems" :key="item.sku">
            {{ item.sku }} — {{ item.name }}: {{ item.qty_to_order.toLocaleString() }} units @ ${{ item.unit_cost.toFixed(2) }} = ${{ (item.qty_to_order * item.unit_cost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
          </li>
        </ul>
        <div class="success-total">
          Total: <strong>${{ confirmedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</strong>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue'
import { useFilters } from '../composables/useFilters'
import { api } from '../api'

export default {
  name: 'Restocking',
  setup() {
    const { selectedLocation, selectedCategory, getCurrentFilters } = useFilters()

    const inventory = ref([])
    const demandForecasts = ref([])
    const loading = ref(false)
    const error = ref(null)
    const budgetCeiling = ref(50000)
    const successMessage = ref(false)
    const confirmedItems = ref([])
    const confirmedTotal = ref(0)

    const loadData = async () => {
      loading.value = true
      error.value = null
      successMessage.value = false
      try {
        const filters = getCurrentFilters()
        const [invData, demandData] = await Promise.all([
          api.getInventory(filters),
          api.getDemandForecasts()
        ])
        inventory.value = invData
        demandForecasts.value = demandData
      } catch (err) {
        error.value = 'Failed to load data. Please try again.'
        console.error(err)
      } finally {
        loading.value = false
      }
    }

    // Build demand map keyed by item_sku
    const demandMap = computed(() => {
      const map = {}
      for (const d of demandForecasts.value) {
        map[d.item_sku] = d
      }
      return map
    })

    const recommendations = computed(() => {
      const results = []
      for (const item of inventory.value) {
        const demand = demandMap.value[item.sku] || null
        const isBelowReorder = item.quantity_on_hand <= item.reorder_point
        const isIncreasing = demand && demand.trend === 'increasing'

        if (!isBelowReorder && !isIncreasing) continue

        // Determine priority
        let priority
        if (isBelowReorder && isIncreasing) {
          priority = 'High'
        } else if (isBelowReorder || isIncreasing) {
          priority = 'Medium'
        } else {
          priority = 'Low'
        }

        // Recommended quantity
        let recommended_qty = Math.max(item.reorder_point * 2 - item.quantity_on_hand, 0)
        if (demand && demand.forecasted_demand > item.quantity_on_hand) {
          recommended_qty = Math.max(recommended_qty, demand.forecasted_demand - item.quantity_on_hand)
        }

        results.push({
          sku: item.sku,
          name: item.name,
          category: item.category,
          warehouse: item.warehouse,
          quantity_on_hand: item.quantity_on_hand,
          reorder_point: item.reorder_point,
          unit_cost: item.unit_cost,
          forecasted_demand: demand ? demand.forecasted_demand : null,
          recommended_qty,
          qty_to_order: recommended_qty,
          priority,
          estimated_cost: recommended_qty * item.unit_cost
        })
      }
      return results
    })

    const sortedRecommendations = computed(() => {
      const priorityOrder = { High: 0, Medium: 1, Low: 2 }
      return [...recommendations.value].sort((a, b) => {
        const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
        if (pDiff !== 0) return pDiff
        return (b.qty_to_order * b.unit_cost) - (a.qty_to_order * a.unit_cost)
      })
    })

    const belowReorderCount = computed(() =>
      inventory.value.filter(i => i.quantity_on_hand <= i.reorder_point).length
    )

    const increasingDemandCount = computed(() => {
      const skusWithIncreasing = new Set(
        demandForecasts.value.filter(d => d.trend === 'increasing').map(d => d.item_sku)
      )
      return inventory.value.filter(i => skusWithIncreasing.has(i.sku)).length
    })

    const totalSelected = computed(() =>
      sortedRecommendations.value.reduce((sum, item) => sum + (item.qty_to_order * item.unit_cost), 0)
    )

    const budgetPercent = computed(() => {
      if (budgetCeiling.value <= 0) return 0
      return Math.round((totalSelected.value / budgetCeiling.value) * 100)
    })

    const isOverBudget = computed(() => totalSelected.value > budgetCeiling.value)

    const progressBarWidth = computed(() => Math.min(budgetPercent.value, 100))

    // Determine which items push the cumulative total over budget
    const isItemOverRemainingBudget = (item) => {
      let running = 0
      for (const rec of sortedRecommendations.value) {
        const cost = rec.qty_to_order * rec.unit_cost
        if (running + cost > budgetCeiling.value && cost > 0) {
          if (rec.sku === item.sku) return true
          // If we haven't reached this item yet but budget is already exceeded, mark it
          if (running > budgetCeiling.value) return true
        }
        running += cost
        if (rec.sku === item.sku) break
      }
      return false
    }

    const clampQty = (item) => {
      if (item.qty_to_order < 0) item.qty_to_order = 0
    }

    const generatePurchaseOrders = () => {
      const selected = sortedRecommendations.value.filter(i => i.qty_to_order > 0)
      if (selected.length === 0) return
      confirmedItems.value = selected.map(i => ({ ...i }))
      confirmedTotal.value = selected.reduce((sum, i) => sum + i.qty_to_order * i.unit_cost, 0)
      successMessage.value = true
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    }

    watch([selectedLocation, selectedCategory], () => {
      loadData()
    })

    onMounted(() => {
      loadData()
    })

    return {
      loading,
      error,
      budgetCeiling,
      sortedRecommendations,
      belowReorderCount,
      increasingDemandCount,
      totalSelected,
      budgetPercent,
      isOverBudget,
      progressBarWidth,
      isItemOverRemainingBudget,
      clampQty,
      generatePurchaseOrders,
      successMessage,
      confirmedItems,
      confirmedTotal
    }
  }
}
</script>

<style scoped>
.view-container {
  padding: 2rem;
}

.budget-input-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.budget-label {
  font-size: 0.938rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.budget-input {
  width: 200px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.938rem;
  background: var(--color-bg);
  color: var(--color-text-primary);
}

.budget-input:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.result-count {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  font-weight: 500;
}

.sku-cell {
  font-family: 'Courier New', monospace;
  font-size: 0.813rem;
  color: var(--color-text-secondary);
}

.text-danger {
  color: #dc2626;
  font-weight: 600;
}

.text-muted {
  color: var(--color-text-muted);
}

.qty-input {
  width: 80px;
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 0.875rem;
  background: var(--color-bg);
  color: var(--color-text-primary);
  text-align: right;
}

.qty-input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.est-cost {
  font-weight: 600;
  color: var(--color-text-heading);
}

.over-budget-badge {
  margin-left: 0.5rem;
  font-size: 0.688rem;
}

.row-over-budget {
  background: #fff7f7;
}

[data-theme="dark"] .row-over-budget {
  background: rgba(220, 38, 38, 0.08);
}

.budget-summary-card {
  margin-top: 0;
}

.budget-summary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.budget-summary-text {
  font-size: 0.938rem;
  color: var(--color-text-body);
}

.progress-bar-track {
  height: 10px;
  background: var(--color-bg-subtle);
  border-radius: 99px;
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.progress-bar-fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: 99px;
  transition: width 0.3s ease, background 0.3s ease;
}

.progress-bar-fill.progress-over {
  background: #dc2626;
}

.actions-row {
  margin-bottom: 1.25rem;
}

.btn-primary {
  padding: 0.625rem 1.5rem;
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.938rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
}

.btn-primary:hover {
  background: #1d4ed8;
}

.success-alert {
  background: #d1fae5;
  border: 1px solid #6ee7b7;
  color: #065f46;
  padding: 1.25rem 1.5rem;
  border-radius: 8px;
  margin-bottom: 1.25rem;
}

.success-alert ul {
  margin: 0.75rem 0 0.75rem 1.25rem;
  font-size: 0.875rem;
  line-height: 1.8;
}

.success-total {
  font-size: 0.938rem;
  margin-top: 0.5rem;
}

[data-theme="dark"] .success-alert {
  background: rgba(5, 150, 105, 0.15);
  border-color: #059669;
  color: #6ee7b7;
}
</style>
