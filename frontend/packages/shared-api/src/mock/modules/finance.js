/**
 * 财务 Mock 接口（需求文档 2：财务角色对账、发票；4.2.1 财务相关报表）。
 */
import { MockError } from '../helpers.js'
import { db, formatDateTime, paginate } from '../db.js'

/** @type {Array<Object>} */
export const financeMock = [
  {
    method: 'GET',
    path: '/invoices',
    delay: 260,
    /**
     * 发票 / 对账列表。
     * @param {{ query: { page?: string, page_size?: string, status?: string } }} ctx
     */
    handler: ({ query }) => {
      let list = db.invoices.slice()
      if (query.status) list = list.filter((invoice) => invoice.status === query.status)
      if (query.keyword) {
        const keyword = String(query.keyword).toLowerCase()
        list = list.filter((invoice) =>
          [invoice.order_no, invoice.guest_name, invoice.room_no].join(' ').toLowerCase().includes(keyword)
        )
      }
      list.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      return paginate(list, query.page, query.page_size || 10)
    }
  },
  {
    method: 'POST',
    path: '/invoices/:id/issue',
    delay: 500,
    handler: ({ params }) => {
      const invoice = db.invoices.find((item) => item.id === params.id)
      if (!invoice) throw new MockError(404, '发票不存在')
      if (invoice.status === 'issued') throw new MockError(9001, '该发票已开具')
      invoice.status = 'issued'
      invoice.issued_at = formatDateTime(Date.now())
      return invoice
    }
  }
]
