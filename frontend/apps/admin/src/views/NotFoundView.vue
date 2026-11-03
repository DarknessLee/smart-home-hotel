<script setup>
/**
 * 404 页面不存在。
 */
import ErrorPage from '@/views/ErrorPage.vue'
</script>

<template>
  <ErrorPage code="404" title="页面不存在" desc="你访问的页面不存在或已被移除，请检查地址是否正确。" icon="Compass" />
</template>
