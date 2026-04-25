<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen && backlogItem" class="modal-overlay" @click="$emit('close')">
        <div class="modal-container" @click.stop>
          <div class="modal-header">
            <h3 class="modal-title">{{ mode === 'create' ? t('purchaseOrder.createTitle') : t('purchaseOrder.viewTitle') }}</h3>
            <button class="close-button" @click="$emit('close')">
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
              <div class="form-grid">
                <div class="form-field">
                  <label class="form-label">{{ t('purchaseOrder.supplierName') }}</label>
                  <input v-model="form.supplier_name" type="text" class="form-input" :placeholder="t('purchaseOrder.supplierPlaceholder')" />
                </div>
                <div class="form-field">
                  <label class="form-label">{{ t('purchaseOrder.quantity') }}</label>
                  <input v-model.number="form.quantity" type="number" min="1" class="form-input" />
                </div>
                <div class="form-field">
                  <label class="form-label">{{ t('purchaseOrder.unitCost') }}</label>
                  <input v-model.number="form.unit_cost" type="number" min="0" step="0.01" class="form-input" />
                </div>
                <div class="form-field">
                  <label class="form-label">{{ t('purchaseOrder.expectedDelivery') }}</label>
                  <input v-model="form.expected_delivery_date" type="date" class="form-input" />
                </div>
              </div>
              <div class="form-field full-width">
                <label class="form-label">{{ t('purchaseOrder.notes') }}</label>
                <textarea v-model="form.notes" rows="3" class="form-input" :placeholder="t('purchaseOrder.notesPlaceholder')"></textarea>
              </div>
              <div v-if="formError" class="form-error">{{ formError }}</div>
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
                    <div class="detail-value">{{ poData.expected_delivery_date }}</div>
                  </div>
                  <div class="detail-item">
                    <div class="detail-label">{{ t('purchaseOrder.status') }}</div>
                    <div class="detail-value">
                      <span class="badge" :class="poData.status?.toLowerCase()">{{ poData.status }}</span>
                    </div>
                  </div>
                  <div class="detail-item">
                    <div class="detail-label">{{ t('purchaseOrder.created') }}</div>
                    <div class="detail-value">{{ poData.created_date }}</div>
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
              class="btn-primary"
              :disabled="submitting || !isFormValid"
              @click="submit"
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
import { ref, computed, watch } from 'vue'
import { api } from '../api'
import { useI18n } from '../composables/useI18n'

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  backlogItem: { type: Object, default: null },
  mode: { type: String, default: 'create' }
})

const emit = defineEmits(['close', 'po-created'])

const { t, formatCurrency } = useI18n()

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

const isFormValid = computed(() =>
  form.value.supplier_name.trim() &&
  form.value.quantity > 0 &&
  form.value.unit_cost > 0 &&
  form.value.expected_delivery_date
)

const poData = ref(null)
const poLoading = ref(false)
const poLoadError = ref('')

watch(() => props.isOpen, (open) => {
  if (!open) return
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
})

const loadPO = async () => {
  poLoading.value = true
  poLoadError.value = ''
  poData.value = null
  try {
    poData.value = await api.getPurchaseOrderByBacklogItem(props.backlogItem.id)
  } catch {
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
  } catch (err) {
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
  border-left: 3px solid #3b82f6;
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

.sku { font-family: monospace; color: #2563eb; }
.shortage { color: #dc2626; font-weight: 500; }

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
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

textarea.form-input { resize: vertical; }

.form-error {
  color: #dc2626;
  font-size: 0.875rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  padding: 0.625rem 0.875rem;
}

.loading-state { color: var(--color-text-muted); text-align: center; padding: 2rem; }
.error-state {
  color: #dc2626;
  background: #fef2f2;
  border: 1px solid #fecaca;
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
.detail-value.mono { font-family: monospace; color: #2563eb; }

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
  background: #2563eb;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.875rem;
  color: white;
  cursor: pointer;
  transition: background 0.15s;
  font-family: inherit;
}

.btn-primary:hover:not(:disabled) { background: #1d4ed8; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-active .modal-container, .modal-leave-active .modal-container { transition: transform 0.2s ease; }
.modal-enter-from .modal-container, .modal-leave-to .modal-container { transform: scale(0.95); }
</style>
