<template>
  <BraceletPage
    default-title="桶珠手串"
    :load-config="loadConfig"
  />
</template>

<script setup>
import BraceletPage from '../../components/BraceletPage.vue'

const loadConfig = async () => {
  const [tongzhu, yaopian] = await Promise.all([
    import('../../materials/tongzhu'),
    import('../../materials/yaopian')
  ])

  const normalize = (module) => {
    if (!module) return {}
    const config = module.default ?? module
    return typeof config === 'object' && config ? config : {}
  }

  return {
    ...normalize(tongzhu),
    ...normalize(yaopian)
  }
}
</script>
