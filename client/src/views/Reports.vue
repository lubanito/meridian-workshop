<template>
  <div class="reports">
    <div class="page-header">
      <h2>{{ t('reports.title') }}</h2>
      <p>{{ t('reports.description') }}</p>
    </div>

    <div v-if="loading" class="loading">{{ t('common.loading') }}</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else>
      <!-- Quarterly Performance -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">{{ t('reports.quarterlyPerformance') }}</h3>
        </div>
        <div v-if="monthFilterActive" class="card-note">
          {{ t('reports.quarterlyMonthFilterNote') }}
        </div>
        <div class="table-container">
          <table class="reports-table">
            <thead>
              <tr>
                <th>{{ t('reports.table.quarter') }}</th>
                <th>{{ t('reports.table.totalOrders') }}</th>
                <th>{{ t('reports.table.totalRevenue') }}</th>
                <th>{{ t('reports.table.avgOrderValue') }}</th>
                <th>{{ t('reports.table.fulfillmentRate') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="q in quarterlyData" :key="q.quarter">
                <td><strong>{{ q.quarter }}</strong></td>
                <td>{{ q.total_orders }}</td>
                <td>{{ formatCurrency(q.total_revenue) }}</td>
                <td>{{ formatCurrency(q.avg_order_value) }}</td>
                <td>
                  <span :class="getFulfillmentClass(q.fulfillment_rate)">
                    {{ q.fulfillment_rate }}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Monthly Trends Chart -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">{{ t('reports.monthlyTrend') }}</h3>
        </div>
        <div class="chart-container">
          <!-- role="group" so the chart announces as a container with
               named children rather than a single image. Each bar gets
               its own role="img" + aria-label so a screen reader can
               read the per-month value, not just the chart title. -->
          <div class="bar-chart" role="group" :aria-label="t('reports.monthlyTrend')">
            <div v-for="month in sortedMonthlyData" :key="month.month" class="bar-wrapper">
              <div class="bar-container">
                <div
                  class="bar"
                  role="img"
                  :aria-label="`${formatMonth(month.month)}: ${formatCurrency(month.revenue)}`"
                  :style="{ height: getBarHeight(month.revenue) + 'px' }"
                  :title="formatCurrency(month.revenue)"
                ></div>
              </div>
              <div class="bar-label" aria-hidden="true">{{ formatMonth(month.month) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Month-over-Month Comparison — only meaningful when the user is
           looking at a multi-month range. With a single month selected,
           every row except the first lacks a previous-month comparator. -->
      <div v-if="!monthFilterActive" class="card">
        <div class="card-header">
          <h3 class="card-title">{{ t('reports.monthOverMonth') }}</h3>
        </div>
        <div class="table-container">
          <table class="reports-table">
            <thead>
              <tr>
                <th>{{ t('reports.table.month') }}</th>
                <th>{{ t('reports.table.orders') }}</th>
                <th>{{ t('reports.table.revenue') }}</th>
                <th>{{ t('reports.table.change') }}</th>
                <th>{{ t('reports.table.growthRate') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(month, index) in sortedMonthlyData" :key="month.month">
                <td><strong>{{ formatMonth(month.month) }}</strong></td>
                <td>{{ month.order_count }}</td>
                <td>{{ formatCurrency(month.revenue) }}</td>
                <td>
                  <span v-if="index > 0" :class="getChangeClass(month.revenue, sortedMonthlyData[index - 1].revenue)">
                    {{ getChangeValue(month.revenue, sortedMonthlyData[index - 1].revenue) }}
                  </span>
                  <span v-else>-</span>
                </td>
                <td>
                  <span v-if="index > 0" :class="getChangeClass(month.revenue, sortedMonthlyData[index - 1].revenue)">
                    {{ getGrowthRate(month.revenue, sortedMonthlyData[index - 1].revenue) }}
                  </span>
                  <span v-else>-</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Summary Stats -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">{{ t('reports.stats.totalRevenue') }}</div>
          <div class="stat-value">{{ formatCurrency(totalRevenue) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">{{ t('reports.stats.avgMonthlyRevenue') }}</div>
          <div class="stat-value">{{ formatCurrency(avgMonthlyRevenue) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">{{ t('reports.stats.totalOrders') }}</div>
          <div class="stat-value">{{ totalOrders }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">{{ t('reports.stats.bestQuarter') }}</div>
          <div class="stat-value">{{ bestQuarter }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue'
import { api } from '../api'
import { useFilters } from '../composables/useFilters'
import { useI18n } from '../composables/useI18n'

export default {
  name: 'Reports',
  setup() {
    // selectedStatus is intentionally absent: reportParams() does not send
    // status to the quarterly/monthly endpoints, so watching it would only
    // fire a redundant fetch and cause a loading flicker.
    const { selectedPeriod, selectedLocation, selectedCategory, getCurrentFilters } = useFilters()
    const { t, formatCurrency, localeTag, currentCurrency } = useI18n()

    const loading = ref(true)
    const error = ref(null)
    const quarterlyData = ref([])
    const monthlyData = ref([])

    // Sort chronologically by 'YYYY-MM' so the month-over-month delta
    // never reads from the wrong neighbour if the API ever returns the
    // months in a different order. localeCompare on YYYY-MM is correct
    // for chronological order because the format is zero-padded.
    const sortedMonthlyData = computed(() =>
      [...monthlyData.value].sort((a, b) => a.month.localeCompare(b.month))
    )

    const totalRevenue = computed(() =>
      monthlyData.value.reduce((sum, m) => sum + m.revenue, 0)
    )

    const avgMonthlyRevenue = computed(() =>
      monthlyData.value.length > 0 ? totalRevenue.value / monthlyData.value.length : 0
    )

    const totalOrders = computed(() =>
      monthlyData.value.reduce((sum, m) => sum + m.order_count, 0)
    )

    const bestQuarter = computed(() => {
      if (!quarterlyData.value.length) return '-'
      // Pass an explicit initial value so reduce can't surprise a future
      // reader who removes the early-return guard above.
      return quarterlyData.value.reduce(
        (best, q) => (q.total_revenue > best.total_revenue ? q : best),
        quarterlyData.value[0]
      ).quarter
    })

    const maxRevenue = computed(() =>
      Math.max(...monthlyData.value.map(m => m.revenue), 0)
    )

    // True only when the user picked a single-month value (YYYY-MM). The
    // quarterly endpoint intentionally ignores month-only filters to avoid
    // showing a partial quarter; this hint surfaces that asymmetry to the
    // user. The regex makes this forward-compatible with future Q*-YYYY
    // filter values — those are quarter-shaped, not month-shaped, so the
    // hint should stay hidden for them.
    const monthFilterActive = computed(() => /^\d{4}-\d{2}$/.test(selectedPeriod.value))

    // Monotonic request id — a slow earlier fetch resolving after a faster
    // later one would otherwise overwrite the user's current filter result.
    let loadId = 0

    const loadData = async () => {
      const currentId = ++loadId
      loading.value = true
      error.value = null
      try {
        const filters = getCurrentFilters()
        const [quarterly, monthly] = await Promise.all([
          api.getQuarterlyReports(filters),
          api.getMonthlyTrends(filters)
        ])
        if (currentId !== loadId) return
        quarterlyData.value = quarterly
        monthlyData.value = monthly
      } catch {
        if (currentId !== loadId) return
        error.value = t('common.errorLoadingData')
      } finally {
        if (currentId === loadId) loading.value = false
      }
    }

    watch([selectedPeriod, selectedLocation, selectedCategory], loadData, { immediate: true })

    const formatMonth = (monthStr) => {
      if (!monthStr?.includes('-')) return monthStr ?? ''
      const [year, month] = monthStr.split('-')
      const d = new Date(Number(year), Number(month) - 1, 1)
      if (isNaN(d.getTime())) return monthStr
      return new Intl.DateTimeFormat(localeTag.value, { month: 'short', year: 'numeric' }).format(d)
    }

    const getBarHeight = (revenue) => {
      if (maxRevenue.value === 0) return 0
      return (revenue / maxRevenue.value) * 200
    }

    const getFulfillmentClass = (rate) => {
      if (rate >= 90) return 'badge success'
      if (rate >= 75) return 'badge warning'
      return 'badge danger'
    }

    const getChangeValue = (current, previous) => {
      const change = current - previous
      // formatCurrency already renders the locale-appropriate minus sign
      // for negatives. Below the smallest displayable unit (JPY: 1, USD:
      // 0.01) we render formatCurrency(0) so a 0.001 delta doesn't slip
      // through as "+$0.00" — otherwise prefix '+' for positive deltas
      // and let formatCurrency render negatives natively.
      const minUnit = currentCurrency.value === 'JPY' ? 1 : 0.01
      if (Math.abs(change) < minUnit) return formatCurrency(0)
      return change > 0 ? '+' + formatCurrency(change) : formatCurrency(change)
    }

    const getChangeClass = (current, previous) => {
      const change = current - previous
      // Gate on the same minUnit threshold as getChangeValue so a sub-unit
      // delta (e.g. -0.001 USD) renders as $0.00 *without* the negative-
      // change red tint — text and color must agree on what counts as zero.
      const minUnit = currentCurrency.value === 'JPY' ? 1 : 0.01
      if (Math.abs(change) < minUnit) return ''
      if (change > 0) return 'positive-change'
      if (change < 0) return 'negative-change'
      return ''
    }

    const getGrowthRate = (current, previous) => {
      if (previous === 0) return 'N/A'
      const rate = ((current - previous) / previous) * 100
      return (rate > 0 ? '+' : '') + rate.toFixed(1) + '%'
    }

    return {
      t,
      loading, error,
      quarterlyData, monthlyData, sortedMonthlyData,
      totalRevenue, avgMonthlyRevenue, totalOrders, bestQuarter,
      monthFilterActive,
      formatCurrency, formatMonth, getBarHeight,
      getFulfillmentClass, getChangeValue, getChangeClass, getGrowthRate
    }
  }
}
</script>

<style scoped>
.reports {
  padding: 0;
}

.card {
  background: var(--color-surface);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  border: 1px solid var(--color-border);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.card-header {
  margin-bottom: 1.5rem;
}

.card-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text-heading);
  margin: 0;
}

.card-note {
  font-size: 0.813rem;
  color: var(--color-text-muted);
  font-style: italic;
  margin-bottom: 1rem;
  padding: 0.5rem 0.75rem;
  background: var(--color-bg-subtle);
  border-radius: 6px;
  border-left: 3px solid var(--color-accent);
}

.reports-table {
  width: 100%;
  border-collapse: collapse;
}

.reports-table th {
  background: var(--color-bg);
  padding: 0.75rem;
  text-align: left;
  font-weight: 600;
  color: var(--color-text-muted);
  border-bottom: 2px solid var(--color-border);
}

.reports-table td {
  padding: 0.75rem;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-body);
}

.reports-table tr:hover {
  background: var(--color-bg);
}

.chart-container {
  padding: 2rem 1rem;
  min-height: 300px;
}

.bar-chart {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  height: 250px;
  gap: 0.5rem;
}

.bar-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  max-width: 80px;
}

.bar-container {
  height: 200px;
  display: flex;
  align-items: flex-end;
  width: 100%;
}

.bar {
  width: 100%;
  background: linear-gradient(to top, #3b82f6, #60a5fa);
  border-radius: 4px 4px 0 0;
  transition: all 0.3s;
  cursor: pointer;
}

.bar:hover {
  background: linear-gradient(to top, #2563eb, #3b82f6);
}

.bar-label {
  margin-top: 1.5rem;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  text-align: center;
  transform: rotate(-45deg);
  white-space: nowrap;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin-top: 1.5rem;
}

.stat-card {
  background: var(--color-surface);
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid var(--color-border);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border-left: 4px solid var(--color-accent);
}

.stat-label {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin-bottom: 0.5rem;
}

.stat-value {
  font-size: 1.875rem;
  font-weight: 700;
  color: var(--color-text-heading);
}

.badge {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 500;
}

.badge.success {
  background: #dcfce7;
  color: #166534;
}

.badge.warning {
  background: #fef3c7;
  color: #92400e;
}

.badge.danger {
  background: #fee2e2;
  color: #991b1b;
}

.positive-change {
  color: #16a34a;
  font-weight: 600;
}

.negative-change {
  color: #dc2626;
  font-weight: 600;
}

.loading {
  text-align: center;
  padding: 3rem;
  color: var(--color-text-muted);
}

.error {
  background: #fee2e2;
  color: #991b1b;
  padding: 1rem;
  border-radius: 8px;
  margin: 1rem 0;
}

[data-theme="dark"] .error {
  background: rgba(220, 38, 38, 0.12);
  color: #fca5a5;
}
</style>
