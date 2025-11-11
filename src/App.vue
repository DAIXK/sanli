<template>
  <slot />
</template>

<script setup></script>

<style lang="scss">
page {
  min-height: 100%;
  background-color: #f8f9fb;
  color: #1f1f1f;
  font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica,
    'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Arial, sans-serif;
}

::-webkit-scrollbar {
  display: none;
}
</style>
