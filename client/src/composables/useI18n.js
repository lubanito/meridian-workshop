import { ref, computed, readonly } from 'vue'
import en from '../locales/en'
import ja from '../locales/ja'

const translations = {
  en,
  ja
}

// Load saved locale from localStorage, default to 'en'.
// The typeof window guard mirrors the document guard below so SSR / test
// environments without a window object don't ReferenceError before the
// try/catch can fire. The try/catch still covers sandboxed iframes and
// private-mode quota errors where window exists but localStorage throws.
const savedLocale = (() => {
  if (typeof window === 'undefined') return 'en'
  try { return window.localStorage.getItem('app-locale') || 'en' } catch { return 'en' }
})()
const currentLocale = ref(savedLocale)
// Mirror the saved locale onto <html lang="..."> at module load so the
// initial paint reports the right locale to screen readers / search.
if (typeof document !== 'undefined') {
  document.documentElement.lang = savedLocale
}

// Named export so consumers that need the locale ref *outside* a setup
// context (e.g. module-scope code in other composables) can read it
// without invoking the composable. Exposed as readonly to keep mutation
// funneled through setLocale().
export const localeRef = readonly(currentLocale)

// Currency is automatically set based on locale (en -> USD, ja -> JPY)
const currentCurrency = computed(() => {
  return currentLocale.value === 'ja' ? 'JPY' : 'USD'
})

// Bare-language → BCP 47 tag, used for Intl APIs that need an unambiguous region.
// Adding a third locale means adding it here too — the resolveLocaleTag()
// helper below logs a one-time console.warn on a missing entry so the
// drift surfaces in the dev console instead of silently falling back to
// "Intl picks an arbitrary region" behavior.
const BCP47_TAGS = { en: 'en-US', ja: 'ja-JP' }
const _warnedMissingTag = new Set()
const resolveLocaleTag = (locale) => {
  const tag = BCP47_TAGS[locale]
  if (tag) return tag
  if (typeof console !== 'undefined' && !_warnedMissingTag.has(locale)) {
    _warnedMissingTag.add(locale)
    console.warn(`[useI18n] no BCP 47 tag mapped for locale ${JSON.stringify(locale)} — Intl will pick a region. Add it to BCP47_TAGS.`)
  }
  return locale
}

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
      // Keep <html lang="..."> in sync so screen readers and search
      // engines report the active locale rather than the index.html
      // hardcoded default.
      if (typeof document !== 'undefined') {
        document.documentElement.lang = locale
      }
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
    return new Intl.DateTimeFormat(resolveLocaleTag(currentLocale.value), opts).format(d)
  }

  const formatCurrency = (num) => {
    const n = Number(num)
    if (!Number.isFinite(n)) return '—'
    return n.toLocaleString(resolveLocaleTag(currentLocale.value), {
      style: 'currency',
      currency: currentCurrency.value
    })
  }

  // Per-currency display precision driven off Intl's resolvedOptions —
  // USD → 2 (display .01), JPY → 0 (display 1), KWD → 3 (display .001).
  // Single source of truth for both PurchaseOrderModal's unitCostStep /
  // unitCostMin and Restocking's roundLine multiplier so the two can't
  // drift if the locale set ever changes.
  const currencyPrecision = computed(() => {
    return new Intl.NumberFormat(resolveLocaleTag(currentLocale.value), {
      style: 'currency',
      currency: currentCurrency.value
    }).resolvedOptions().maximumFractionDigits
  })

  const translateCategory = (category) =>
    CATEGORY_KEYS[category] ? t(CATEGORY_KEYS[category]) : category

  // Translate product names. Optional-chain `productNames` so a future
  // stripped-down locale build (e.g. ja missing the productNames map)
  // can't NPE the dashboard — fall through to the source string instead.
  const translateProductName = (productName) => {
    if (currentLocale.value === 'ja' && translations.ja.productNames?.[productName]) {
      return translations.ja.productNames[productName]
    }
    return productName
  }

  // Translate customer names. Same optional-chain reasoning as above.
  const translateCustomerName = (customerName) => {
    if (currentLocale.value === 'ja' && translations.ja.customerNames?.[customerName]) {
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
  // arbitrary region for grouping / month-name styles. Routed through
  // resolveLocaleTag so a missing entry in BCP47_TAGS surfaces as a
  // dev-console warning instead of silent fallback.
  const localeTag = computed(() => resolveLocaleTag(currentLocale.value))

  return {
    t,
    setLocale,
    // Reuse the module-level readonly view rather than wrapping
    // currentLocale a second time — the named export `localeRef` and
    // this returned ref are now the same readonly proxy, not two
    // independent ones over the same source.
    currentLocale: localeRef,
    currentCurrency,
    localeTag,
    currencyPrecision,
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
