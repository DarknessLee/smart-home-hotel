/**
 * 客房 / 房态状态。
 *
 * 注意：房态变更必须通过 actions（对应 PATCH /rooms/:id/status），
 * Mock 阶段后端状态与前端 Pinia 保持同源，避免刷新后不一致。
 */
import { defineStore } from 'pinia'
import { roomApi } from '@smart-home/api'
import {
  ROOM_STATUS,
  ROOM_STATUS_LABEL,
  ROOM_STATUS_COLOR,
  ROOM_STATUS_LEGEND
} from '@smart-home/utils'

export const useRoomStore = defineStore('room', {
  state: () => ({
    stores: [],
    roomTypes: [],
    rooms: [],
    availability: [],
    current: null,
    loading: false,
    updatingId: ''
  }),

  getters: {
    /** 按楼层分组（房态图使用） */
    roomsByFloor: (state) => {
      /** @type {Array<{ floor: number, rooms: Array<Object> }>} */
      const floors = []
      const sorted = state.rooms.slice().sort((a, b) => a.room_no.localeCompare(b.room_no))
      sorted.forEach((room) => {
        let group = floors.find((item) => item.floor === room.floor)
        if (!group) {
          group = { floor: room.floor, rooms: [] }
          floors.push(group)
        }
        group.rooms.push(room)
      })
      return floors.sort((a, b) => a.floor - b.floor)
    },
    /** 各房态数量 */
    statusCounts: (state) => {
      /** @type {Record<string, number>} */
      const counts = {}
      Object.values(ROOM_STATUS).forEach((status) => {
        counts[status] = state.rooms.filter((room) => room.status === status).length
      })
      return counts
    },
    /** 图例 */
    legend: (state) => {
      const counts = state.statusCounts
      return ROOM_STATUS_LEGEND.map((item) => ({ ...item, count: counts[item.status] || 0 }))
    },
    /** 可售房间 */
    vacantRooms: (state) => state.rooms.filter((room) => room.status === ROOM_STATUS.VACANT_READY),
    /** 已入住房间 */
    occupiedRooms: (state) => state.rooms.filter((room) => room.status === ROOM_STATUS.OCCUPIED),
    /** 当前房间设备（详情接口返回） */
    currentDevices: (state) => (state.current && state.current.devices) || []
  },

  actions: {
    /**
     * 加载门店列表。
     */
    async fetchStores() {
      const stores = await roomApi.getStores()
      this.stores = stores
      return stores
    },

    /**
     * 加载房型列表。
     * @param {{ store_id?: string }} [params]
     */
    async fetchRoomTypes(params = {}) {
      const types = await roomApi.getRoomTypes(params)
      this.roomTypes = types
      return types
    },

    /**
     * 按日期加载房型可售数量。
     * @param {{ check_in_time?: string, check_out_time?: string }} [params]
     */
    async fetchAvailability(params = {}) {
      const data = await roomApi.getAvailability(params)
      this.availability = data.list || []
      return this.availability
    },

    /**
     * 加载房态列表。
     * @param {{ status?: string, keyword?: string, floor?: number|string, store_id?: string }} [params]
     */
    async fetchRooms(params = {}) {
      this.loading = true
      try {
        const data = await roomApi.getRooms(params)
        this.rooms = data.list || []
        return data
      } finally {
        this.loading = false
      }
    },

    /**
     * 房间详情。
     * @param {string} id
     */
    async fetchRoom(id) {
      this.loading = true
      try {
        this.current = await roomApi.getRoom(id)
        return this.current
      } finally {
        this.loading = false
      }
    },

    /**
     * 就地更新列表中的房间。
     * @param {Object} room
     */
    upsertRoom(room) {
      if (!room) return
      const index = this.rooms.findIndex((item) => item.id === room.id)
      if (index >= 0) this.rooms[index] = { ...this.rooms[index], ...room }
      if (this.current && this.current.id === room.id) {
        this.current = { ...this.current, ...room }
      }
    },

    /**
     * 修改房态（前台操作）。
     * @param {string} id 房间 id
     * @param {string} status 目标房态
     * @returns {Promise<Object>}
     */
    async changeStatus(id, status) {
      this.updatingId = id
      try {
        const room = await roomApi.updateRoomStatus(id, status)
        this.upsertRoom(room)
        return room
      } finally {
        this.updatingId = ''
      }
    },

    /**
     * 保洁完成。
     * @param {string} id
     */
    async cleanRoom(id) {
      this.updatingId = id
      try {
        const room = await roomApi.cleanRoom(id)
        this.upsertRoom(room)
        return room
      } finally {
        this.updatingId = ''
      }
    },

    /**
     * 标记维修。
     * @param {string} id
     */
    async markMaintenance(id) {
      this.updatingId = id
      try {
        const room = await roomApi.setMaintenance(id)
        this.upsertRoom(room)
        return room
      } finally {
        this.updatingId = ''
      }
    },

    /**
     * 房态文案与颜色快捷方法（模板中使用）。
     * @param {string} status
     * @returns {{ label: string, color: string }}
     */
    statusMeta(status) {
      return {
        label: ROOM_STATUS_LABEL[status] || status,
        color: ROOM_STATUS_COLOR[status] || '#8C8C8C'
      }
    }
  }
})
