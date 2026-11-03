/**
 * 告警中心 Mock 接口（需求文档 4.2.3：设备离线、SOS 告警处理）。
 */
import { ALARM_STATUS } from '@smart-home/utils'
import { MockError, enrichAlarm, requireUser } from '../helpers.js'
import { db, formatDateTime } from '../db.js'

/** @type {Array<Object>} */
export const alarmMock = [
  {
    method: 'GET',
    path: '/alarms',
    delay: 220,
    handler: ({ query }) => {
      let list = db.alarms.slice()
      if (query.status) list = list.filter((alarm) => alarm.status === query.status)
      if (query.type) list = list.filter((alarm) => alarm.type === query.type)
      if (query.level) list = list.filter((alarm) => alarm.level === query.level)
      list.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      const pending = list.filter((alarm) => alarm.status === ALARM_STATUS.PENDING).length
      return {
        list: list.map((alarm) => enrichAlarm(alarm)),
        total: list.length,
        pending
      }
    }
  },
  {
    method: 'POST',
    path: '/alarms/:id/handle',
    delay: 420,
    /**
     * 处理告警：从待处理列表移除（需求 4.2.3）。
     * @param {{ params: { id: string }, headers: Object }} ctx
     */
    handler: ({ params, headers }) => {
      const alarm = db.alarms.find((item) => item.id === params.id)
      if (!alarm) throw new MockError(404, '告警不存在')
      if (alarm.status === ALARM_STATUS.HANDLED) throw new MockError(7001, '该告警已处理')
      const user = requireUser(headers)
      alarm.status = ALARM_STATUS.HANDLED
      alarm.handled_at = formatDateTime(Date.now())
      alarm.handler = user.real_name || '值班员工'
      return enrichAlarm(alarm)
    }
  }
]
