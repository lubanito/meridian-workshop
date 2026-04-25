<template>
  <div class="view-container">
    <div class="page-header">
      <h2>{{ t('restocking.title') }}</h2>
      <p>{{ t('restocking.description') }}</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card danger">
        <div class="stat-label">{{ t('restocking.belowReorderPoint') }}</div>
        <div class="stat-value">{{ belowReorderCount }}</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-label">{{ t('restocking.increasingDemand') }}</div>
        <div class="stat-value">{{ increasingDemandCount }}</div>
      </div>
      <div class="stat-card info">
        <div class="stat-label">{{ t('restocking.totalCandidates') }}</div>
        <div class="stat-value">{{ sortedRecommendations.length }}</div>
      </div>
      <div class="stat-card" :class="isOverBudget ? 'danger' : 'success'">
        <div class="stat-label">{{ t('restocking.budgetUtilization') }}</div>
        <div class="stat-value">{{ budgetPercent }}%</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">{{ t('restocking.budgetCeiling') }}</span>
      </div>
      <div class="budget-input-row">
        <label for="budget-input" class="budget-label">{{ t('restocking.budgetLabel') }}</label>
        <input
          id="budget-input"
          v-model.number="budgetCeiling"
          type="number"
          min="0"
          step="1000"
          class="budget-input"
          @blur="normalizeBudget"
        />
      </div>
    </div>

    <div v-if="loading" class="loading">{{ t('common.loading') }}</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else-if="sortedRecommendations.length === 0" class="empty-state">
      {{ t('restocking.noRecommendations') }}
    </div>
    <template v-else>
      <div class="card">
        <div class="card-header">
          <span class="card-title">{{ t('restocking.table.title') }}</span>
          <span class="result-count">{{ sortedRecommendations.length }} {{ t('restocking.items') }}</span>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>{{ t('restocking.table.priority') }}</th>
                <th>{{ t('inventory.table.sku') }}</th>
                <th>{{ t('restocking.table.name') }}</th>
                <th>{{ t('restocking.table.category') }}</th>
                <th>{{ t('restocking.table.onHand') }}</th>
                <th>{{ t('restocking.table.reorderPoint') }}</th>
                <th>{{ t('restocking.table.demandForecast') }}</th>
                <th>{{ t('restocking.table.qtyToOrder') }}</th>
                <th>{{ t('restocking.table.unitCost') }}</th>
                <th>{{ t('restocking.table.estCost') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in sortedRecommendations"
                :key="item.sku"
                :class="{ 'row-over-budget': overBudgetSkus.has(item.sku) }"
              >
                <td>
                  <span class="badge" :class="item.priority.toLowerCase()">
                    {{ t(`priority.${item.priority.toLowerCase()}`) }}
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
                    :value="editedQtys[item.sku]"
                    type="number"
                    min="0"
                    class="qty-input"
                    @input="updateQty(item.sku, $event.target.value)"
                  />
                </td>
                <td>{{ formatCurrency(item.unit_cost) }}</td>
                <td>
                  <span class="est-cost">{{ formatCurrency(editedQtys[item.sku] * item.unit_cost) }}</span>
                  <span v-if="overBudgetSkus.has(item.sku)" class="badge danger over-budget-badge">{{ t('restocking.overBudget') }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card budget-summary-card">
        <div class="budget-summary-header">
          <span class="budget-summary-text">
            {{ t('restocking.summary.totalSelected') }}
            <strong>{{ formatCurrency(totalSelected) }}</strong>
            {{ t('restocking.summary.of') }}
            <strong>{{ formatCurrency(budgetCeiling) }}</strong>
            {{ t('restocking.summary.budget') }} ({{ budgetPercent }}%)
          </span>
          <span v-if="isOverBudget" class="badge danger">{{ t('restocking.summary.overBudget') }}</span>
        </div>
        <div v-if="isOverBudget" class="within-budget-hint">
          {{ t('restocking.summary.withinBudgetHint', { amount: formatCurrency(totalWithinBudget) }) }}
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
        <button class="btn-primary" @click="previewDraftPOs">
          {{ t('restocking.generatePO') }}
        </button>
        <span class="draft-hint">{{ t('restocking.draftHint') }}</span>
      </div>

      <div v-if="emptySelectionNotice" class="empty-selection-notice">
        {{ t('restocking.noItemsSelected') }}
      </div>

      <div v-if="successMessage" ref="successAlertRef" class="success-alert">
        <strong>{{ t('restocking.successMessage') }}</strong>
        <ul>
          <li v-for="item in confirmedItems" :key="item.sku">
            {{ item.sku }} — {{ item.name }}: {{ item.qty_to_order.toLocaleString() }} {{ t('purchaseOrder.units') }} @ {{ formatCurrency(item.unit_cost) }} = {{ formatCurrency(item.qty_to_order * item.unit_cost) }}
          </li>
        </ul>
        <div class="success-total">
          {{ t('restocking.summary.total') }} <strong>{{ formatCurrency(confirmedTotal) }}</strong>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { useFilters } from '../composables/useFilters'
import { useI18n } from '../composables/useI18n'
import { api } from '../api'

// Default budget ceiling shown the first time a user opens the page; the
// input is editable so this is just an opinionated starting point.
const DEFAULT_BUDGET = 50_000

export default {
  name: 'Restocking',
  setup() {
    const { selectedLocation, selectedCategory, getCurrentFilters } = useFilters()
    const { t, formatCurrency } = useI18n()

    const inventory = ref([])
    const demandForecasts = ref([])
    const loading = ref(true)
    const error = ref(null)
    const budgetCeiling = ref(DEFAULT_BUDGET)

    // The number input's `min="0"` is a hint, not a constraint — users can
    // still type "-100", and v-model.number leaves the ref as NaN while
    // the input is mid-edit. Normalise eagerly so downstream computeds
    // (overBudgetSkus, budgetPercent) never see NaN or negatives.
    const normalizeBudget = () => {
      if (!(budgetCeiling.value > 0)) budgetCeiling.value = 0
    }
    watch(budgetCeiling, (val) => {
      if (Number.isNaN(val) || val < 0) budgetCeiling.value = 0
    })
    const successMessage = ref(false)
    const emptySelectionNotice = ref(false)
    let emptyNoticeTimer = null
    const confirmedItems = ref([])
    const confirmedTotal = ref(0)
    const successAlertRef = ref(null)
    const editedQtys = ref({})

    const loadData = async () => {
      loading.value = true
      error.value = null
      successMessage.value = false
      try {
        const filters = getCurrentFilters()
        // Demand forecasts are global (per-SKU, not per-warehouse), so we
        // skip the filter pass-through. The inventory filter narrows which
        // SKUs end up in `recommendations`; the demand map is keyed by SKU
        // and only the relevant entries are read downstream.
        const [invData, demandData] = await Promise.all([
          api.getInventory(filters),
          api.getDemandForecasts()
        ])
        inventory.value = invData
        demandForecasts.value = demandData
      } catch {
        error.value = t('common.errorLoadingData')
      } finally {
        loading.value = false
      }
    }

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

        // After the guard above, at least one signal is true — only High and
        // Medium are reachable. Items not flagged on either signal are skipped.
        const priority = isBelowReorder && isIncreasing ? 'High' : 'Medium'

        // Heuristic: target stock = 2× reorder point. Doubling provides a
        // simple safety margin above the trip-point so the next reorder
        // isn't immediately due. If forecasted demand is higher, override
        // to cover that instead — never order less than what's predicted.
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
          priority
        })
      }
      return results
    })

    // Coerce + floor at 0 + truncate to whole units in one place rather
    // than inline in the template, so the rule is grep-able and
    // unit-testable. POs are placed in whole units; fractional qty
    // would also confuse the unit_cost × qty multiplication downstream.
    const updateQty = (sku, raw) => {
      editedQtys.value[sku] = Math.max(0, Math.floor(Number(raw) || 0))
    }

    // Keep editedQtys in sync with recommendations. If the user has already
    // edited a qty for an SKU that's still present after the new fetch
    // (e.g. they typed a number, then changed a filter that excludes/includes
    // the same SKU), preserve the edit. Only seed from the recommendation's
    // default for SKUs we haven't seen yet.
    watch(recommendations, (newRecs) => {
      const next = {}
      for (const item of newRecs) {
        next[item.sku] = editedQtys.value[item.sku] ?? item.recommended_qty
      }
      editedQtys.value = next
    }, { immediate: true })

    const sortedRecommendations = computed(() => {
      // recommendations only ever assigns High or Medium (the !isBelowReorder
      // && !isIncreasing case is filtered out earlier), so Low is unused here.
      // Sort is intentionally cost-independent so the row a buyer is
      // typing into can't move while they edit. Cost is rendered as a
      // read-only column for context.
      const priorityOrder = { High: 0, Medium: 1 }
      return [...recommendations.value].sort((a, b) => {
        const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
        if (pDiff !== 0) return pDiff
        return a.sku.localeCompare(b.sku)
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

    // Total of every line the buyer has requested (qty > 0), including
    // over-budget rows. The "Over budget" per-row badge is informational —
    // it does not auto-exclude the row from the draft, so this number
    // intentionally matches what previewDraftPOs would submit.
    // Walks sortedRecommendations so it iterates the same list overBudgetSkus
    // walks, keeping the budget bar and per-row badges consistent.
    const totalSelected = computed(() =>
      sortedRecommendations.value.reduce((sum, item) => {
        const qty = editedQtys.value[item.sku] ?? 0
        return sum + qty * item.unit_cost
      }, 0)
    )

    const budgetPercent = computed(() => {
      // Use !(> 0) to handle NaN from partially-typed negative input
      if (!(budgetCeiling.value > 0)) return 0
      return Math.round((totalSelected.value / budgetCeiling.value) * 100)
    })

    const isOverBudget = computed(() => totalSelected.value > budgetCeiling.value)

    const progressBarWidth = computed(() => Math.min(budgetPercent.value, 100))

    // Walk recommendations top-to-bottom; flag any SKU whose cost would push
    // the cumulative total over the ceiling. Skips zero-quantity rows so the
    // running total only advances on real picks.
    //
    // This is intentionally NOT a knapsack/bin-packing optimiser — a large
    // High-priority row that doesn't fit will leave room for smaller
    // following items, which can look like wasted budget. The buyer
    // controls the trade-off by editing qty (or zeroing out the oversized
    // row). totalWithinBudget reflects the sum that *currently* fits given
    // the user's picks, not a packing-optimal value.
    const overBudgetSkus = computed(() => {
      if (budgetCeiling.value <= 0) return new Set()
      const skus = new Set()
      let running = 0
      for (const rec of sortedRecommendations.value) {
        const qty = editedQtys.value[rec.sku] ?? 0
        const cost = qty * rec.unit_cost
        if (cost <= 0) continue
        if (running + cost > budgetCeiling.value) {
          skus.add(rec.sku)
        } else {
          running += cost
        }
      }
      return skus
    })

    // Sum excluding rows the over-budget walk has flagged — i.e. what would
    // fit within the ceiling. Defined after overBudgetSkus so the dependency
    // reads top-to-bottom for a future maintainer.
    const totalWithinBudget = computed(() =>
      sortedRecommendations.value.reduce((sum, item) => {
        if (overBudgetSkus.value.has(item.sku)) return sum
        const qty = editedQtys.value[item.sku] ?? 0
        return sum + qty * item.unit_cost
      }, 0)
    )

    // Draft-only preview: the button labelled "Preview Draft" assembles a
    // local summary so a buyer can review picks against the budget. Real
    // submission would post each line to POST /api/purchase-orders, but that
    // endpoint expects a backlog_item_id and these recommendations come from
    // inventory + demand, not the backlog — so we keep this in-memory and
    // surface a "not yet submitted" banner.
    const previewDraftPOs = async () => {
      // Walk sortedRecommendations so the draft summary matches the table
      // order the buyer is looking at, not the raw inventory order.
      const selected = sortedRecommendations.value.filter(i => (editedQtys.value[i.sku] ?? 0) > 0)
      if (selected.length === 0) {
        // Surface a transient inline notice instead of a silent no-op so
        // a user who's zeroed everything out gets feedback. Track the
        // timer so we can clear it on unmount and avoid a write on a
        // destroyed component.
        emptySelectionNotice.value = true
        successMessage.value = false
        await nextTick()
        if (emptyNoticeTimer) clearTimeout(emptyNoticeTimer)
        emptyNoticeTimer = setTimeout(() => {
          emptySelectionNotice.value = false
          emptyNoticeTimer = null
        }, 3500)
        return
      }
      if (emptyNoticeTimer) {
        clearTimeout(emptyNoticeTimer)
        emptyNoticeTimer = null
      }
      emptySelectionNotice.value = false
      confirmedItems.value = selected.map(i => ({
        ...i,
        qty_to_order: editedQtys.value[i.sku] ?? 0
      }))
      confirmedTotal.value = selected.reduce((sum, i) => sum + (editedQtys.value[i.sku] ?? 0) * i.unit_cost, 0)
      successMessage.value = true
      await nextTick()
      successAlertRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    // FilterBar is mounted globally in App.vue; selectedLocation/selectedCategory
    // are module-level refs shared with every component that calls useFilters().
    watch([selectedLocation, selectedCategory], loadData, { immediate: true })

    onUnmounted(() => {
      if (emptyNoticeTimer) clearTimeout(emptyNoticeTimer)
    })

    return {
      t,
      formatCurrency,
      loading,
      error,
      budgetCeiling,
      normalizeBudget,
      editedQtys,
      updateQty,
      sortedRecommendations,
      belowReorderCount,
      increasingDemandCount,
      totalSelected,
      totalWithinBudget,
      budgetPercent,
      isOverBudget,
      progressBarWidth,
      overBudgetSkus,
      previewDraftPOs,
      successMessage,
      emptySelectionNotice,
      successAlertRef,
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

.within-budget-hint {
  font-size: 0.813rem;
  color: var(--color-text-muted);
  margin-bottom: 0.5rem;
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
  display: flex;
  align-items: center;
  gap: 0.875rem;
}

.draft-hint {
  font-size: 0.813rem;
  color: var(--color-text-muted);
  font-style: italic;
}

.empty-selection-notice {
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-left: 4px solid var(--color-accent);
  color: var(--color-text-body);
  padding: 0.75rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
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

/* Draft-state alert (amber, not green) — the action is a preview, not a real submission */
.success-alert {
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-left: 4px solid #d97706;
  color: #78350f;
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
  background: rgba(217, 119, 6, 0.15);
  border-color: #d97706;
  color: #fcd34d;
}
</style>
