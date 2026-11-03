<script setup>
/**
 * 403 无权限页面。
 */
import { computed } from 'vue'
import ErrorPage from '@/views/ErrorPage.vue'
import { useAuthStore } from '@smart-home/stores'

const auth = useAuthStore()

const desc = computed(() =>
  auth.isLoggedIn
    ? `当前角色「${auth.roleLabel}」没有访问该页面的权限，侧边栏仅展示有权访问的菜单。`
    : '当前未登录或登录态已失效，请重新选择角色登录。'
)
</script>

<template>
  <ErrorPage code="403" title="无访问权限" :desc="desc" icon="Lock" />
</template>
