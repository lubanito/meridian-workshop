import { ref, computed } from 'vue'

// Shared filter state (singleton pattern)
const selectedPeriod = ref('all')
const selectedLocation = ref('all')
const selectedCategory = ref('all')
const selectedStatus = ref('all')

export function useFilters() {
  // Check if any filters are active
  const hasActiveFilters = computed(() => {
    return selectedPeriod.value !== 'all' ||
           selectedLocation.value !== 'all' ||
           selectedCategory.value !== 'all' ||
           selectedStatus.value !== 'all'
  })

  // Reset all filters to default
  const resetFilters = () => {
    selectedPeriod.value = 'all'
    selectedLocation.value = 'all'
    selectedCategory.value = 'all'
    selectedStatus.value = 'all'
  }

  /**
   * Get current filters as an object for API calls.
   *
   * Always returns all four keys (warehouse / category / status / month)
   * so the shape is stable across views — but each value can be the
   * literal string 'all', meaning "no filter on this dimension". The
   * contract is that **consumers must strip 'all' values before
   * forwarding** to the server: api.js#reportParams already does this
   * by skipping any value === 'all' when building the URLSearchParams.
   * If you wire a new endpoint that hits a stricter validator, route
   * the call through api.js (don't roll your own URLSearchParams), or
   * the request will arrive with month=all / status=all and 422.
   *
   * @returns {{ warehouse: string, category: string, status: string, month: string }}
   */
  const getCurrentFilters = () => ({
    warehouse: selectedLocation.value,
    category: selectedCategory.value,
    status: selectedStatus.value,
    month: selectedPeriod.value
  })

  return {
    // State
    selectedPeriod,
    selectedLocation,
    selectedCategory,
    selectedStatus,

    // Computed
    hasActiveFilters,

    // Methods
    resetFilters,
    getCurrentFilters
  }
}
