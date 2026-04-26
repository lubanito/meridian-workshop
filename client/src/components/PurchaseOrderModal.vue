<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen && backlogItem" class="modal-overlay" @click="$emit('close')">
        <div
          ref="dialogRef"
          class="modal-container"
          role="dialog"
          aria-modal="true"
          aria-labelledby="po-modal-title"
          @click.stop
        >
          <div class="modal-header">
            <h3 id="po-modal-title" class="modal-title">{{ mode === 'create' ? t('purchaseOrder.createTitle') : t('purchaseOrder.viewTitle') }}</h3>
            <button class="close-button" :aria-label="t('common.close')" @click="$emit('close')">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div class="modal-body">
            <div class="item-info">
              <div class="item-name">{{ backlogItem.item_name }}</div>
              <div class="item-meta">
                <span class="sku">{{ backlogItem.item_sku }}</span>
                <span class="shortage">{{ t('purchaseOrder.shortage') }}: {{ shortage }} {{ t('purchaseOrder.units') }}</span>
              </div>
            </div>

            <template v-if="mode === 'create'">
              <!-- Real <form> so HTML5 `required` validation fires on submit
                   and pressing Enter inside any field submits the dialog.
                   The primary action button lives in the modal-footer
                   (outside this element) and is associated via form="po-form"
                   so the original visual layout is preserved. -->
              <form id="po-form" class="po-form" @submit.prevent="submit">
                <div class="form-grid">
                  <div class="form-field">
                    <label for="po-supplier-name" class="form-label">{{ t('purchaseOrder.supplierName') }}</label>
                    <input id="po-supplier-name" v-model="form.supplier_name" type="text" required class="form-input" :placeholder="t('purchaseOrder.supplierPlaceholder')" />
                  </div>
                  <div class="form-field">
                    <label for="po-quantity" class="form-label">{{ t('purchaseOrder.quantity') }}</label>
                    <input id="po-quantity" v-model.number="form.quantity" type="number" min="1" required class="form-input" />
                  </div>
                  <div class="form-field">
                    <label for="po-unit-cost" class="form-label">{{ t('purchaseOrder.unitCost') }}</label>
                    <input id="po-unit-cost" v-model.number="form.unit_cost" type="number" :min="unitCostMin" :step="unitCostStep" required class="form-input" aria-describedby="po-unit-cost-hint" />
                    <small id="po-unit-cost-hint" class="form-hint">{{ t('purchaseOrder.unitCostHint', { min: formatCurrency(unitCostMin) }) }}</small>
                  </div>
                  <div class="form-field">
                    <label for="po-delivery-date" class="form-label">{{ t('purchaseOrder.expectedDelivery') }}</label>
                    <input id="po-delivery-date" v-model="form.expected_delivery_date" type="date" :min="todayIso" required class="form-input" />
                  </div>
                </div>
                <div class="form-field full-width">
                  <label for="po-notes" class="form-label">{{ t('purchaseOrder.notes') }}</label>
                  <textarea id="po-notes" v-model="form.notes" rows="3" class="form-input" :placeholder="t('purchaseOrder.notesPlaceholder')"></textarea>
                </div>
                <div v-if="formError" class="form-error">{{ formError }}</div>
              </form>
            </template>

            <template v-else>
              <div v-if="poLoading" class="loading-state">{{ t('purchaseOrder.loading') }}</div>
              <div v-else-if="poLoadError" class="error-state">{{ poLoadError }}</div>
              <div v-else-if="poData" class="po-details">
                <div class="detail-grid">
                  <div class="detail-item">
                    <div class="detail-label">{{ t('purchaseOrder.poId') }}</div>
                    <div class="detail-value mono">{{ poData.id }}</div>
                  </div>
                  <div class="detail-item">
                    <div class="detail-label">{{ t('purchaseOrder.supplier') }}</div>
                    <div class="detail-value">{{ poData.supplier_name }}</div>
                  </div>
                  <div class="detail-item">
                    <div class="detail-label">{{ t('purchaseOrder.quantity') }}</div>
                    <div class="detail-value">{{ poData.quantity }} {{ t('purchaseOrder.units') }}</div>
                  </div>
                  <div class="detail-item">
                    <div class="detail-label">{{ t('purchaseOrder.unitCost') }}</div>
                    <div class="detail-value">{{ formatCurrency(poData.unit_cost) }}</div>
                  </div>
                  <div class="detail-item">
                    <div class="detail-label">{{ t('purchaseOrder.totalCost') }}</div>
                    <div class="detail-value">{{ formatCurrency(poData.quantity * poData.unit_cost) }}</div>
                  </div>
                  <div class="detail-item">
                    <div class="detail-label">{{ t('purchaseOrder.expectedDelivery') }}</div>
                    <div class="detail-value">{{ formatDate(poData.expected_delivery_date) }}</div>
                  </div>
                  <div class="detail-item">
                    <div class="detail-label">{{ t('purchaseOrder.status') }}</div>
                    <div class="detail-value">
                      <span class="badge" :class="poData.status?.toLowerCase()">{{ poData.status }}</span>
                    </div>
                  </div>
                  <div class="detail-item">
                    <div class="detail-label">{{ t('purchaseOrder.created') }}</div>
                    <div class="detail-value">{{ formatDate(poData.created_date) }}</div>
                  </div>
                </div>
                <div v-if="poData.notes" class="po-notes">
                  <div class="detail-label">{{ t('purchaseOrder.notesLabel') }}</div>
                  <div class="notes-text">{{ poData.notes }}</div>
                </div>
              </div>
            </template>
          </div>

          <div class="modal-footer">
            <button class="btn-secondary" @click="$emit('close')">{{ t('common.close') }}</button>
            <button
              v-if="mode === 'create'"
              type="submit"
              form="po-form"
              class="btn-primary"
              :disabled="submitting || !isFormValid"
            >
              {{ submitting ? t('purchaseOrder.creating') : t('purchaseOrder.createOrder') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import { api } from '../api'
import { useI18n } from '../composables/useI18n'

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  backlogItem: { type: Object, default: null },
  mode: { type: String, default: 'create' }
})

const emit = defineEmits(['close', 'po-created'])

// Template ref to *this* modal's dialog div, so the focus-trap can't
// pick the wrong dialog when multiple modals are open simultaneously.
const dialogRef = ref(null)

// Element that opened the dialog — captured on open so we can restore
// focus to it on close (WCAG 2.4.3 — Focus Order).
const triggerEl = ref(null)

// Selector for "focusable" descendants when trapping Tab inside the modal.
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// WCAG 2.1 SC 2.1.2 — keyboard users must be able to dismiss the modal
// AND focus must stay within while it is open. A document-level listener
// works regardless of which element has focus, which matters because
// Teleport renders the overlay outside this component.
const onKeydown = (e) => {
  if (e.key === 'Escape') {
    emit('close')
    return
  }
  if (e.key !== 'Tab') return
  const dialog = dialogRef.value
  if (!dialog) return
  const focusables = dialog.querySelectorAll(FOCUSABLE)
  if (focusables.length === 0) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  // Defensive: if focus is outside the dialog (e.g. a Teleport sibling
  // grabbed it), pull it back to the first focusable rather than letting
  // Tab walk into non-modal content.
  if (!dialog.contains(document.activeElement)) {
    e.preventDefault()
    first.focus()
    return
  }
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}

const { t, formatCurrency, formatDate, currentCurrency, localeTag } = useI18n()

// Drive both step and min off Intl's per-currency fraction digits — JPY → 0
// (step 1), USD → 2 (step 0.01), KWD → 3 (step 0.001) — same source of
// truth as formatCurrency. A hardcoded {JPY: 1, else: 0.01} branch would
// silently round 3-decimal currencies to two if a third locale is added.
const unitCostStep = computed(() => {
  const digits = new Intl.NumberFormat(localeTag.value, {
    style: 'currency',
    currency: currentCurrency.value
  }).resolvedOptions().maximumFractionDigits
  return Math.pow(10, -digits)
})
// Mirror the server's Field(..., ge=0.01) so the form rejects sub-unit
// values inline rather than relying on a 422 round-trip. The minimum is
// one unit at the currency's display precision — same value as the step.
const unitCostMin = computed(() => unitCostStep.value)

// YYYY-MM-DD for the date-input `min` attribute. Recomputed each time
// the modal opens so a session that's been idle past midnight doesn't
// keep yesterday as the floor.
const todayIso = ref(new Date().toISOString().slice(0, 10))

const shortage = computed(() => {
  if (!props.backlogItem) return 0
  // Floor at zero so a partial-fulfillment item (available > needed) doesn't
  // pre-fill the form with a negative quantity that the min=1 input rejects.
  return Math.max(0, props.backlogItem.quantity_needed - props.backlogItem.quantity_available)
})

const form = ref({
  supplier_name: '',
  quantity: 0,
  unit_cost: 0,
  expected_delivery_date: '',
  notes: ''
})
const formError = ref('')
const submitting = ref(false)

// Boolean(...) wrap so the computed type is a clean boolean instead of
// "string | number | 0 | ''" — Vue evaluates either as falsy for the
// disabled binding, but consumers reading isFormValid.value get a real
// boolean.
const isFormValid = computed(() => Boolean(
  form.value.supplier_name.trim() &&
  form.value.quantity > 0 &&
  form.value.unit_cost >= unitCostMin.value &&
  form.value.expected_delivery_date
))

const poData = ref(null)
const poLoading = ref(false)
const poLoadError = ref('')

// Single watch handles both the keyboard-listener lifecycle and the
// open-time form/PO setup, so the two concerns can't diverge.
// Watches both isOpen and backlogItem so a parent can open the modal
// before backlogItem is wired (or while it's null) without crashing —
// loadPO() and the form prefill both need a non-null backlogItem.
watch(() => [props.isOpen, props.backlogItem], async ([open, item]) => {
  if (open) {
    // Don't try to render a real form/PO while we still have nothing to
    // show. The v-if on the template covers the visual case, but the
    // setup logic below (shortage, loadPO) would NPE.
    if (!item) return
    // Capture the element that opened the dialog so focus can be
    // restored to it on close — WCAG 2.4.3 expects focus to return
    // to a logical predecessor when a modal dismisses. Skip if we
    // already have a trigger captured: this watcher also fires when
    // the parent swaps backlogItem while isOpen stays true, and
    // re-capturing then would clobber the real opener with whatever
    // is currently focused *inside* the modal (typically a form input).
    if (!triggerEl.value) {
      triggerEl.value = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    }
    document.addEventListener('keydown', onKeydown)
    todayIso.value = new Date().toISOString().slice(0, 10)
    if (props.mode === 'create') {
      form.value = {
        supplier_name: '',
        quantity: shortage.value,
        unit_cost: 0,
        expected_delivery_date: '',
        notes: ''
      }
      formError.value = ''
    } else {
      loadPO()
    }
    // Move focus into the dialog after it mounts so the focus-trap
    // tab cycle has somewhere to start, and keyboard users land inside.
    await nextTick()
    const firstFocusable = dialogRef.value?.querySelector(FOCUSABLE)
    firstFocusable?.focus()
  } else {
    document.removeEventListener('keydown', onKeydown)
    // Restore focus to the trigger if it's still in the document and
    // visible. Guard against the trigger being unmounted between open
    // and close (e.g. a route change replaced the page).
    const trigger = triggerEl.value
    if (trigger && document.contains(trigger) && typeof trigger.focus === 'function') {
      trigger.focus()
    }
    triggerEl.value = null
  }
})

// Belt-and-suspenders: if the component is destroyed while still open
// (e.g. parent route changes mid-modal), make sure the listener is gone.
onUnmounted(() => document.removeEventListener('keydown', onKeydown))

const loadPO = async () => {
  poLoading.value = true
  poLoadError.value = ''
  poData.value = null
  try {
    poData.value = await api.getPurchaseOrderByBacklogItem(props.backlogItem.id)
  } catch (err) {
    // Surface a user-friendly message but keep the raw error in the
    // console so devtools shows the network/stack trace.
    console.error('[PurchaseOrderModal] loadPO failed:', err)
    poLoadError.value = t('purchaseOrder.loadError')
  } finally {
    poLoading.value = false
  }
}

const submit = async () => {
  if (!isFormValid.value) return
  submitting.value = true
  formError.value = ''
  try {
    const created = await api.createPurchaseOrder({
      backlog_item_id: props.backlogItem.id,
      supplier_name: form.value.supplier_name.trim(),
      quantity: form.value.quantity,
      unit_cost: form.value.unit_cost,
      expected_delivery_date: form.value.expected_delivery_date,
      notes: form.value.notes.trim() || null
    })
    emit('po-created', created)
    // Dismiss the modal on success — leaving it open after a successful
    // POST stranded the buyer with no signal that the request landed.
    emit('close')
  } catch (err) {
    console.error('[PurchaseOrderModal] submit failed:', err)
    formError.value = err?.response?.data?.detail || t('purchaseOrder.failed')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 1rem;
}

.modal-container {
  background: var(--color-surface);
  border-radius: 12px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15);
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid var(--color-border);
}

.modal-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-text-heading);
  margin: 0;
}

.close-button {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0.375rem;
  display: flex;
  align-items: center;
  border-radius: 6px;
  transition: all 0.15s;
}

.close-button:hover { background: var(--color-bg-subtle); color: var(--color-text-heading); }

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.item-info {
  background: var(--color-bg-subtle);
  border-radius: 8px;
  padding: 1rem;
  border-left: 3px solid var(--color-accent);
}

.item-name {
  font-weight: 600;
  color: var(--color-text-heading);
  margin-bottom: 0.375rem;
}

.item-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
}

.sku { font-family: monospace; color: var(--color-accent); }
.shortage { color: var(--color-danger); font-weight: 500; }

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-field { display: flex; flex-direction: column; gap: 0.375rem; }
.full-width { grid-column: 1 / -1; }

.form-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.form-hint {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.form-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.875rem;
  color: var(--color-text-heading);
  background: var(--color-surface);
  width: 100%;
  box-sizing: border-box;
  font-family: inherit;
  transition: border-color 0.15s;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

textarea.form-input { resize: vertical; }

.form-error {
  color: var(--color-danger);
  font-size: 0.875rem;
  background: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  border-radius: 6px;
  padding: 0.625rem 0.875rem;
}

.loading-state { color: var(--color-text-muted); text-align: center; padding: 2rem; }
.error-state {
  color: var(--color-danger);
  background: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  border-radius: 6px;
  padding: 0.875rem;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.detail-item { display: flex; flex-direction: column; gap: 0.25rem; }
.detail-label { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); }
.detail-value { font-size: 0.938rem; color: var(--color-text-heading); font-weight: 500; }
.detail-value.mono { font-family: monospace; color: var(--color-accent); }

.po-notes { margin-top: 0.5rem; }
.notes-text { color: var(--color-text-body); font-size: 0.875rem; margin-top: 0.25rem; }

.badge { padding: 0.25rem 0.625rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
.badge.pending { background: #fef3c7; color: #92400e; }
.badge.approved { background: #dcfce7; color: #166534; }
.badge.delivered { background: #dbeafe; color: #1e40af; }

.modal-footer {
  padding: 1.25rem 1.5rem;
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.btn-secondary {
  padding: 0.5rem 1.25rem;
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}

.btn-secondary:hover { background: var(--color-border); }

.btn-primary {
  padding: 0.5rem 1.25rem;
  background: var(--color-accent);
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.875rem;
  color: white;
  cursor: pointer;
  transition: background 0.15s;
  font-family: inherit;
}

.btn-primary:hover:not(:disabled) { background: var(--color-accent-hover); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-active .modal-container, .modal-leave-active .modal-container { transition: transform 0.2s ease; }
.modal-enter-from .modal-container, .modal-leave-to .modal-container { transform: scale(0.95); }

/* Dark-mode overrides for the otherwise-hardcoded status colors. The
   light-tone error backgrounds aren't readable on a dark surface, and
   the pastel badges wash out against --color-surface in dark mode. */
[data-theme="dark"] .form-error,
[data-theme="dark"] .error-state {
  background: rgba(220, 38, 38, 0.12);
  border-color: rgba(220, 38, 38, 0.4);
  color: #fca5a5;
}

[data-theme="dark"] .shortage { color: #fca5a5; }

[data-theme="dark"] .badge.pending { background: rgba(217, 119, 6, 0.2); color: #fcd34d; }
[data-theme="dark"] .badge.approved { background: rgba(5, 150, 105, 0.2); color: #6ee7b7; }
[data-theme="dark"] .badge.delivered { background: rgba(37, 99, 235, 0.2); color: #93c5fd; }
</style>
