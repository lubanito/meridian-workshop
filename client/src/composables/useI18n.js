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
  const formatCurrency = (num) =>
    Number(num).toLocaleString(BCP47_TAGS[currentLocale.value] ?? currentLocale.value, {
      style: 'currency',
      currency: currentCurrency.value,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })

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

  return {
    t,
    setLocale,
    currentLocale: readonly(currentLocale),
    currentCurrency,
    formatCurrency,
    availableLocales,
    localeName,
    translateProductName,
    translateCustomerName,
    translateWarehouse
  }
}
