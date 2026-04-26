import { ref, computed, readonly } from 'vue'
import en from '../locales/en'
import ja from '../locales/ja'

const translations = {
  en,
  ja
}

// Load saved locale from localStorage, default to 'en'
// Wrapped in try/catch: localStorage may throw in sandboxed iframes or private mode
const savedLocale = (() => { try { return localStorage.getItem('app-locale') || 'en' } catch { return 'en' } })()
const currentLocale = ref(savedLocale)

// Named export so consumers that need the locale ref *outside* a setup
// context (e.g. module-scope code in other composables) can read it
// without invoking the composable. Exposed as readonly to keep mutation
// funneled through setLocale().
export const localeRef = readonly(currentLocale)

// Currency is automatically set based on locale (en -> USD, ja -> JPY)
const currentCurrency = computed(() => {
  return currentLocale.value === 'ja' ? 'JPY' : 'USD'
})

// Bare-language → BCP 47 tag, used for Intl APIs that need an unambiguous region
const BCP47_TAGS = { en: 'en-US', ja: 'ja-JP' }

// English category label -> i18n key. Module-scoped so it isn't reallocated
// on every useI18n() call. Centralised so Dashboard, Inventory, and
// Spending can't drift from each other.
const CATEGORY_KEYS = {
  'Circuit Boards': 'categories.circuitBoards',
  'Sensors': 'categories.sensors',
  'Actuators': 'categories.actuators',
  'Controllers': 'categories.controllers',
  'Power Supplies': 'categories.powerSupplies'
}

export function useI18n() {
  const t = (key, params = {}) => {
    const keys = key.split('.')
    let value = translations[currentLocale.value]

    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k]
      } else {
        // If translation not found, try English as fallback
        if (currentLocale.value !== 'en') {
          let fallback = translations.en
          for (const fk of keys) {
            if (fallback && typeof fallback === 'object') {
              fallback = fallback[fk]
            } else {
              break
            }
          }
          if (fallback && typeof fallback === 'string') {
            return replacePlaceholders(fallback, params)
          }
        }
        // If still not found, return the key itself
        return key
      }
    }

    if (typeof value === 'string') {
      return replacePlaceholders(value, params)
    }

    return key
  }

  const replacePlaceholders = (text, params) => {
    return text.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key] !== undefined ? params[key] : match
    })
  }

  const setLocale = (locale) => {
    if (translations[locale]) {
      currentLocale.value = locale
      try { localStorage.setItem('app-locale', locale) } catch {}
    }
  }

  const availableLocales = computed(() => Object.keys(translations))

  const localeName = computed(() => {
    const names = {
      en: 'English',
      ja: '日本語'
    }
    return names[currentLocale.value] || currentLocale.value
  })

  // Locale + currency aware. Used by every view that renders a currency
  // value — kept here to avoid four divergent copies of the same Intl call.
  // We pass full BCP 47 tags ('en-US' / 'ja-JP') rather than bare 'en' / 'ja'
  // so the browser can't pick an arbitrary region for grouping/decimals.
  // Fraction digits are intentionally NOT pinned: Intl picks the right
  // value per currency (USD → 2, JPY → 0).
  // Non-finite input (null/undefined/NaN) renders as an em-dash placeholder
  // so a missing field doesn't surface as the literal string "NaN".
  // Locale-aware ISO 8601 date renderer. Returns em-dash for null/empty
  // and unparseable strings rather than letting "Invalid Date" or a raw
  // YYYY-MM-DD reach the UI.
  const formatDate = (value, opts = { dateStyle: 'medium' }) => {
    if (!value) return '—'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat(BCP47_TAGS[currentLocale.value] ?? currentLocale.value, opts).format(d)
  }

  const formatCurrency = (num) => {
    const n = Number(num)
    if (!Number.isFinite(n)) return '—'
    return n.toLocaleString(BCP47_TAGS[currentLocale.value] ?? currentLocale.value, {
      style: 'currency',
      currency: currentCurrency.value
    })
  }

  const translateCategory = (category) =>
    CATEGORY_KEYS[category] ? t(CATEGORY_KEYS[category]) : category

  // Translate product names
  const translateProductName = (productName) => {
    if (currentLocale.value === 'ja' && translations.ja.productNames[productName]) {
      return translations.ja.productNames[productName]
    }
    return productName
  }

  // Translate customer names
  const translateCustomerName = (customerName) => {
    if (currentLocale.value === 'ja' && translations.ja.customerNames[customerName]) {
      return translations.ja.customerNames[customerName]
    }
    return customerName
  }

  // Translate warehouse names
  const translateWarehouse = (warehouseName) => {
    if (currentLocale.value === 'ja') {
      // Handle city names
      const cityMap = {
        'San Francisco': 'サンフランシスコ',
        'London': 'ロンドン',
        'Tokyo': '東京'
      }

      if (cityMap[warehouseName]) {
        return cityMap[warehouseName]
      }

      // Handle "Warehouse X-##" pattern
      if (warehouseName.startsWith('Warehouse ')) {
        return warehouseName.replace('Warehouse ', '倉庫')
      }

      return warehouseName
    }
    return warehouseName
  }

  // BCP 47 tag for the active locale ('en' -> 'en-US', 'ja' -> 'ja-JP').
  // Use this for any Intl API call so the browser can't pick an
  // arbitrary region for grouping / month-name styles.
  const localeTag = computed(() => BCP47_TAGS[currentLocale.value] ?? currentLocale.value)

  return {
    t,
    setLocale,
    currentLocale: readonly(currentLocale),
    currentCurrency,
    localeTag,
    formatCurrency,
    formatDate,
    availableLocales,
    localeName,
    translateCategory,
    translateProductName,
    translateCustomerName,
    translateWarehouse
  }
}
