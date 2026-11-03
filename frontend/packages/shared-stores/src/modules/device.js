/**
 * 房间设备状态（C 端控制面板核心）。
 *
 * 交互策略：点击开关先本地乐观更新（即时变色），
 * 接口失败再回滚，保证「设备控制面板点击立刻生效」的体验。
 */
import { defineStore } from 'pinia'
import { deviceApi } from '@smart-home/api'
import { DEVICE_TYPE, DEVICE_TYPE_LABEL, DEVICE_ONLINE_STATUS } from '@smart-home/utils'

export const useDeviceStore = defineStore('device', {
  state: () => ({
    devices: [],
    loading: false,
    /** 正在下发的设备 id（用于按钮 loading） */
    pendingId: '',
    lastSyncedAt: '',
    error: ''
  }),

  getters: {
    /** id -> device 映射 */
    deviceMap: (state) => {
      /** @type {Record<string, Object>} */
      const map = {}
      state.devices.forEach((device) => {
        map[device.id] = device
      })
      return map
    },
    /** 按类型分组 */
    groupedByType: (state) => {
      /** @type {Record<string, Array<Object>>} */
      const groups = {}
      Object.values(DEVICE_TYPE).forEach((type) => {
        groups[type] = state.devices.filter((device) => device.type === type)
      })
      return groups
    },
    /** 在线设备数量 */
    onlineCount: (state) =>
      state.devices.filter((device) => device.online_status === DEVICE_ONLINE_STATUS.ONLINE).length,
    /** 开启中的设备数量 */
    powerOnCount: (state) =>
      state.devices.filter((device) => Boolean(device.properties && device.properties.power)).length,
    /** 分组标题 */
    typeLabels: () => DEVICE_TYPE_LABEL
  },

  actions: {
    /**
     * 加载某房间设备。
     * @param {string} roomId
     */
    async fetchDevices(roomId) {
      this.loading = true
      this.error = ''
      try {
        const devices = await deviceApi.getDevices({ room_id: roomId })
        this.devices = Array.isArray(devices) ? devices : devices.list || []
        this.lastSyncedAt = new Date().toISOString()
        return this.devices
      } catch (error) {
        this.error = error.message || '设备加载失败'
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * 合并单台设备（接口回写）。
     * @param {Object} device
     */
    upsertDevice(device) {
      if (!device) return
      const index = this.devices.findIndex((item) => item.id === device.id)
      if (index >= 0) this.devices[index] = { ...this.devices[index], ...device }
      else this.devices.push(device)
    },

    /**
     * 更新单个属性（乐观更新 + 失败回滚）。
     * @param {string} deviceId
     * @param {string} key 属性名
     * @param {*} value 属性值
     * @returns {Promise<Object>}
     */
    async updateProperty(deviceId, key, value) {
      const device = this.devices.find((item) => item.id === deviceId)
      if (!device || !device.properties) return null
      const previous = device.properties[key]
      this.pendingId = deviceId
      // 乐观更新：立即变色 / 生效
      device.properties = { ...device.properties, [key]: value }
      try {
        const updated = await deviceApi.updateProperties(deviceId, { [key]: value })
        this.upsertDevice(updated)
        return updated
      } catch (error) {
        // 回滚
        device.properties = { ...device.properties, [key]: previous }
        this.error = error.message || '设备指令下发失败'
        throw error
      } finally {
        this.pendingId = ''
      }
    },

    /**
     * 批量更新属性（场景执行后同步）。
     * @param {Array<Object>} devices
     */
    applySceneDevices(devices) {
      if (!Array.isArray(devices)) return
      devices.forEach((device) => this.upsertDevice(device))
    },

    /**
     * 房间设备清空（退房 / 切换房间）。
     */
    clear() {
      this.devices = []
      this.lastSyncedAt = ''
      this.error = ''
    }
  }
})
