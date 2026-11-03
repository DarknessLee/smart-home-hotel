<script setup>
/**
 * 升级方案（需求文档 4.3 核心特色模块）：
 * - 左侧生成器：改造范围（单间 / 整层 / 整店）+ 方案档次（基础 / 舒适 / 旗舰）+ 说明；
 * - 右侧预览：方案名、设备清单（数量 / 单价 / 小计）、总预算、改造前后对比占位卡片；
 * - 下方历史方案：状态、创建人、预算，草稿可提交审批，待审批可由店长通过 / 驳回。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  PERMISSION,
  PLAN_SCOPE,
  PLAN_STATUS_LABEL,
  PLAN_TIER,
  formatMoney
} from '@smart-home/utils'
import { useAuthStore, usePlanStore } from '@smart-home/stores'
import PageHeader from '@/components/PageHeader.vue'

const auth = useAuthStore()
const planStore = usePlanStore()

const scope = ref('room')
const tier = ref('comfort')
const note = ref('')

const generating = ref(false)
const submittingId = ref('')
const approveVisible = ref(false)
const approvingPlan = ref(null)
const approveForm = reactive({ approved: true, comment: '' })
const approving = ref(false)
/** 本次生成时填写的需求说明（仅用于预览展示） */
const lastGenerated = ref({ id: '', note: '' })

/** 权限 */
const canCreate = computed(() => auth.can(PERMISSION.B_PLAN_CREATE))
const canApprove = computed(() => auth.can(PERMISSION.B_PLAN_APPROVE))

/** 物料库（缺省回退到常量，保证页面始终可用） */
const scopes = computed(() => (planStore.catalog.scopes && planStore.catalog.scopes.length ? planStore.catalog.scopes : PLAN_SCOPE))
const tiers = computed(() => (planStore.catalog.tiers && planStore.catalog.tiers.length ? planStore.catalog.tiers : PLAN_TIER))

/** 当前预览方案 */
const preview = computed(() => planStore.current)

/** 本次生成填写、且仍在预览生成方案时展示的需求说明 */
const previewNote = computed(() => {
  if (!preview.value) return ''
  return lastGenerated.value.id === preview.value.id ? lastGenerated.value.note : ''
})

/** 方案状态标签类型 */
const statusTagType = {
  draft: 'info',
  pending_approval: 'warning',
  approved: 'success',
  rejected: 'danger'
}

/** 当前选中档次的说明 */
const selectedTier = computed(() => tiers.value.find((item) => item.value === tier.value) || {})
const selectedScope = computed(() => scopes.value.find((item) => item.value === scope.value) || {})

/**
 * 加载物料库与历史方案。
 * @returns {Promise<void>}
 */
async function loadData() {
  try {
    await Promise.all([planStore.fetchCatalog(), planStore.fetchPlans()])
    if (!planStore.current && planStore.list.length) {
      planStore.current = planStore.list[0]
    }
  } catch (error) {
    ElMessage.error(error.message || '方案数据加载失败')
  }
}

/**
 * 生成方案。
 * @returns {Promise<void>}
 */
async function generatePlan() {
  if (!canCreate.value) {
    ElMessage.warning('当前角色无方案生成权限，需店长权限')
    return
  }
  generating.value = true
  try {
    const plan = await planStore.generate({ scope: scope.value, tier: tier.value, note: note.value })
    lastGenerated.value = { id: plan.id, note: note.value.trim() }
    ElMessage.success(`方案「${plan.name}」已生成，预算 ${formatMoney(plan.total_price, { digits: 0 })}`)
  } catch (error) {
    ElMessage.error(error.message || '方案生成失败')
  } finally {
    generating.value = false
  }
}

/**
 * 提交审批（草稿 → 待审批）。
 * @param {Object} plan
 * @returns {Promise<void>}
 */
async function submitPlan(plan) {
  if (!plan || submittingId.value) return
  try {
    await ElMessageBox.confirm(`确认将方案「${plan.name}」提交店长审批？`, '提交审批', {
      confirmButtonText: '提交',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch (error) {
    return
  }
  submittingId.value = plan.id
  try {
    await planStore.submit(plan.id)
    ElMessage.success('已提交审批，等待店长处理')
  } catch (error) {
    ElMessage.error(error.message || '提交失败')
  } finally {
    submittingId.value = ''
  }
}

/**
 * 打开审批弹窗。
 * @param {Object} plan
 * @param {boolean} approved 默认通过 / 驳回
 */
function openApprove(plan, approved) {
  approvingPlan.value = plan
  approveForm.approved = approved
  approveForm.comment = ''
  approveVisible.value = true
}

/**
 * 确认审批。
 * @returns {Promise<void>}
 */
async function confirmApprove() {
  if (!approvingPlan.value || approving.value) return
  if (!approveForm.approved && !approveForm.comment.trim()) {
    ElMessage.warning('驳回方案时请填写审批意见')
    return
  }
  approving.value = true
  try {
    await planStore.approve(approvingPlan.value.id, {
      approved: approveForm.approved,
      comment: approveForm.comment.trim()
    })
    ElMessage.success(`方案已${approveForm.approved ? '通过' : '驳回'}`)
    approveVisible.value = false
    approvingPlan.value = null
  } catch (error) {
    ElMessage.error(error.message || '审批失败')
  } finally {
    approving.value = false
  }
}

/**
 * 在右侧预览某个历史方案。
 * @param {Object} plan
 * @returns {Promise<void>}
 */
async function previewPlan(plan) {
  if (!plan) return
  try {
    await planStore.fetchPlan(plan.id)
  } catch (error) {
    ElMessage.error(error.message || '方案详情加载失败')
  }
}

/**
 * 历史方案行操作可见性。
 * @param {Object} plan
 * @param {string} action
 * @returns {boolean}
 */
function canRunPlanAction(plan, action) {
  if (!plan) return false
  if (action === 'submit') return plan.status === 'draft' && canCreate.value
  if (action === 'approve') return plan.status === 'pending_approval' && canApprove.value
  return false
}

onMounted(loadData)
</script>

<template>
  <div class="page">
    <PageHeader
      title="升级方案"
      icon="MagicStick"
      desc="按房间范围与方案档次一键生成智能改造清单与预算，草稿提交后由店长审批（需求文档 4.3）"
    >
      <template #actions>
        <el-button :loading="planStore.loading" @click="loadData">
          <el-icon><Refresh /></el-icon>
          <span>刷新方案</span>
        </el-button>
      </template>
    </PageHeader>

    <el-alert
      v-if="!canCreate"
      type="info"
      :closable="false"
      show-icon
      title="当前角色仅可查看方案与预算，方案生成需店长权限，审批需店长权限"
    />

    <div class="plan-layout">
      <!-- 生成器 -->
      <section class="panel generator">
        <div class="panel__head">
          <h3 class="panel__title">方案生成器</h3>
          <span class="panel__extra">选择范围 + 档次</span>
        </div>

        <div class="generator__block">
          <label class="generator__label">改造范围</label>
          <div class="scope-options">
            <button
              v-for="item in scopes"
              :key="item.value"
              type="button"
              class="scope-option"
              :class="{ 'is-active': scope === item.value }"
              :disabled="!canCreate"
              @click="scope = item.value"
            >
              <el-icon :size="20">
                <component :is="item.value === 'room' ? 'House' : item.value === 'floor' ? 'OfficeBuilding' : 'Shop'" />
              </el-icon>
              <strong>{{ item.label }}</strong>
              <small>{{ item.room_count }} 间房</small>
            </button>
          </div>
        </div>

        <div class="generator__block">
          <label class="generator__label">方案档次</label>
          <div class="tier-options">
            <button
              v-for="item in tiers"
              :key="item.value"
              type="button"
              class="tier-option"
              :class="{ 'is-active': tier === item.value }"
              :disabled="!canCreate"
              @click="tier = item.value"
            >
              <div class="tier-option__top">
                <strong>{{ item.label }}</strong>
                <el-icon v-if="tier === item.value" :size="15" class="tier-option__check"><CircleCheckFilled /></el-icon>
              </div>
              <p>{{ item.description }}</p>
            </button>
          </div>
        </div>

        <div class="generator__block">
          <label class="generator__label">需求说明（选填）</label>
          <el-input
            v-model="note"
            type="textarea"
            :rows="3"
            maxlength="120"
            show-word-limit
            placeholder="例如：优先改造 5F 亲子房楼层，配合暑期活动上线"
            :disabled="!canCreate"
          />
        </div>

        <div class="generator__summary">
          <span>当前选择</span>
          <strong>{{ selectedScope.label }} · {{ selectedTier.label }}</strong>
          <small>预计 {{ selectedScope.room_count }} 间房，生成后可在右侧查看清单与预算</small>
        </div>

        <el-button
          type="primary"
          size="large"
          class="generator__submit"
          :loading="generating"
          :disabled="!canCreate"
          @click="generatePlan"
        >
          <el-icon><MagicStick /></el-icon>
          <span>生成升级方案</span>
        </el-button>
      </section>

      <!-- 预览 -->
      <section class="panel preview">
        <div class="panel__head">
          <h3 class="panel__title">方案预览</h3>
          <el-tag
            v-if="preview"
            size="small"
            :type="statusTagType[preview.status] || 'info'"
            effect="light"
          >
            {{ PLAN_STATUS_LABEL[preview.status] || preview.status }}
          </el-tag>
        </div>

        <template v-if="preview">
          <div class="preview__hero">
            <div class="preview__hero-main">
              <h4>{{ preview.name }}</h4>
              <p>
                {{ preview.scope_label }} · {{ preview.room_count }} 间房 · {{ preview.tier_label }}
              </p>
              <div class="preview__tags">
                <el-tag size="small" effect="plain" type="info">创建人：{{ preview.creator }}</el-tag>
                <el-tag size="small" effect="plain" type="info">{{ preview.created_at }}</el-tag>
                <el-tag v-if="preview.approver" size="small" effect="plain" type="success">
                  审批人：{{ preview.approver }}
                </el-tag>
              </div>
              <p v-if="previewNote" class="preview__note">
                <el-icon :size="12"><ChatLineSquare /></el-icon>
                需求说明：{{ previewNote }}
              </p>
            </div>
            <div class="preview__budget">
              <span>总预算</span>
              <strong>{{ formatMoney(preview.total_price, { digits: 0 }) }}</strong>
              <small>{{ preview.items.length }} 类设备</small>
            </div>
          </div>

          <div class="preview__section">
            <h5>设备清单</h5>
            <el-table :data="preview.items" size="small" style="width: 100%">
              <el-table-column prop="name" label="设备 / 物料" min-width="180" />
              <el-table-column label="数量" width="80" align="right">
                <template #default="{ row }">{{ row.qty }}</template>
              </el-table-column>
              <el-table-column label="单价" width="100" align="right">
                <template #default="{ row }">{{ formatMoney(row.unit_price, { digits: 0 }) }}</template>
              </el-table-column>
              <el-table-column label="小计" width="110" align="right">
                <template #default="{ row }">
                  <span class="text-number text-strong">{{ formatMoney(row.amount, { digits: 0 }) }}</span>
                </template>
              </el-table-column>
            </el-table>
            <div class="preview__total">
              <span>预算合计</span>
              <strong>{{ formatMoney(preview.total_price) }}</strong>
            </div>
          </div>

          <div class="preview__section">
            <h5>改造前后对比</h5>
            <div class="compare">
              <div class="compare__card compare__card--before">
                <span class="compare__badge">改造前</span>
                <div class="compare__visual">
                  <el-icon :size="30"><House /></el-icon>
                  <span class="compare__glyph">传统客房</span>
                </div>
                <ul>
                  <li>手动开关灯光 / 窗帘</li>
                  <li>空调面板独立控制</li>
                  <li>无场景联动与语音入口</li>
                </ul>
              </div>
              <div class="compare__card compare__card--after">
                <span class="compare__badge">改造后</span>
                <div class="compare__visual">
                  <el-icon :size="30"><MagicStick /></el-icon>
                  <span class="compare__glyph">全屋智能</span>
                </div>
                <ul>
                  <li>场景面板一键切换入住 / 睡眠</li>
                  <li>灯光空调窗帘联动控制</li>
                  <li>语音中控 + 能耗可视化管理</li>
                </ul>
              </div>
            </div>
          </div>

          <div v-if="preview.comment" class="preview__comment">
            <el-icon :size="13"><ChatLineSquare /></el-icon>
            <span>{{ preview.comment }}</span>
          </div>
        </template>

        <div v-else class="preview__empty">
          <el-icon :size="40" style="color: #c6d3e5"><MagicStick /></el-icon>
          <h3>还没有预览方案</h3>
          <p>在左侧选择范围与档次后点击「生成升级方案」，或从下方历史方案中查看。</p>
        </div>
      </section>
    </div>

    <!-- 历史方案 -->
    <section class="panel panel--flush">
      <div class="panel__head panel__head--pad">
        <h3 class="panel__title">历史方案</h3>
        <span class="panel__extra">共 {{ planStore.list.length }} 个方案</span>
      </div>
      <el-table v-loading="planStore.loading" :data="planStore.list" style="width: 100%" row-key="id">
        <el-table-column label="方案名称" min-width="210">
          <template #default="{ row }">
            <div class="flex-col" style="gap: 3px">
              <a class="plan-link" @click="previewPlan(row)">{{ row.name }}</a>
              <span class="text-small text-muted">{{ row.scope_label }} · {{ row.room_count }} 间房 · {{ row.tier_label }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="预算" width="140" align="right">
          <template #default="{ row }">
            <span class="text-number text-strong">{{ formatMoney(row.total_price, { digits: 0 }) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="104" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="statusTagType[row.status] || 'info'" effect="light">
              {{ PLAN_STATUS_LABEL[row.status] || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建人" width="96" prop="creator" />
        <el-table-column label="创建时间" width="150">
          <template #default="{ row }">
            <span class="text-small text-muted">{{ row.created_at }}</span>
          </template>
        </el-table-column>
        <el-table-column label="审批意见" min-width="180">
          <template #default="{ row }">
            <span class="text-small text-muted">{{ row.comment || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="210" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" text type="primary" @click="previewPlan(row)">查看</el-button>
              <el-button
                v-if="canRunPlanAction(row, 'submit')"
                size="small"
                type="primary"
                plain
                :loading="submittingId === row.id"
                @click="submitPlan(row)"
              >
                提交审批
              </el-button>
              <template v-if="canRunPlanAction(row, 'approve')">
                <el-button size="small" type="success" plain @click="openApprove(row, true)">通过</el-button>
                <el-button size="small" type="danger" plain @click="openApprove(row, false)">驳回</el-button>
              </template>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <div class="empty-block">暂无历史方案，先生成一个吧</div>
        </template>
      </el-table>
    </section>

    <!-- 审批弹窗 -->
    <el-dialog v-model="approveVisible" width="460px" :title="approveForm.approved ? '审批通过' : '驳回方案'">
      <div v-if="approvingPlan" class="approve">
        <p class="approve__plan">{{ approvingPlan.name }}</p>
        <el-radio-group v-model="approveForm.approved">
          <el-radio :value="true">通过</el-radio>
          <el-radio :value="false">驳回</el-radio>
        </el-radio-group>
        <el-input
          v-model="approveForm.comment"
          class="mt-12"
          type="textarea"
          :rows="4"
          maxlength="120"
          show-word-limit
          :placeholder="approveForm.approved ? '审批意见（选填）' : '请填写驳回原因（必填）'"
        />
        <p class="text-small text-muted mt-8">
          <el-icon :size="12"><InfoFilled /></el-icon>
          审批人为当前登录员工：{{ auth.displayName }}（{{ auth.roleLabel }}）
        </p>
      </div>
      <template #footer>
        <el-button @click="approveVisible = false">取消</el-button>
        <el-button :type="approveForm.approved ? 'success' : 'danger'" :loading="approving" @click="confirmApprove">
          确认{{ approveForm.approved ? '通过' : '驳回' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.plan-layout {
  display: grid;
  grid-template-columns: minmax(320px, 400px) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.generator {
  position: sticky;
  top: 8px;
}

.generator__block + .generator__block {
  margin-top: 20px;
}

.generator__label {
  display: block;
  margin-bottom: 10px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-regular);
  letter-spacing: 0.3px;
}

.scope-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.scope-option {
  font-family: inherit;
  cursor: pointer;
  border: 1px solid var(--border-base);
  background: #fbfcfe;
  border-radius: 11px;
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.scope-option strong {
  font-size: 12.5px;
  color: var(--text-main);
}

.scope-option small {
  font-size: 10.5px;
  color: var(--text-placeholder);
}

.scope-option.is-active {
  border-color: var(--brand);
  background: var(--brand-soft);
  color: var(--brand);
  box-shadow: 0 6px 14px rgba(22, 119, 255, 0.14);
}

.scope-option.is-active small {
  color: var(--brand);
}

.scope-option:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.tier-options {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.tier-option {
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  border: 1px solid var(--border-base);
  background: #fbfcfe;
  border-radius: 11px;
  padding: 11px 13px;
  transition: all 0.2s ease;
}

.tier-option__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.tier-option__top strong {
  font-size: 13px;
  color: var(--text-main);
}

.tier-option__check {
  color: var(--brand);
}

.tier-option p {
  margin: 5px 0 0;
  font-size: 11.5px;
  line-height: 1.55;
  color: var(--text-secondary);
}

.tier-option.is-active {
  border-color: var(--brand);
  background: var(--brand-soft);
}

.tier-option:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.generator__summary {
  margin-top: 20px;
  padding: 12px 14px;
  border-radius: 11px;
  background: linear-gradient(135deg, #f2f7ff, #fbfdff);
  border: 1px dashed #cfe0fb;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.generator__summary span {
  font-size: 11px;
  color: var(--text-secondary);
}

.generator__summary strong {
  font-size: 14px;
  color: var(--brand);
}

.generator__summary small {
  font-size: 11px;
  color: var(--text-placeholder);
  line-height: 1.5;
}

.generator__submit {
  width: 100%;
  margin-top: 18px;
}

.preview__hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 16px 18px;
  border-radius: 13px;
  background: linear-gradient(135deg, #f2f7ff 0%, #fbfdff 100%);
  border: 1px solid #e3eeff;
}

.preview__hero-main {
  min-width: 0;
}

.preview__hero-main h4 {
  margin: 0;
  font-size: 18px;
  color: var(--text-main);
  letter-spacing: 0.4px;
}

.preview__hero-main p {
  margin: 7px 0 0;
  font-size: 12.5px;
  color: var(--text-secondary);
}

.preview__tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.preview__note {
  margin: 10px 0 0 !important;
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 8px 11px;
  border-radius: 8px;
  background: #fffbe6;
  border: 1px solid #ffe58f;
  color: #ad6800 !important;
  font-size: 12px !important;
  line-height: 1.6;
}

.preview__budget {
  flex-shrink: 0;
  text-align: right;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.preview__budget span {
  font-size: 11.5px;
  color: var(--text-secondary);
}

.preview__budget strong {
  font-family: var(--font-number);
  font-size: 26px;
  color: var(--brand);
  font-weight: 700;
  line-height: 1.2;
}

.preview__budget small {
  font-size: 10.5px;
  color: var(--text-placeholder);
}

.preview__section {
  margin-top: 18px;
}

.preview__section h5 {
  margin: 0 0 10px;
  font-size: 13px;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 7px;
}

.preview__section h5::before {
  content: '';
  width: 3px;
  height: 12px;
  border-radius: 3px;
  background: var(--brand);
}

.preview__total {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 10px 14px;
  margin-top: 8px;
  border-radius: 9px;
  background: #f7faff;
  border: 1px solid var(--border-light);
}

.preview__total span {
  font-size: 12px;
  color: var(--text-secondary);
}

.preview__total strong {
  font-family: var(--font-number);
  font-size: 18px;
  color: var(--brand);
}

.compare {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.compare__card {
  position: relative;
  border-radius: 13px;
  padding: 16px;
  color: #fff;
  min-height: 178px;
  overflow: hidden;
}

.compare__card::after {
  content: '';
  position: absolute;
  right: -36px;
  bottom: -36px;
  width: 128px;
  height: 128px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
}

.compare__card--before {
  background: linear-gradient(135deg, #c5cfdd 0%, #93a3b8 100%);
}

.compare__card--after {
  background: linear-gradient(135deg, #1677ff 0%, #5ba4ff 60%, #7db4ff 100%);
  box-shadow: 0 12px 24px rgba(22, 119, 255, 0.26);
}

.compare__badge {
  display: inline-flex;
  padding: 2px 10px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.22);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1px;
  backdrop-filter: blur(4px);
}

.compare__visual {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 12px 0 10px;
}

.compare__glyph {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 1px;
}

.compare__card ul {
  position: relative;
  z-index: 1;
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.compare__card li {
  font-size: 11.5px;
  line-height: 1.5;
  opacity: 0.92;
  padding-left: 13px;
  position: relative;
}

.compare__card li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.75);
}

.preview__comment {
  margin-top: 16px;
  padding: 11px 14px;
  border-radius: 10px;
  background: #fffbe6;
  border: 1px solid #ffe58f;
  color: #ad6800;
  font-size: 12.5px;
  display: flex;
  align-items: flex-start;
  gap: 7px;
  line-height: 1.6;
}

.preview__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 70px 20px;
}

.preview__empty h3 {
  margin: 14px 0 0;
  font-size: 16px;
  color: var(--text-main);
}

.preview__empty p {
  margin: 8px 0 0;
  font-size: 12.5px;
  color: var(--text-secondary);
  max-width: 320px;
  line-height: 1.7;
}

.plan-link {
  color: var(--brand);
  cursor: pointer;
  font-weight: 600;
  transition: color 0.2s ease;
}

.plan-link:hover {
  color: var(--brand-dark);
  text-decoration: underline;
}

.panel__head--pad {
  padding: 18px 20px 12px;
}

.approve__plan {
  margin: 0 0 14px;
  padding: 10px 12px;
  border-radius: 9px;
  background: #f5f9ff;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
}

@media (max-width: 1280px) {
  .plan-layout {
    grid-template-columns: 1fr;
  }

  .generator {
    position: static;
  }
}

@media (max-width: 720px) {
  .compare {
    grid-template-columns: 1fr;
  }
}
</style>
