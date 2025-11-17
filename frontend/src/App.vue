<template>
  <view class="app-wrapper">
    <slot />
  </view>
</template>

<script setup></script>

<style lang="scss">
:global(html, body) {
  height: 100%;
  overflow: hidden;
  overscroll-behavior: none;
}

:global(#app) {
  height: 100%;
}

.app-wrapper {
  position: fixed;
  inset: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

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
