import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import Dashboard from './views/Dashboard.vue'
import Inventory from './views/Inventory.vue'
import Orders from './views/Orders.vue'
import Demand from './views/Demand.vue'
import Spending from './views/Spending.vue'
import Reports from './views/Reports.vue'
import Restocking from './views/Restocking.vue'
import { apiConfigError } from './api'

// Surface a missing PROD VITE_API_BASE_URL as a real on-page error
// (rather than a blank document with the trace only visible in devtools)
// so a misconfigured deploy is diagnosable from the front of the box.
if (apiConfigError) {
  const root = document.getElementById('app')
  if (root) {
    root.innerHTML = ''
    const wrap = document.createElement('div')
    wrap.setAttribute('role', 'alert')
    wrap.style.cssText = 'max-width:640px;margin:4rem auto;padding:1.5rem;font-family:system-ui,sans-serif;border:1px solid #fecaca;background:#fff7f7;color:#991b1b;border-radius:8px;'
    const h = document.createElement('h1')
    h.textContent = 'Configuration error'
    h.style.cssText = 'margin:0 0 0.5rem;font-size:1.25rem;'
    const p = document.createElement('p')
    p.textContent = apiConfigError.message
    p.style.cssText = 'margin:0;font-size:0.95rem;line-height:1.5;'
    wrap.appendChild(h)
    wrap.appendChild(p)
    root.appendChild(wrap)
  }
  throw apiConfigError
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Dashboard },
    { path: '/inventory', component: Inventory },
    { path: '/orders', component: Orders },
    { path: '/demand', component: Demand },
    { path: '/spending', component: Spending },
    { path: '/reports', component: Reports },
    { path: '/restocking', component: Restocking }
  ]
})

const app = createApp(App)
app.use(router)
app.mount('#app')
