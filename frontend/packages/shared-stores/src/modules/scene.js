/**
 * 场景状态：入住 / 睡眠 / 观影 / 离店一键切换。
 */
import { defineStore } from 'pinia'
import { sceneApi } from '@smart-home/api'
import { useDeviceStore } from './device.js'

export const useSceneStore = defineStore('scene', {
  state: () => ({
    scenes: [],
    loading: false,
    /** 正在执行的场景 id */
    executingId: '',
    lastExecutedId: ''
  }),

  getters: {
    /** 场景数量 */
    count: (state) => state.scenes.length,
    /**
     * 按 code 查找场景。
     * @returns {(code: string) => Object|undefined}
     */
    getByCode: (state) => (code) => state.scenes.find((scene) => scene.code === code)
  },

  actions: {
    /**
     * 加载预置场景。
     */
    async fetchScenes() {
      this.loading = true
      try {
        this.scenes = await sceneApi.getScenes()
        return this.scenes
      } finally {
        this.loading = false
      }
    },

    /**
     * 执行场景：批量更新设备状态并同步到设备 store。
     * @param {string} sceneId 场景 id 或 code
     * @param {string} roomId 房间 id
     * @returns {Promise<Object>}
     */
    async execute(sceneId, roomId) {
      this.executingId = sceneId
      try {
        const result = await sceneApi.executeScene(sceneId, roomId)
        const deviceStore = useDeviceStore()
        deviceStore.applySceneDevices(result.devices)
        this.lastExecutedId = sceneId
        return result
      } finally {
        this.executingId = ''
      }
    }
  }
})
