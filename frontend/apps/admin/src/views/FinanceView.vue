<script setup>
/**
 * 财务对账：
 * - 概览卡片：已开票金额 / 待开票金额 / 发票总数；
 * - 发票表格（订单号、房号、客人、金额、抬头、状态、开票操作）；
 * - 直接调用 financeApi.getInvoices / issueInvoice（无对应 Pinia 模块）。
 */
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { PERMISSION, formatMoney, formatNumber } from '@smart-home/utils'
import { financeApi } from '@smart-home/api'
import { useAuthStore } from '@smart-home/stores'
import PageHeader from '@/components/PageHeader.vue'
import StatCard from '@/components/StatCard.vue'

const auth = useAuthStore()

const loading = ref(false)
const list = ref([])
const allInvoices = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const filters = ref({ status: '', keyword: '' })
const issuingId = ref('')

/** 是否可开票 */
const canIssue = computed(() => auth.can(PERMISSION.B_FINANCE_OPERATE))

/** 概览统计（基于全量发票，不受分页影响） */
const summary = computed(() => {
  const issued = allInvoices.value.filter((item) => item.status === 'issued')
  const pending = allInvoices.value.filter((item) => item.status !== 'issued')
  return {
    issuedAmount: issued.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    pendingAmount: pending.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    total: allInvoices.value.length,
    issuedCount: issued.length,
    pendingCount: pending.length
  }
})

/**
 * 加载发票分页列表。
 * @returns {Promise<void>}
 */
async function loadInvoices() {
  loading.value = true
  try {
    const data = await financeApi.getInvoices({
      page: page.value,
      page_size: pageSize.value,
      status: filters.value.status || undefined,
      keyword: filters.value.keyword.trim() || undefined
    })
    list.value = data.list || []
    total.value = data.total || 0
  } catch (error) {
    ElMessage.error(error.message || '发票列表加载失败')
  } finally {
    loading.value = false
  }
}

/**
 * 加载全量发票用于概览统计。
 * @returns {Promise<void>}
 */
async function loadSummary() {
  try {
    const data = await financeApi.getInvoices({ page: 1, page_size: 100 })
    allInvoices.value = data.list || []
  } catch (error) {
    console.warn('[finance] 汇总数据加载失败:', error.message)
  }
}

/**
 * 搜索（回到第一页）。
 */
function handleSearch() {
  page.value = 1
  loadInvoices()
}

/**
 * 重置筛选。
 */
function resetFilters() {
  filters.value = { status: '', keyword: '' }
  page.value = 1
  loadInvoices()
}

/**
 * 分页大小变化。
 * @param {number} size
 */
function handleSizeChange(size) {
  pageSize.value = size
  page.value = 1
  loadInvoices()
}

/**
 * 开具发票。
 * @param {Object} invoice
 * @returns {Promise<void>}
 */
async function issueInvoice(invoice) {
  if (!invoice || issuingId.value) return
  if (!canIssue.value) {
    ElMessage.warning('当前角色无开票权限')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认开具发票？订单 ${invoice.order_no} · 金额 ${formatMoney(invoice.amount)} · 抬头「${invoice.title}」。`,
      '开具发票',
      { confirmButtonText: '确认开票', cancelButtonText: '取消', type: 'warning' }
    )
  } catch (error) {
    return
  }

  issuingId.value = invoice.id
  try {
    const updated = await financeApi.issueInvoice(invoice.id)
    const index = list.value.findIndex((item) => item.id === invoice.id)
    if (index >= 0) list.value[index] = { ...list.value[index], ...updated }
    await loadSummary()
    ElMessage.success(`发票开具成功（${updated.issued_at}）`)
  } catch (error) {
    ElMessage.error(error.message || '开票失败')
  } finally {
    issuingId.value = ''
  }
}

onMounted(async () => {
  await Promise.all([loadInvoices(), loadSummary()])
})
</script>

<template>
  <div class="page">
    <PageHeader
      title="财务对账"
      icon="Money"
      desc="已完成订单的发票开具与对账管理，支持按状态 / 订单号 / 客人检索"
    >
      <template #actions>
        <el-button :loading="loading" @click="loadInvoices">
          <el-icon><Refresh /></el-icon>
          <span>刷新</span>
        </el-button>
      </template>
    </PageHeader>

    <!-- 概览 -->
    <div class="finance-kpis">
      <StatCard
        label="已开票金额"
        :value="formatMoney(summary.issuedAmount, { digits: 0 })"
        icon="Finished"
        color="#52c41a"
        soft="#f0fbe8"
        :foot="`已开具 ${summary.issuedCount} 张发票`"
      />
      <StatCard
        label="待开票金额"
        :value="formatMoney(summary.pendingAmount, { digits: 0 })"
        icon="Timer"
        color="#fa8c16"
        soft="#fff5e6"
        :foot="`待开票 ${summary.pendingCount} 张，请及时处理`"
      />
      <StatCard
        label="发票总数"
        :value="formatNumber(summary.total)"
        unit="张"
        icon="Document"
        color="#1677ff"
        soft="#e8f1ff"
        :foot="`已开 ${summary.issuedCount} / 待开 ${summary.pendingCount}`"
      />
      <StatCard
        label="开票完成率"
        :value="summary.total ? ((summary.issuedCount / summary.total) * 100).toFixed(0) : '0'"
        unit="%"
        icon="TrendCharts"
        color="#722ed1"
        soft="#f6eeff"
        :foot="`共 ${formatMoney(summary.issuedAmount + summary.pendingAmount, { digits: 0 })} 可开票金额`"
      />
    </div>

    <!-- 筛选 -->
    <section class="panel">
      <div class="filter-bar">
        <el-select v-model="filters.status" placeholder="全部状态" clearable @change="handleSearch">
          <el-option label="已开具" value="issued" />
          <el-option label="待开票" value="pending" />
        </el-select>
        <el-input
          v-model="filters.keyword"
          placeholder="订单号 / 房号 / 客人"
          clearable
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-button type="primary" @click="handleSearch">
          <el-icon><Search /></el-icon>
          <span>查询</span>
        </el-button>
        <el-button @click="resetFilters">
          <el-icon><RefreshLeft /></el-icon>
          <span>重置</span>
        </el-button>
        <span class="filter-bar__spacer" />
        <span class="filter-bar__summary">共<strong>{{ total }}</strong>张发票</span>
      </div>
    </section>

    <!-- 发票表格 -->
    <section class="panel panel--flush">
      <el-table v-loading="loading" :data="list" style="width: 100%" row-key="id">
        <el-table-column label="订单号" min-width="180">
          <template #default="{ row }">
            <span class="code-chip">{{ row.order_no }}</span>
          </template>
        </el-table-column>

        <el-table-column label="房号" width="88">
          <template #default="{ row }">
            <span class="room-no-text">{{ row.room_no }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="guest_name" label="客人" min-width="100" />

        <el-table-column label="金额" width="120" align="right">
          <template #default="{ row }">
            <span class="text-number text-strong">{{ formatMoney(row.amount) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="抬头" min-width="200">
          <template #default="{ row }">
            <div class="flex-col" style="gap: 3px">
              <el-tag size="small" effect="plain" :type="row.title === '企业' ? 'warning' : 'info'">
                {{ row.title }}
              </el-tag>
              <span v-if="row.tax_no" class="mono text-small text-muted">{{ row.tax_no }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.status === 'issued' ? 'success' : 'warning'" effect="light">
              {{ row.status === 'issued' ? '已开具' : '待开票' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="开票时间" width="150">
          <template #default="{ row }">
            <span class="text-small text-muted">{{ row.issued_at || '—' }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status !== 'issued'"
              size="small"
              type="primary"
              :loading="issuingId === row.id"
              :disabled="!canIssue"
              @click="issueInvoice(row)"
            >
              开具发票
            </el-button>
            <span v-else class="text-small text-muted">已完成开票</span>
          </template>
        </el-table-column>

        <template #empty>
          <div class="empty-block">
            <el-icon :size="28" style="color: #b9c6d8"><Document /></el-icon>
            <p>暂无符合条件的发票</p>
          </div>
        </template>
      </el-table>

      <div class="pagination-bar">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @current-change="loadInvoices"
          @size-change="handleSizeChange"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.finance-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.pagination-bar {
  display: flex;
  justify-content: flex-end;
  padding: 14px 18px;
  border-top: 1px solid var(--border-light);
}

.empty-block p {
  margin: 8px 0 0;
}

@media (max-width: 1280px) {
  .finance-kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
