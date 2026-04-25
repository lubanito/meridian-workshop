import { ref, computed } from 'vue'
import { useI18n } from './useI18n'

// Base user data (language-independent)
const baseUserData = {
  id: 1,
  email: 'john.doe@catalystcomponents.com',
  phone: '+1 (111) 111-1111',
  avatar: null,
  joinDate: '2022-03-15'
}

// useI18n returns module-level singleton refs, so it's safe to grab the
// locale ref once at module scope. The computed below stays reactive to
// locale changes because it reads currentLocale.value.
const { currentLocale } = useI18n()

// Mock current user data with language-aware fields.
// Note: this rebuilds the full tasks array on every locale change, but
// App.vue snapshots tasks into its own state at setup time, so a locale
// switch only re-translates display labels — it does NOT restore tasks
// the user has deleted or toggled in the current session.
const currentUser = computed(() => {
  const isJapanese = currentLocale.value === 'ja'

  return {
    ...baseUserData,
    name: isJapanese ? '田中 太郎' : 'John Doe',
    jobTitle: isJapanese ? 'オペレーションマネージャー' : 'Operations Manager',
    department: isJapanese ? 'サプライチェーン運営部' : 'Supply Chain Operations',
    location: isJapanese ? 'サンフランシスコ' : 'San Francisco',
    tasks: isJapanese ? [
      {
        id: 1,
        title: '第4四半期の在庫レベルを確認',
        priority: 'high',
        dueDate: '2026-05-08',
        status: 'pending'
      },
      {
        id: 2,
        title: '東京倉庫の注文を承認',
        priority: 'medium',
        dueDate: '2026-05-06',
        status: 'pending'
      },
      {
        id: 3,
        title: '回路基板の再注文点を更新',
        priority: 'medium',
        dueDate: '2026-05-10',
        status: 'pending'
      },
      {
        id: 4,
        title: '月次支出レポートを確認',
        priority: 'low',
        dueDate: '2026-05-15',
        status: 'pending'
      }
    ] : [
      {
        id: 1,
        title: 'Review Q4 inventory levels',
        priority: 'high',
        dueDate: '2026-05-08',
        status: 'pending'
      },
      {
        id: 2,
        title: 'Approve Tokyo warehouse orders',
        priority: 'medium',
        dueDate: '2026-05-06',
        status: 'pending'
      },
      {
        id: 3,
        title: 'Update reorder points for Circuit Boards',
        priority: 'medium',
        dueDate: '2026-05-10',
        status: 'pending'
      },
      {
        id: 4,
        title: 'Review monthly spending report',
        priority: 'low',
        dueDate: '2026-05-15',
        status: 'pending'
      }
    ]
  }
})

export function useAuth() {
  const isAuthenticated = ref(true)

  const logout = () => {
    // In a real app, this would clear tokens, etc.
    console.log('Logout clicked - would redirect to login')
    alert('Logout functionality - in a real app, this would clear session and redirect to login')
  }

  const getInitials = (name) => {
    if (!name) return ''
    return name
      .split(' ')
      .filter(Boolean)
      .map(n => n[0])
      .join('')
      .toUpperCase()
  }

  return {
    currentUser,
    isAuthenticated,
    logout,
    getInitials
  }
}
