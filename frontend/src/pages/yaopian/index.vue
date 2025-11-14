<template>
  <BraceletPage
    default-title="药片珠手串"
    :load-config="loadConfig"
    :swipe-routes="{ prev: '/pages/index/index' }"
  />
</template>

<script setup>
import BraceletPage from '../../components/BraceletPage.vue'

const loadConfig = () =>
  import('../../materials/yaopian').then((module) => module.default || module)
</script>
