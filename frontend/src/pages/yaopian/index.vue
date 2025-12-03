<template>
  <BraceletPage
    default-title="4*6手串"
    :load-config="loadConfig"
    :swipe-routes="{ prev: '/pages/index/index' }"
  />
</template>

<script setup>
import BraceletPage from '../../components/BraceletPage.vue'
import { loadBraceletMaterials } from '../../utils/materialApi'

const loadConfig = () => loadBraceletMaterials()
</script>
