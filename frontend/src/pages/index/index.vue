<template>
  <BraceletPage
    default-title="7*8手串"
    :load-config="loadConfig"
  />
</template>

<script setup>
import BraceletPage from '../../components/BraceletPage.vue'
import { loadBraceletMaterials } from '../../utils/materialApi'

const loadConfig = () => loadBraceletMaterials()
</script>
