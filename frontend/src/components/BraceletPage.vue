<template>
  <view class="page" @touchstart="handlePageTouchStart" @touchend="handlePageTouchEnd">
    <!-- <view class="page-title-bar" v-if="showH5Title">
      <text class="page-title-text">{{ pageTitle }}</text>
    </view> -->
    <view class="toolbar">
      <view class="price-block">
        <text class="price-text">¥ {{ formattedPrice }}</text>
        <text class="price-subtitle" v-if="priceSubtitleText">{{ priceSubtitleText }}</text>
      </view>
      <view class="toolbar-actions">
      <button
        class="ghost-button"
        :class="{ 'is-disabled': !canGenerateVideo }"
        :disabled="!canGenerateVideo"
        @tap="handleGenerateVideo"
      >
        生成视频
      </button>
      <!-- <button
        class="ghost-button ghost-button--secondary"
        :class="{ 'is-disabled': !canGenerateVideo || animationRecording }"
        :disabled="!canGenerateVideo || animationRecording"
        @tap="handleGenerateAnimation"
      >
        {{ animationRecording ? '生成中...' : '生成动画' }}
      </button> -->
      </view>
    </view>



    <view class="selector-row">
      <view class="selector-field">
        <text class="selector-label">手围约</text>
        <view class="selector-control selector-control-static">
          <view class="selector-value" style="padding: 10rpx 8rpx;">{{ formattedRingLength }}</view>
        </view>
      </view>
      <view class="selector-field">
        <text class="selector-label">珠径</text>
        <view class="selector-control bead-guide-trigger" @tap="openBeadGuideDrawer">
          <view class="selector-value">{{ beadSizeLabels[selectedBeadSizeIndex] }}</view>
        </view>
      </view>
    </view>

    <view class="viewer-card">
      <!-- #ifdef H5 -->
      <view class="viewer-canvas" ref="canvasRef"></view>
      <!-- #endif -->
      <!-- #ifndef H5 -->
      <canvas
        :id="CANVAS_ID"
        :canvas-id="CANVAS_ID"
        type="webgl"
        class="viewer-canvas"
        ref="canvasRef"
      />
      <!-- #endif -->
      <view class="loading" v-if="loadingText">
        <text>{{ loadingText }}</text>
      </view>
      <view class="viewer-freeze-overlay" v-if="viewerFreezeVisible">
        <image class="viewer-freeze-image" :src="viewerFreezeImage" mode="aspectFit" />
      </view>
    </view>
    <!-- <view class="hand-preview-control">
      <button class="hand-preview-button" @tap="handleHandPreviewToggle">
        {{ handPreviewEnabled ? '隐藏手模' : '手模预览' }}
      </button>
    </view> -->

    <view class="undo-container" v-if="productList.length || showSwipeHint">
      <view class="swipe-hint" v-if="showSwipeHint">
        <text class="swipe-hint-arrow swipe-hint-arrow-left">←</text>
        <text class="swipe-hint-text">空白处左右滑动可切换页面</text>
        <text class="swipe-hint-arrow swipe-hint-arrow-right">→</text>
      </view>
      <button
        v-if="productList.length"
        class="undo-button"
        type="button"
        :class="{ 'is-disabled': !canUndo }"
        :disabled="!canUndo"
        @tap="handleUndo"
      >
        <view class="undo-button-content">
          <text class="undo-icon">↺</text>
          <text class="undo-label">撤销</text>
        </view>
      </button>
    </view>

    <view class="product-carousel" v-if="productList.length">
      <scroll-view
        class="product-scroll"
        scroll-x="true"
        show-scrollbar="false"
        @touchstart.stop="noop"
        @touchmove.stop="noop"
        @touchend.stop="noop"
      >
        <view
          v-for="(item, index) in productList"
          :key="item.glb || index"
          class="product-item"
          :class="{ active: selectedProductIndex === index }"
          @tap="handleProductTap(index)"
        >
          <view class="product-thumb">
            <image
              v-if="item.png"
              class="product-thumb-image"
              :src="item.png"
              mode="aspectFit"
            />
          </view>
          <text class="product-name">{{ item.name }}</text>
        </view>
      </scroll-view>
      <view class="carousel-fade left" v-if="productList.length > 1"></view>
      <view class="carousel-fade right" v-if="productList.length > 1"></view>
      <text class="carousel-hint" v-if="productList.length > 2">滑动查看更多</text>
    </view>
    <view class="onboarding-overlay" v-if="showOnboarding && currentOnboardingStep">
      <view class="onboarding-bubble">
        <text class="bubble-title">{{ currentOnboardingStep.title }}</text>
        <text class="bubble-desc">{{ currentOnboardingStep.desc }}</text>
        <button class="onboarding-button" @tap="handleOnboardingAction">
          {{ onboardingActionText }}
        </button>
      </view>
    </view>
    <view
      class="delete-zone"
      :class="{ 'is-visible': deleteZone.visible, 'is-hovered': deleteZone.hovered }"
      ref="deleteZoneRef"
    >
      <text class="delete-zone-icon">✕</text>
      <text class="delete-zone-text">{{ deleteZone.hovered ? '松手删除' : '拖到这里删除' }}</text>
    </view>
    <view class="bead-guide-overlay" v-if="beadGuideDrawerVisible">
      <view class="bead-guide-mask" @tap="closeBeadGuideDrawer"></view>
      <view class="bead-guide-panel">
        <view class="bead-guide-handle"></view>
        <view class="bead-guide-header">
          <text class="bead-guide-title">珠径说明</text>
          <button type="button" class="bead-guide-close" @tap="closeBeadGuideDrawer">
            <text class="bead-guide-close-icon">✕</text>
          </button>
        </view>
        <image class="bead-guide-illustration" :src="beadGuideImageUrl" mode="widthFix" />
        <scroll-view scroll-y class="bead-guide-content">
          <view
            class="bead-guide-section"
            v-for="(section, sectionIndex) in beadGuideSections"
            :key="section.title || sectionIndex"
          >
            <text class="bead-guide-section-title">{{ section.title }}</text>
            <text
              v-for="(line, lineIndex) in section.lines"
              :key="lineIndex"
              class="bead-guide-line"
            >
              {{ line }}
            </text>
          </view>
        </scroll-view>
        <button class="bead-guide-confirm" @tap="closeBeadGuideDrawer">我知道了</button>
      </view>
    </view>
    <!-- <view class="animation-modal" v-if="animationModalVisible">
      <view class="animation-mask" @tap="closeAnimationModal"></view>
      <view class="animation-panel">
        <text class="animation-title">生成动画预览</text>
        <video
          v-if="animationVideoUrl"
          class="animation-video"
          :src="animationVideoUrl"
          controls
          autoplay
          loop
        ></video>
        <button class="animation-close" @tap="closeAnimationModal">关闭</button>
      </view>
    </view> -->
  </view>
</template>

<script setup>
import {
  computed,
  getCurrentInstance,
  markRaw,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  toRaw,
  watch
} from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
//可按 “radial/tangent/normal” 三种轴向做世界坐标旋转

const props = defineProps({
  loadConfig: {
    type: Function,
    required: true
  },
  defaultTitle: {
    type: String,
    default: '定制手串'
  },
  swipeRoutes: {
    type: Object,
    default: () => ({})
  }
})
const normalizeCollection = (collection) => (Array.isArray(collection) ? collection : [])
const transformMaterialEntry = (entry = {}) => ({
  ...entry,
  price: Number(entry.price) || 0,
  background: normalizeCollection(entry.background).map((item) => ({
    ...item,
    glb: item.glb || '',
    png: item.png || ''
  })),
  product: normalizeCollection(entry.product).map((item) => ({
    ...item,
    glb: item.glb || '',
    png: item.png || ''
  }))
})
const transformMaterialConfig = (config = {}) =>
  Object.entries(config || {}).reduce((acc, [id, entry]) => {
    if (entry && typeof entry === 'object') {
      acc[id] = transformMaterialEntry(entry)
    }
    return acc
  }, {})
const materialConfig = ref({})
const price = ref(0)
const accessoryPrice = ref(0)
const goldWeight = ref(0)
const formatCurrencyText = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '-'
  }
  return numeric.toLocaleString('zh-CN')
}
const formattedPrice = computed(() => formatCurrencyText(price.value))
const formattedAccessoryPrice = computed(() => formatCurrencyText(accessoryPrice.value))
const formatWeightText = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return ''
  const rounded = Math.round(numeric * 100) / 100
  const fixed = rounded.toFixed(2)
  return fixed.replace(/\.?0+$/, '')
}
const formattedGoldWeight = computed(() => formatWeightText(goldWeight.value))
const hasGoldWeightInfo = computed(() => {
  const numeric = Number(goldWeight.value)
  return Number.isFinite(numeric) && numeric > 0
})
const hasAccessoryPrice = computed(() => Number(accessoryPrice.value) > 0)
const priceSubtitleText = computed(() => {
  const segments = []
  if (hasAccessoryPrice.value) {
    segments.push(`辅材珠¥${formattedAccessoryPrice.value}`)
  }
  if (hasGoldWeightInfo.value) {
    segments.push(`金约${formattedGoldWeight.value}克`)
  }
  return segments.join('，')
})

const braceletTypes = computed(() => {
  const config = materialConfig.value || {}
  return Object.entries(config).map(([id, entry]) => ({
    id,
    ...entry,
    background: Array.isArray(entry?.background) ? entry.background : [],
    product: Array.isArray(entry?.product) ? entry.product : []
  }))
})
const selectedBraceletIndex = ref(0)
const selectedProductIndex = ref(0)
const selectedBeadSizeIndex = ref(0)

const applyMaterialConfig = (config) => {
  const normalized = transformMaterialConfig(config)
  materialConfig.value = normalized
  selectedBraceletIndex.value = 0
  selectedBeadSizeIndex.value = 0
  selectedProductIndex.value = 0
}
const loadMaterials = async () => {
  if (typeof props.loadConfig !== 'function') {
    applyMaterialConfig({})
    return
  }
  try {
    const data = await props.loadConfig()
    if (data && typeof data === 'object') {
      applyMaterialConfig(data)
    }
  } catch (error) {
    console.error('加载素材配置失败', error)
    applyMaterialConfig({})
    if (typeof uni !== 'undefined' && typeof uni.showToast === 'function') {
      uni.showToast({
        title: '素材配置加载失败',
        icon: 'none'
      })
    }
  }
}

const activeBracelet = computed(() => {
  const list = braceletTypes.value
  return list[selectedBraceletIndex.value] || list[0] || { background: [], product: [] }
})
const activeBraceletName = computed(() => activeBracelet.value?.name || '')
const braceletProgress = computed(() => {
  const list = braceletTypes.value
  if (list.length <= 1) return ''
  return `${selectedBraceletIndex.value + 1}/${list.length}`
})
const backgroundOptions = computed(() => activeBracelet.value?.background ?? [])
const activeBackgroundEntry = computed(() => backgroundOptions.value[0] || null)
const lengthCmToRadius = (length) => {
  const numeric = Number(length)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  const meters = numeric / 100
  return meters / (2 * Math.PI)
}
const deriveRadius = (length, fallback) => {
  const converted = lengthCmToRadius(length)
  if (Number.isFinite(converted) && converted > 0) {
    return Math.max(converted, MIN_RING_RADIUS)
  }
  return Math.max(fallback || MIN_RING_RADIUS, MIN_RING_RADIUS)
}
const modelUrl = computed(() => activeBackgroundEntry.value?.glb || '')
const activeBraceletMaxBeads = computed(() => {
  const max = Number(activeBackgroundEntry.value?.max)
  if (Number.isFinite(max) && max > 0) {
    return Math.floor(max)
  }
  return Infinity
})
const canAddMoreMarbles = computed(() => marbleCount.value < activeBraceletMaxBeads.value)
const CANVAS_ID = 'modelCanvas'

const parseWidthToDiameter = (width) => {
  if (typeof width === 'number') {
    return width / 1000
  }
  if (typeof width !== 'string') return null
  const match = width.match(/[\d.]+/)
  if (!match) return null
  const value = Number(match[0])
  if (!Number.isFinite(value)) return null
  if (width.includes('cm')) {
    return value / 100
  }
  return value / 1000
}

const rawProductList = computed(() => activeBracelet.value?.product ?? [])
const beadSizeOptions = computed(() => {
  const map = new Map()
  rawProductList.value.forEach((product) => {
    const widthLabel = product.width || product.diameter
    if (!widthLabel || map.has(widthLabel)) return
    map.set(widthLabel, {
      label: widthLabel,
      value: widthLabel,
      diameter: parseWidthToDiameter(widthLabel)
    })
  })
  if (!map.size) {
    return [
      {
        label: '4mm',
        value: '4mm',
        diameter: 0.004
      }
    ]
  }
  return Array.from(map.values())
})
const beadSizeLabels = computed(() => beadSizeOptions.value.map((item) => item.label))
const activeBeadOption = computed(
  () => beadSizeOptions.value[selectedBeadSizeIndex.value] || beadSizeOptions.value[0] || null
)

const extractUnitCmFromName = (text) => {
  if (!text || typeof text !== 'string') return null
  const match = text.match(/(\d+(\.\d+)?)/)
  if (!match) return null
  const numeric = Number(match[1])
  if (!Number.isFinite(numeric)) return null
  if (text.toLowerCase().includes('cm')) {
    return numeric
  }
  return numeric / 10
}

const activeBeadUnitCm = computed(() => {
  const backgroundUnit = extractUnitCmFromName(activeBackgroundEntry.value?.name)
  if (Number.isFinite(backgroundUnit) && backgroundUnit > 0) {
    return backgroundUnit
  }
  const widthSource =
    activeProduct.value?.width || activeBeadOption.value?.width || activeBackgroundEntry.value?.width
  const parsedWidth = parseWidthToDiameter(widthSource)
  if (Number.isFinite(parsedWidth) && parsedWidth > 0) {
    return parsedWidth * 100
  }
  const fallbackDiameter = marbleBounds.diameter
  if (Number.isFinite(fallbackDiameter) && fallbackDiameter > 0) {
    return fallbackDiameter * 100
  }
  return 0
})

const computedRingLengthCm = computed(() => {
  layoutVersion.value
  const unitCm = activeBeadUnitCm.value
  if (Number.isFinite(unitCm) && unitCm > 0) {
    return Number((unitCm * marbleInstances.length).toFixed(2))
  }
  if (!marbleInstances.length) {
    return 0
  }
  const totalDiameter = marbleInstances.reduce((sum, marble) => {
    const diameter = getMarbleDiameter(marble)
    return sum + (Number.isFinite(diameter) && diameter > 0 ? diameter : 0)
  }, 0)
  return totalDiameter * 100
})

const formattedRingLength = computed(() => `${computedRingLengthCm.value.toFixed(1)} cm`)
const productList = computed(() => {
  const targetWidth = activeBeadOption.value?.value
  const list = rawProductList.value
  if (!targetWidth) return list
  const filtered = list.filter((item) => (item.width || item.diameter) === targetWidth)
  return filtered.length ? filtered : list
})
const activeProduct = computed(() => productList.value[selectedProductIndex.value] || {})
const activeProductGlb = computed(() => activeProduct.value?.glb || '')
const DEFAULT_FACE_ROTATION = (3 * Math.PI) / 2
const activeProductRotation = computed(() => {
  const rotation = Number(activeProduct.value?.rotation)
  return Number.isFinite(rotation) ? rotation : DEFAULT_FACE_ROTATION
})
const activeProductRotationAxis = computed(() => {
  const axis = activeProduct.value?.rotationAxis
  return ['radial', 'tangent', 'normal'].includes(axis) ? axis : 'radial'
})

const isH5 = typeof window !== 'undefined' && typeof document !== 'undefined'

const loadWeixinJSSDK = (() => {
  const JSSDK_URL = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js'
  let scriptPromise = null
  return () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return Promise.resolve(null)
    }
    if (window.wx && window.wx.miniProgram) {
      return Promise.resolve(window.wx)
    }
    if (scriptPromise) {
      return scriptPromise
    }
    scriptPromise = new Promise((resolve, reject) => {
      const selector = 'script[data-weixin-jssdk]'
      const existing =
        document.querySelector(selector) ||
        document.querySelector(`script[src="${JSSDK_URL}"]`)
      const handleLoad = (event) => {
        event?.currentTarget?.setAttribute?.('data-weixin-loaded', 'true')
        resolve(window.wx || null)
      }
      const handleError = (error) => {
        scriptPromise = null
        reject(error || new Error('微信 JS-SDK 加载失败'))
      }
      if (existing) {
        const loaded =
          existing.getAttribute('data-weixin-loaded') === 'true' ||
          existing.readyState === 'complete'
        if (loaded) {
          resolve(window.wx || null)
          return
        }
        existing.addEventListener('load', handleLoad, { once: true })
        existing.addEventListener('error', handleError, { once: true })
        return
      }
      const script = document.createElement('script')
      script.src = JSSDK_URL
      script.async = true
      script.setAttribute('data-weixin-jssdk', 'true')
      script.addEventListener('load', handleLoad, { once: true })
      script.addEventListener('error', handleError, { once: true })
      document.head.appendChild(script)
    })
    return scriptPromise
  }
})()

if (isH5) {
  loadWeixinJSSDK().catch((error) => {
    console.warn('微信 JS-SDK 引入失败', error)
  })
}

const canvasRef = ref(null)
const deleteZoneRef = ref(null)
const loadingText = ref('加载模型中...')
const marbleLoading = ref(false)
const marbleCount = ref(0)
const layoutVersion = ref(0)
const sceneReady = ref(false)
const marbleLimit = ref(Infinity)
const canGenerateVideo = computed(() => marbleCount.value > 0)
const deleteZone = reactive({
  visible: false,
  hovered: false
})
const selectProduct = (index) => {
  const list = productList.value
  if (!Array.isArray(list) || !list.length) return
  if (!Number.isInteger(index)) return
  const clamped = Math.min(Math.max(index, 0), list.length - 1)
  selectedProductIndex.value = clamped
}
const handleProductTap = async (index) => {
  selectProduct(index)
  await handleAddMarble()
}
const handleBeadSizeChange = (event) => {
  const idx = Number(event?.detail?.value)
  if (Number.isNaN(idx)) return
  selectedBeadSizeIndex.value = idx
}
const SWIPE_THRESHOLD = 120
const swipeState = {
  startX: 0,
  startY: 0,
  active: false
}
const viewerSwipeLock = {
  active: false,
  releaseTimer: null
}
const sleep = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms))
const onboardingSteps = [
  {
    title: '长按珠子可换位置',
    desc: '按住珠子 3 秒后可拖动到任意位置，或拖到底部删除'
  },
  {
    title: '左右滑动空白区域',
    desc: '在空白区域左右滑动可切换其他手串款式'
  }
]
const showOnboarding = ref(false)
const onboardingStep = ref(0)
const currentOnboardingStep = computed(() => onboardingSteps[onboardingStep.value] || null)
const onboardingActionText = computed(() =>
  onboardingStep.value < onboardingSteps.length - 1 ? '下一步' : '我知道了'
)
const shouldShowOnboarding = () => true
const recordOnboardingSeen = () => {}
const dismissOnboarding = () => {
  showOnboarding.value = false
  recordOnboardingSeen()
  onboardingStep.value = 0
  handleSwipeHintAcknowledge()
}
const handleOnboardingAction = () => {
  const nextStep = onboardingStep.value + 1
  if (nextStep < onboardingSteps.length) {
    onboardingStep.value = nextStep
    return
  }
  dismissOnboarding()
}

const beadGuideSections = Object.freeze([
  {
    title: '关于测量手围和如何选择长度',
    lines: ['实测手围 + 3cm = 需要长度', '比如：实测 14 + 3 = 17cm，就选 17cm 长度']
  },
  {
    title: '关于珠子材质与尺寸说明',
    lines: [
      '1. 7*8 mm 金珠喷砂 约 2.5g',
      '2. 7*8 mm 金珠镶红锆石 约 2.5g',
      '3. 7*8 mm 巴西红碧玉 （天然）',
      '4. 7*8 mm 白玛瑙 （人工优化）',
      '5. 7*8 mm 黑玛瑙 （人工优化）',
      '6. 7*8 mm 仿青金石 （人工合成）',
      '7. 7*8 mm 虎眼石 （天然）',
      '8. 7*8 mm 金耀石 （天然）',
      '9. 7*8 mm 非洲翠 （天然）'
    ]
  }
])
const HAND_MODEL_URL = '/static/models/手模1mm.gltf'
const beadGuideDrawerVisible = ref(false)
const beadGuideImageUrl = new URL('../../static/img/shou.jpg', import.meta.url).href
const openBeadGuideDrawer = () => {
  beadGuideDrawerVisible.value = true
}
const closeBeadGuideDrawer = () => {
  beadGuideDrawerVisible.value = false
}
const animationRecording = ref(false)
const animationModalVisible = ref(false)
const animationVideoUrl = ref('')
const closeAnimationModal = () => {
  animationModalVisible.value = false
  if (animationVideoUrl.value) {
    URL.revokeObjectURL(animationVideoUrl.value)
    animationVideoUrl.value = ''
  }
}
const viewerFreezeVisible = ref(false)
const viewerFreezeImage = ref('')
const showViewerFreeze = () => {
  if (!canvasElement || typeof canvasElement.toDataURL !== 'function') {
    viewerFreezeVisible.value = false
    viewerFreezeImage.value = ''
    return false
  }
  try {
    const dataUrl = canvasElement.toDataURL('image/png')
    if (dataUrl) {
      viewerFreezeImage.value = dataUrl
      viewerFreezeVisible.value = true
      return true
    }
  } catch (error) {
    console.warn('Capture viewer snapshot failed', error)
  }
  viewerFreezeVisible.value = false
  viewerFreezeImage.value = ''
  return false
}
const hideViewerFreeze = () => {
  viewerFreezeVisible.value = false
  viewerFreezeImage.value = ''
}
const handPreviewEnabled = ref(false)
let handModel = null
let handModelPromise = null
const loadHandModel = () => {
  if (handModel) return Promise.resolve(handModel)
  if (handModelPromise) return handModelPromise
  handModelPromise = new Promise((resolve, reject) => {
    const loader = new GLTFLoader()
    loader.load(
      HAND_MODEL_URL,
      (gltf) => {
        const root = gltf.scene || gltf.scenes?.[0]
        if (!root) {
          reject(new Error('手模缺少可用场景'))
          return
        }
        root.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true
            child.receiveShadow = true
          }
        })
        handModel = root
        resolve(root)
      },
      undefined,
      (error) => reject(error)
    )
  })
  return handModelPromise
}
const attachHandModelToScene = async () => {
  if (!handPreviewEnabled.value) return
  if (!scene) return
  try {
    const model = await loadHandModel()
    if (!scene) return
    model.removeFromParent?.()
    scene.add(model)
    model.visible = true
  } catch (error) {
    console.warn('无法加载手模', error)
  }
}
const detachHandModelFromScene = () => {
  handModel?.removeFromParent?.()
}
const handleHandPreviewToggle = async () => {
  if (!sceneReady.value || !scene) {
    if (typeof uni !== 'undefined' && typeof uni.showToast === 'function') {
      uni.showToast({
        title: '场景尚未准备好',
        icon: 'none'
      })
    }
    return
  }
  if (handPreviewEnabled.value) {
    handPreviewEnabled.value = false
    detachHandModelFromScene()
    return
  }
  try {
    const model = await loadHandModel()
    if (!scene) return
    model.removeFromParent?.()
    scene.add(model)
    model.visible = true
    handPreviewEnabled.value = true
  } catch (error) {
    console.error('手模加载失败', error)
    if (typeof uni !== 'undefined' && typeof uni.showToast === 'function') {
      uni.showToast({
        title: '手模加载失败',
        icon: 'none'
      })
    }
  }
}

const getMiniProgramBridge = () => {
  if (typeof window === 'undefined') return null
  const bridge = window.wx?.miniProgram

  return bridge || null
}

const navigatedByMiniProgramBridge = (url) => {
  if (!url) return false
  const bridge = getMiniProgramBridge()
  const targetUrl = typeof url === 'string' ? url : ''
  if (!bridge || typeof bridge.navigateTo !== 'function') {
    return false
  }
  try {
    bridge.navigateTo({ url: targetUrl })
    return true
  } catch (error) {
    console.warn('navigateTo mini program page failed', error)
    return false
  }
}

const sendMessageToMiniProgram = (message) => {
  if (typeof window === 'undefined') return false
  const bridge = getMiniProgramBridge()
  if (!bridge || typeof bridge.postMessage !== 'function') {
    return false
  }
  try {
    bridge.postMessage({ data: message || {} })
    return true
  } catch (error) {
    console.warn('postMessage to WeChat mini program failed', error)
    return false
  }
}

const getH5RouterConfig = () => {
  if (!isH5 || typeof window === 'undefined') return null
  const router = window.__uniConfig?.router
  if (!router || typeof router !== 'object') return null
  const mode = router.mode === 'history' ? 'history' : 'hash'
  const base =
    typeof router.base === 'string' && router.base.trim()
      ? router.base.trim()
      : '/'
  return { mode, base }
}

const isHistoryRouting = () => {
  const config = getH5RouterConfig()
  if (config) return config.mode === 'history'
  if (typeof __UNI_FEATURE_ROUTER_MODE__ !== 'undefined') {
    return String(__UNI_FEATURE_ROUTER_MODE__).replace(/"/g, '') === 'history'
  }
  return false
}

const buildHistoryUrl = (url) => {
  const router = getH5RouterConfig()
  const base = router?.base || '/'
  const normalizedBase = base === '/' ? '' : base.replace(/\/+$/, '')
  const sanitizedBase = normalizedBase
    ? normalizedBase.startsWith('/')
      ? normalizedBase
      : `/${normalizedBase}`
    : ''
  const normalizedPath = url.startsWith('/') ? url : `/${url}`
  return `${sanitizedBase}${normalizedPath}` || '/'
}

const formatRouteUrl = (url) => {
  if (typeof url !== 'string') return ''
  const trimmed = url.trim()
  if (!trimmed) return ''
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}
const swipeHintDismissed = ref(false)
const hasSwipeRouteTargets = computed(() => {
  const prev = formatRouteUrl(props.swipeRoutes?.prev || '')
  const next = formatRouteUrl(props.swipeRoutes?.next || '')
  return Boolean(prev || next)
})
const canSwipeBlankArea = computed(
  () => hasSwipeRouteTargets.value || braceletTypes.value.length > 1
)
const showSwipeHint = computed(() => canSwipeBlankArea.value && !swipeHintDismissed.value)
const handleSwipeHintAcknowledge = () => {
  swipeHintDismissed.value = true
}
const encodeMiniProgramPayload = (data) => {
  if (!data || typeof data !== 'object') return ''
  try {
    return encodeURIComponent(JSON.stringify(data))
  } catch (error) {
    console.warn('encode mini program payload failed', error)
    return ''
  }
}
const buildMiniProgramUrl = (url, data) => {
  const baseUrl = formatRouteUrl(url)
  if (!baseUrl) return ''
  const encoded = encodeMiniProgramPayload(data)
  if (!encoded) return baseUrl
  const separator = baseUrl.includes('?') ? '&' : '?'
  return `${baseUrl}${separator}payload=${encoded}`
}
const buildFallbackUrl = (url) => {
  if (!url) return ''
  if (!isH5) return url
  if (isHistoryRouting()) {
    return buildHistoryUrl(url)
  }
  if (url.startsWith('/#') || url.startsWith('#')) return url
  if (url.startsWith('/')) return `/#${url}`
  return `/#/${url}`
}
const fallbackNavigate = (url) => {
  if (typeof window === 'undefined') return false
  const target = buildFallbackUrl(url)
  if (!target) return false
  try {
    window.location.assign(target)
    if (isH5) {
      setTimeout(() => {
        try {
          window.location.reload()
        } catch (error) {
          console.warn('刷新页面失败', error)
        }
      }, 0)
    }
    return true
  } catch (error) {
    console.warn('浏览器路由跳转失败', error)
    return false
  }
}
const navigateToPage = (direction) => {
  const target =
    direction === 'next' ? props.swipeRoutes?.next : props.swipeRoutes?.prev
  const url = formatRouteUrl(target)
  if (!url) return false
  if (typeof uni !== 'undefined' && typeof uni.navigateTo === 'function') {
    try {
      const result = uni.navigateTo({ url })
      if (result && typeof result.catch === 'function') {
        result.catch((error) => {
          console.warn('页面跳转失败', error)
          fallbackNavigate(url)
        })
      }
      return true
    } catch (error) {
      console.warn('页面跳转失败', error)
      return fallbackNavigate(url)
    }
  }
  return fallbackNavigate(url)
}
const lockViewerSwipe = () => {
  viewerSwipeLock.active = true
  if (viewerSwipeLock.releaseTimer) {
    clearTimeout(viewerSwipeLock.releaseTimer)
    viewerSwipeLock.releaseTimer = null
  }
}
const releaseViewerSwipe = (delay = 80) => {
  if (viewerSwipeLock.releaseTimer) {
    clearTimeout(viewerSwipeLock.releaseTimer)
  }
  viewerSwipeLock.releaseTimer = setTimeout(() => {
    viewerSwipeLock.active = false
    viewerSwipeLock.releaseTimer = null
  }, delay)
}
const switchBracelet = (index) => {
  const list = braceletTypes.value
  if (!list.length) return
  const clamped = clampIndex(index, list.length)
  if (clamped === selectedBraceletIndex.value) return
  selectedBraceletIndex.value = clamped
}
const handlePageTouchStart = (event) => {
  if (viewerSwipeLock.active) {
    swipeState.active = false
    return
  }
  const touch = event?.touches?.[0]
  if (!touch) return
  swipeState.startX = touch.clientX
  swipeState.startY = touch.clientY
  swipeState.active = true
}
const handlePageTouchEnd = (event) => {
  if (viewerSwipeLock.active) {
    swipeState.active = false
    return
  }
  if (!swipeState.active) return
  const touch = event?.changedTouches?.[0]
  if (!touch) {
    swipeState.active = false
    return
  }
  const deltaX = touch.clientX - swipeState.startX
  const deltaY = touch.clientY - swipeState.startY
  if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) < Math.abs(deltaY)) {
    swipeState.active = false
    return
  }
  const direction = deltaX < 0 ? 'next' : 'prev'
  const navigated = navigateToPage(direction)
  if (!navigated) {
    if (direction === 'next') {
      switchBracelet(selectedBraceletIndex.value + 1)
    } else {
      switchBracelet(selectedBraceletIndex.value - 1)
    }
  }
  swipeState.active = false
}
const handleGenerateVideo = () => {
  if (!canGenerateVideo.value) {
    if (typeof uni !== 'undefined' && typeof uni.showToast === 'function') {
      uni.showToast({
        title: '请先添加珠子',
        icon: 'none'
      })
    }
    return
  }
  const baseVideoPageUrl = '/pages/video/index'
  const detailPayload = {
    price: price.value,
    formattedPrice: formattedPrice.value,
    ringSize: formattedRingLength.value,
    beadSize: beadSizeLabels.value[selectedBeadSizeIndex.value] || '',
    braceletId: activeBracelet.value?.id || '',
    braceletName: activeBraceletName.value,
    productName: activeProduct.value?.name || '',
    productId: activeProduct.value?.id || '',
    selectedProductIndex: selectedProductIndex.value,
    marbleCount: marbleCount.value
  }
  const videoPageUrl = buildMiniProgramUrl(baseVideoPageUrl, detailPayload)
  const message = {
    action: 'navigateToVideo',
    payload: { url: videoPageUrl },
    ...detailPayload
  }

  sendMessageToMiniProgram(message)

  if (navigatedByMiniProgramBridge(videoPageUrl)) {
    return
  }

  if (typeof uni !== 'undefined' && typeof uni.showToast === 'function') {
    uni.showToast({
      title: '生成中，请稍候',
      icon: 'none'
    })
    return
  }

  console.info('Generate video triggered', message)
}

const handleGenerateAnimation = async () => {
  if (animationRecording.value) return
  if (!canGenerateVideo.value || !marbleInstances.length) {
    if (typeof uni !== 'undefined' && typeof uni.showToast === 'function') {
      uni.showToast({
        title: '请先添加珠子',
        icon: 'none'
      })
    } else {
      console.info('Nothing to animate')
    }
    return
  }
  if (!isH5) {
    if (typeof uni !== 'undefined' && typeof uni.showToast === 'function') {
      uni.showToast({
        title: '仅支持 H5 录制',
        icon: 'none'
      })
    }
    return
  }
  const freezeShown = showViewerFreeze()
  animationRecording.value = true
  const marbles = marbleInstances.slice()
  const previousVisibility = marbles.map((marble) => marble.visible !== false)
  if (!canvasElement || typeof canvasElement.captureStream !== 'function') {
    if (typeof uni !== 'undefined' && typeof uni.showToast === 'function') {
      uni.showToast({
        title: '当前环境不支持录制',
        icon: 'none'
      })
    } else {
      console.warn('MediaRecorder not supported')
    }
    hideViewerFreeze()
    animationRecording.value = false
    return
  }
  try {
    marbles.forEach((marble) => {
      marble.visible = false
    })
    refreshMarbleLayout()
    await nextTick()
  } catch (error) {
    console.warn('准备录制失败', error)
  }
  const stream = canvasElement.captureStream(30)
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm'
  const recorder = new MediaRecorder(stream, { mimeType })
  const chunks = []
  let recorderStopped = false
  const stopRecorder = () => {
    if (recorderStopped) return
    recorderStopped = true
    try {
      recorder.stop()
    } catch (error) {
      console.warn('Failed to stop recorder', error)
    }
  }
  const recordingPromise = new Promise((resolve, reject) => {
    recorder.onerror = (event) => reject(event?.error || new Error('录制失败'))
    recorder.ondataavailable = (event) => {
      if (event.data?.size) {
        chunks.push(event.data)
      }
    }
    recorder.onstop = () => {
      try {
        const blob = new Blob(chunks, { type: 'video/webm' })
        resolve(blob)
      } catch (error) {
        reject(error)
      }
    }
  })
  recorder.start()
  try {
    await sleep(300)
    for (const marble of marbles) {
      marble.visible = true
      refreshMarbleLayout()
      await sleep(360)
    }
    await sleep(600)
    stopRecorder()
    const blob = await recordingPromise
    marbles.forEach((marble, index) => {
      marble.visible = previousVisibility[index]
    })
    refreshMarbleLayout()
    if (animationVideoUrl.value) {
      URL.revokeObjectURL(animationVideoUrl.value)
    }
    animationVideoUrl.value = URL.createObjectURL(blob)
    animationModalVisible.value = true
  } catch (error) {
    stopRecorder()
    marbles.forEach((marble, index) => {
      marble.visible = previousVisibility[index]
    })
    refreshMarbleLayout()
    console.error('生成动画失败', error)
    if (typeof uni !== 'undefined' && typeof uni.showToast === 'function') {
      uni.showToast({
        title: '生成动画失败',
        icon: 'none'
      })
    }
  } finally {
    stream.getTracks().forEach((track) => track.stop())
    animationRecording.value = false
    if (!freezeShown) {
      hideViewerFreeze()
    } else {
      hideViewerFreeze()
    }
  }
}
const noop = () => {}

const handleUndo = () => {
  if (!undoStack.value.length) {
    if (typeof uni !== 'undefined' && typeof uni.showToast === 'function') {
      uni.showToast({
        title: '暂无可撤销操作',
        icon: 'none'
      })
    } else {
      console.info('No undo actions available')
    }
    return
  }
  const entry = undoStack.value.pop()
  if (!entry) return
  const record = typeof entry === 'object' ? toRaw(entry) : null
  const marble = record?.marble ? toRaw(record.marble) : null
  let success = false
  if (record?.type === 'add') {
    success = marble ? removeMarble(marble, { record: false }) : false
  } else if (record?.type === 'remove') {
    success = marble ? restoreMarble(marble, record.index) : false
  } else if (record?.type === 'swap') {
    const marbleA = record?.marbleA ? toRaw(record.marbleA) : null
    const marbleB = record?.marbleB ? toRaw(record.marbleB) : null
    const result = swapMarbleOrder(marbleA, marbleB)
    success = result.swapped
  } else if (record?.type === 'move') {
    const targetMarble = record?.marble ? toRaw(record.marble) : null
    const originIndex = Number.isInteger(record?.fromIndex) ? record.fromIndex : -1
    if (targetMarble && originIndex >= 0) {
      const result = moveMarbleToIndex(targetMarble, originIndex)
      success = result.moved
    }
  }
  if (!success) {
    undoStack.value.push(entry)
    if (typeof uni !== 'undefined' && typeof uni.showToast === 'function') {
      uni.showToast({
        title: '撤销失败',
        icon: 'none'
      })
    } else {
      console.warn('Undo failed')
    }
    return
  }
  if (typeof uni !== 'undefined' && typeof uni.showToast === 'function') {
    uni.showToast({
      title: '已撤销',
      icon: 'none'
    })
  } else {
    console.info('Undo applied')
  }
}
const raf =
  typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame
    : (cb) => setTimeout(cb, 16)
const caf =
  typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : clearTimeout

let renderer = null
let scene = null
let camera = null
let controls = null
let animationFrameId = null
let resizeTeardown = null
let canvasElement = null
let pmremGenerator = null
let envTexture = null
let ringRoot = null
let ringRootBaseScale = null
let orbitControlsLocked = false
const disableOrbitControls = () => {
  if (orbitControlsLocked) return
  orbitControlsLocked = true
  if (controls) {
    controls.enabled = false
  }
}
const enableOrbitControls = () => {
  if (!orbitControlsLocked) return
  orbitControlsLocked = false
  if (controls) {
    controls.enabled = true
  }
}
const instance = getCurrentInstance()
let supportsUint32Index = true
const marbleTemplateCache = new Map()
const marbleBounds = {
  diameter: 0,
  thickness: 0
}
const productBounds = new Map()
const DRAG_SCALE_MULTIPLIER = 1.12
const DRAG_LIFT_DISTANCE = 0.004
let dragIndicator = null
let lastPointerIntersection = null
const getRingInnerRoot = (root) => root?.userData?.ringInner || root
const updateGlobalBounds = ({ diameter, thickness }) => {
  if (Number.isFinite(diameter) && diameter > 0) {
    marbleBounds.diameter = diameter
  }
  if (Number.isFinite(thickness) && thickness > 0) {
    marbleBounds.thickness = thickness
  }
}
const marbleInstances = []
let marbleInstanceCounter = 0
const ensureMarbleInstanceId = (marble) => {
  if (!marble || typeof marble !== 'object') return null
  if (!marble.userData) {
    marble.userData = {}
  }
  if (!marble.userData.instanceId) {
    marbleInstanceCounter += 1
    marble.userData.instanceId = marbleInstanceCounter
  }
  return marble.userData.instanceId
}
const normalizeNumeric = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
const isGoldProduct = (product) => {
  const type = typeof product?.type === 'string' ? product.type.trim().toLowerCase() : ''
  return type === 'gold'
}
const getProductUnitPrice = (product) => {
  if (!product || typeof product !== 'object') return 0
  const basePrice = normalizeNumeric(product.price, 0)
  if (!basePrice || basePrice <= 0) return 0
  if (isGoldProduct(product)) {
    const weight = normalizeNumeric(product.weight, 1)
    const normalizedWeight = Math.max(weight, 0)
    return basePrice * (normalizedWeight || 0)
  }
  return basePrice
}
const buildBraceletCostSummary = () =>
  marbleInstances.reduce(
    (acc, marble) => {
      const product = marble?.userData?.product
      const unitPrice = getProductUnitPrice(product)
      acc.total += unitPrice
      if (isGoldProduct(product)) {
        const weight = Math.max(normalizeNumeric(product?.weight, 0), 0)
        acc.goldWeight += weight
      } else {
        acc.accessory += unitPrice
      }
      return acc
    },
    { total: 0, accessory: 0, goldWeight: 0 }
  )
const updateBraceletPrice = () => {
  const summary = buildBraceletCostSummary()
  price.value = summary.total > 0 ? summary.total : 0
  accessoryPrice.value = summary.accessory > 0 ? summary.accessory : 0
  goldWeight.value = summary.goldWeight > 0 ? summary.goldWeight : 0
}
const MIN_RING_LENGTH = 14 // cm
const MIN_RING_RADIUS = (MIN_RING_LENGTH / 100) / (2 * Math.PI)
const undoStack = ref([])
const canUndo = computed(() => marbleCount.value > 0 && undoStack.value.length > 0)
const defaultRingRadius = MIN_RING_RADIUS
const ringConfig = {
  radius: defaultRingRadius,
  baseRadius: defaultRingRadius,
  minRadius: defaultRingRadius,
  perRing: 28,
  depthStep: 0.0008,
  layerGap: 0,
  offsetZ: 0,
  bandThickness: 0
}
const ringMetrics = {
  minRadius: Infinity,
  maxRadius: 0
}
const tempVector = new THREE.Vector3()
const axisVectors = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1)
}
const ringOrientation = {
  planeAxes: ['x', 'y'],
  normalAxis: 'z'
}
const defaultPageTitle = computed(() => props.defaultTitle || '定制手串')
const pageTitle = ref(defaultPageTitle.value)
const showH5Title = isH5
const applyPageTitle = (title) => {
  const finalTitle = title || defaultPageTitle.value
  if (typeof document !== 'undefined') {
    document.title = finalTitle
  }
  if (typeof uni !== 'undefined' && typeof uni.setNavigationBarTitle === 'function') {
    try {
      uni.setNavigationBarTitle({ title: finalTitle })
    } catch (error) {
      console.warn('Failed to set navigation title', error)
    }
  }
}
watch(
  pageTitle,
  (title) => {
    applyPageTitle(title)
  },
  { immediate: true }
)
const clampIndex = (index, length) => {
  if (!Number.isInteger(index)) return 0
  if (!Number.isInteger(length) || length <= 0) return 0
  return Math.min(Math.max(index, 0), length - 1)
}
watch(
  defaultPageTitle,
  (title) => {
    pageTitle.value = title
  },
  { immediate: true }
)

const resetMarbles = () => {
  if (scene && marbleInstances.length) {
    marbleInstances.forEach((item) => scene.remove(item))
  }
  marbleInstances.length = 0
  marbleCount.value = 0
  marbleLimit.value = Infinity
  updateBraceletPrice()
  refreshMarbleLayout()
}

let reloadingScene = false
const reloadScene = async () => {
  if (reloadingScene) return
  reloadingScene = true
  try {
    disposeScene()
    await nextTick()
    await initScene()
  } catch (error) {
    console.error('重建场景失败', error)
  } finally {
    reloadingScene = false
  }
}

const tempQuaternion = new THREE.Quaternion()
const setRingOrientationBySize = (size) => {
  const axisInfo = [
    { axis: 'x', length: size.x },
    { axis: 'y', length: size.y },
    { axis: 'z', length: size.z }
  ].sort((a, b) => a.length - b.length)
  ringOrientation.normalAxis = axisInfo[0].axis
  ringOrientation.planeAxes = [axisInfo[1].axis, axisInfo[2].axis]
}
const pointer = new THREE.Vector2()
const LONG_PRESS_DURATION = 650
const LONG_PRESS_MOVE_THRESHOLD = 12
let longPressTimer = null
let pendingMarble = null
const longPressPointer = {
  active: false,
  x: 0,
  y: 0
}
const raycaster = new THREE.Raycaster()
const pointerPlane = new THREE.Plane()
const pointerPlaneOrigin = new THREE.Vector3()
const pointerHitPoint = new THREE.Vector3()
const pointerRelative = new THREE.Vector3()
let pointerTeardown = null
const extractPointerClientPosition = (event) => {
  const source =
    event?.touches?.[0] || event?.changedTouches?.[0] || event?.originalEvent?.touches?.[0] || event
  const clientX = source?.clientX
  const clientY = source?.clientY
  if (typeof clientX !== 'number' || typeof clientY !== 'number') return null
  return { clientX, clientY }
}

const cancelLongPressTimer = () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
  pendingMarble = null
  longPressPointer.active = false
}

const pushUndoEntry = (entry) => {
  if (!entry || typeof entry !== 'object') return
  const normalized = { ...entry }
  ;['marble', 'marbleA', 'marbleB'].forEach((key) => {
    if (normalized[key] && typeof normalized[key] === 'object') {
      const rawMarble = toRaw(normalized[key])
      normalized[key] = rawMarble ? markRaw(rawMarble) : rawMarble
    }
  })
  undoStack.value.push(normalized)
}

const clearUndoHistory = () => {
  undoStack.value.length = 0
}

const getRefElement = () => {
  const target = canvasRef.value
  if (!target) return null
  return target.$el ?? target
}

const resolveCanvasElement = () =>
  new Promise((resolve) => {
    const useIfCanvas = (candidate) => {
      if (candidate && typeof candidate.getContext === 'function') {
        resolve(candidate)
        return true
      }
      return false
    }

    if (isH5) {
      const holder = getRefElement()
      if (holder) {
        const existing =
          typeof holder.querySelector === 'function' ? holder.querySelector('canvas') : null
        if (useIfCanvas(existing)) {
          return
        }
        if (typeof document !== 'undefined') {
          const canvas = document.createElement('canvas')
          canvas.id = CANVAS_ID
          canvas.setAttribute('data-platform', 'h5')
          canvas.style.width = '100%'
          canvas.style.height = '100%'
          canvas.style.display = 'block'
          canvas.style.borderRadius = 'inherit'
          holder.appendChild(canvas)
          useIfCanvas(canvas)
          return
        }
      }
      resolve(null)
      return
    }

    const direct = getRefElement()
    if (useIfCanvas(direct)) return

    if (typeof uni !== 'undefined' && typeof uni.createSelectorQuery === 'function') {
      const query = uni.createSelectorQuery()
      if (typeof query.in === 'function' && instance?.proxy) {
        query.in(instance.proxy)
      }
      query
        .select(`#${CANVAS_ID}`)
        .fields({ node: true, size: true })
        .exec((res) => {
          const target = Array.isArray(res) ? res[0] : res
          if (target && useIfCanvas(target.node)) {
            return
          }
          resolve(null)
        })
      return
    }

    resolve(null)
  })

const getPixelRatio = () => {
  if (typeof uni !== 'undefined' && typeof uni.getSystemInfoSync === 'function') {
    const { pixelRatio = 1 } = uni.getSystemInfoSync()
    return Math.min(pixelRatio, 2)
  }
  if (typeof window !== 'undefined') {
    return Math.min(window.devicePixelRatio || 1, 2)
  }
  return 1
}

const adjustRendererSize = () => {
  if (!renderer || !camera) return
  if (!canvasElement) return
  const rect = canvasElement.getBoundingClientRect
    ? canvasElement.getBoundingClientRect()
    : { width: canvasElement.width, height: canvasElement.height }
  const pixelRatio = getPixelRatio()
  const width = rect.width
  const height = rect.height
  renderer.setPixelRatio(pixelRatio)
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

const observeResize = () => {
  if (!canvasElement) return
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => adjustRendererSize())
    observer.observe(canvasElement)
    resizeTeardown = () => observer.disconnect()
    return
  }

  if (typeof uni !== 'undefined' && typeof uni.onWindowResize === 'function') {
    const handler = () => adjustRendererSize()
    uni.onWindowResize(handler)
    resizeTeardown = () => {
      if (typeof uni.offWindowResize === 'function') {
        uni.offWindowResize(handler)
      }
    }
    return
  }

  if (typeof window !== 'undefined') {
    const handler = () => adjustRendererSize()
    window.addEventListener('resize', handler)
    resizeTeardown = () => window.removeEventListener('resize', handler)
  }
}

const startRenderLoop = () => {
  const render = () => {
    controls?.update?.()
    renderer?.render?.(scene, camera)
    animationFrameId = raf(render)
  }
  render()
}

const addLights = () => {
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1b1b1b, 1.2)
  // scene.add(hemiLight)

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
  dirLight.position.set(5, 10, 7.5)
  // scene.add(dirLight)

  const fillLight = new THREE.PointLight(0x77aaff, 0.4)
  fillLight.position.set(-4, -2, -3)
  // scene.add(fillLight)
}

const loadModel = () => {
  return new Promise((resolve, reject) => {
    const url = modelUrl.value
    if (!url) {
      reject(new Error('未找到手串模型'))
      return
    }
    const loader = new GLTFLoader()
    loader.load(
      url,
      (gltf) => {
        const root = gltf.scene || gltf.scenes?.[0]
        if (!root) {
          reject(new Error('GLTF 中未找到可渲染的场景'))
          return
        }
        const container = new THREE.Group()
        container.name = 'RingWrapper'
        container.add(root)
        container.userData.ringInner = root
        ringRoot = container
        ringRootBaseScale = container.scale.clone()
        root.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true
            child.receiveShadow = true
            if (!supportsUint32Index && child.geometry?.index?.array instanceof Uint32Array) {
              if (!convertIndexToUint16(child.geometry)) {
                reject(new Error('模型索引数量超过 WebGL1 能力，请换用 WebGL2 环境或重新导出模型'))
              }
            }
          }
        })
        scene.add(container)
        resolve(container)
      },
      undefined,
      (error) => reject(error)
    )
  })
}

const fitCameraToModel = (root) => {
  if (!root || !camera || !controls) return
  const actualRoot = getRingInnerRoot(root)
  const boundingBox = new THREE.Box3().setFromObject(actualRoot)
  if (boundingBox.isEmpty()) return

  const size = boundingBox.getSize(new THREE.Vector3())
  const center = boundingBox.getCenter(new THREE.Vector3())

  actualRoot.position.sub(center)
  setRingOrientationBySize(size)
  updateRingMetrics(actualRoot)

  if (!Number.isFinite(ringConfig.radius) || ringConfig.radius <= 0) {
    const fallbackRadius = Math.max(size.x, size.y, size.z) / 2
    if (fallbackRadius > 0) {
      ringConfig.radius = fallbackRadius
    }
  }
  if (!Number.isFinite(ringConfig.bandThickness) || ringConfig.bandThickness <= 0) {
    ringConfig.bandThickness = Math.max(size[ringOrientation.normalAxis] || 0, 0)
  }
  ringConfig.layerGap = Math.max((size[ringOrientation.normalAxis] || 0) * 0.8, 0.0008)
  ringConfig.offsetZ = 0

  const maxDim = Math.max(size.x, size.y, size.z) || 1
  const fitHeightDistance = maxDim / (2 * Math.tan((camera.fov * Math.PI) / 360))
  const fitWidthDistance = fitHeightDistance / camera.aspect
  const distance = Math.max(fitHeightDistance, fitWidthDistance) * 1.3 || 1

  const direction = new THREE.Vector3(1, 0.4, 1).normalize()
  camera.position.copy(direction).multiplyScalar(distance)
  const minNear = 0.01
  const recommendedNear = distance / 100
  const near = Math.min(Math.max(recommendedNear, minNear), Math.max(distance - 0.001, minNear))
  camera.near = near
  camera.far = Math.max(distance * 100, near + 100)
  camera.updateProjectionMatrix()

  controls.target.set(0, 0, 0)
  controls.minDistance = distance * 0.35
  controls.maxDistance = distance * 6
  controls.update()
  ringConfig.baseRadius = ringConfig.radius
  ringConfig.minRadius = Math.max(ringConfig.radius, MIN_RING_RADIUS)
  if (ringRoot) {
    ringRoot.scale.set(1, 1, 1)
    ringRootBaseScale = ringRoot.scale.clone()
  }
}

const createGLContext = () => {
  if (!canvasElement || typeof canvasElement.getContext !== 'function') {
    return null
  }
  const attrs = {
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true
  }
  const get = (...types) => {
    for (const type of types) {
      const ctx = canvasElement.getContext(type, attrs)
      if (ctx) return ctx
    }
    return null
  }

  return get('webgl2', 'experimental-webgl2', 'webgl', 'experimental-webgl')
}

const convertIndexToUint16 = (geometry) => {
  if (!geometry?.index) return true
  const { array } = geometry.index
  if (!(array instanceof Uint32Array)) return true
  let max = 0
  for (let i = 0; i < array.length; i++) {
    if (array[i] > max) max = array[i]
    if (max >= 65535) {
      return false
    }
  }
  const array16 = new Uint16Array(array.length)
  array16.set(array)
  geometry.setIndex(new THREE.BufferAttribute(array16, 1))
  return true
}

const updateRingMetrics = (root) => {
  if (!root) return
  ringMetrics.minRadius = Infinity
  ringMetrics.maxRadius = 0
  const [axisA, axisB] = ringOrientation.planeAxes
  root.updateMatrixWorld(true)
  root.traverse((child) => {
    if (!child.isMesh) return
    const position = child.geometry?.attributes?.position
    if (!position) return
    for (let i = 0; i < position.count; i++) {
      tempVector.fromBufferAttribute(position, i)
      child.localToWorld(tempVector)
      const coordA = tempVector[axisA]
      const coordB = tempVector[axisB]
      const radius = Math.hypot(coordA, coordB)
      if (!Number.isFinite(radius)) continue
      ringMetrics.minRadius = Math.min(ringMetrics.minRadius, radius)
      ringMetrics.maxRadius = Math.max(ringMetrics.maxRadius, radius)
    }
  })
  if (!Number.isFinite(ringMetrics.minRadius) || !Number.isFinite(ringMetrics.maxRadius)) {
    return
  }
  const centerRadius = (ringMetrics.minRadius + ringMetrics.maxRadius) / 2
  ringConfig.radius = centerRadius || ringConfig.radius
  ringConfig.bandThickness = Math.max(ringMetrics.maxRadius - ringMetrics.minRadius, 0)
}

const resolveMarbleFromObject = (object) => {
  let current = object
  while (current && !marbleInstances.includes(current)) {
    current = current.parent
  }
  return current || null
}

const restoreMarble = (marble, index = marbleInstances.length) => {
  if (!scene || !marble) return false
  marble.userData = marble.userData || {}
  marble.userData.isMarbleRoot = true
  ensureMarbleInstanceId(marble)
  const clamped = Math.min(Math.max(index, 0), marbleInstances.length)
  scene.add(marble)
  marbleInstances.splice(clamped, 0, marble)
  marbleCount.value = marbleInstances.length
  marbleLimit.value = Infinity
  updateBraceletPrice()
  refreshMarbleLayout()
  return true
}

const removeMarble = (marble, { record = true } = {}) => {
  if (!marble || !scene) return false
  const target = resolveMarbleFromObject(marble)
  if (!target) return false
  const index = marbleInstances.indexOf(target)
  if (index === -1) return false
  target.removeFromParent?.()
  scene.remove(target)
  marbleInstances.splice(index, 1)
  marbleCount.value = marbleInstances.length
  marbleLimit.value = Infinity
  updateBraceletPrice()
  if (record) {
    pushUndoEntry({ type: 'remove', marble: target, index })
  }
  refreshMarbleLayout()
  return true
}

const reorderState = {
  active: false,
  marble: null,
  sourceIndex: -1,
  insertIndex: -1,
  deleteIntent: false,
  indicatorPosition: null
}

const showDeleteZoneOverlay = () => {
  deleteZone.visible = true
  deleteZone.hovered = false
}

const hideDeleteZoneOverlay = () => {
  deleteZone.visible = false
  deleteZone.hovered = false
}

const ensureMarbleBaseScale = (marble) => {
  if (!marble) return null
  if (!marble.userData.baseScale) {
    marble.userData.baseScale = marble.scale.clone()
  }
  return marble.userData.baseScale
}

const setMarbleDragVisualState = (marble, dragging) => {
  if (!marble) return
  const baseScale = ensureMarbleBaseScale(marble)
  if (baseScale) {
    const multiplier = dragging ? DRAG_SCALE_MULTIPLIER : 1
    marble.scale.set(
      baseScale.x * multiplier,
      baseScale.y * multiplier,
      baseScale.z * multiplier
    )
  }
  marble.userData.dragOffset = dragging ? DRAG_LIFT_DISTANCE : 0
  marble.userData.dragging = dragging
  refreshMarblePlacement(marble)
}

const hideDragIndicator = () => {
  if (dragIndicator) {
    dragIndicator.visible = false
  }
}

const setupDragIndicator = () => {
  if (!scene) return
  if (dragIndicator) {
    scene.add(dragIndicator)
    return
  }
  const geometry = new THREE.SphereGeometry(0.005, 20, 20)
  const material = new THREE.MeshBasicMaterial({
    color: 0xffc53d,
    transparent: true,
    opacity: 0.35,
    depthTest: false,
    depthWrite: false
  })
  dragIndicator = new THREE.Mesh(geometry, material)
  dragIndicator.visible = false
  scene.add(dragIndicator)
}

const updateDragIndicatorDisplay = (position, mode = 'target') => {
  if (!dragIndicator || !position) return
  dragIndicator.visible = true
  dragIndicator.position.copy(position)
  const scale = mode === 'insert' ? 0.8 : 1
  dragIndicator.scale.set(scale, scale, scale)
  const color = mode === 'insert' ? 0x38bdf8 : 0xffc53d
  dragIndicator.material.color.set(color)
  dragIndicator.material.opacity = mode === 'insert' ? 0.45 : 0.35
}

const refreshDragIndicator = () => {
  if (!dragIndicator) return
  if (!reorderState.active || reorderState.deleteIntent) {
    hideDragIndicator()
    return
  }
  if (reorderState.indicatorPosition) {
    updateDragIndicatorDisplay(reorderState.indicatorPosition, 'insert')
    return
  }
  hideDragIndicator()
}

const getMarbleDiameter = (marble) =>
  marble?.userData?.bounds?.diameter || marbleBounds.diameter || 0.004

const getBraceletRadius = () => Math.max(ringConfig.radius, 0.001)

const computeBraceletArcUsage = (radius = getBraceletRadius()) => {
  const safeRadius = Math.max(radius, 0.001)
  return marbleInstances.reduce((arc, marble) => {
    const width = arcWidthFromDiameter(getMarbleDiameter(marble), safeRadius)
    return arc + width
  }, 0)
}

const buildPlacementFromArc = (startAngle, arcWidth, diameter) => {
  if (!Number.isFinite(startAngle) || !Number.isFinite(arcWidth)) return null
  const [axisA, axisB] = ringOrientation.planeAxes
  const normalAxis = ringOrientation.normalAxis
  const axisVecA = axisVectors[axisA]
  const axisVecB = axisVectors[axisB]
  const normalVec = axisVectors[normalAxis]
  const radialOffset = (ringConfig.bandThickness || 0) / 2
  const effectiveRadius = Math.max(ringConfig.radius + radialOffset, diameter / 2 || 0.002)
  const angle = startAngle + arcWidth / 2
  const position = new THREE.Vector3()
  position.addScaledVector(axisVecA, Math.cos(angle) * effectiveRadius)
  position.addScaledVector(axisVecB, Math.sin(angle) * effectiveRadius)
  position.addScaledVector(normalVec, ringConfig.offsetZ)
  return {
    position,
    angle,
    startAngle,
    endAngle: startAngle + arcWidth,
    arcWidth
  }
}

const getPointerRingIntersection = () => {
  if (!camera) return null
  const normalAxis = ringOrientation.normalAxis
  const normalVector = axisVectors[normalAxis]
  if (!normalVector) return null
  pointerPlaneOrigin.copy(normalVector).multiplyScalar(ringConfig.offsetZ)
  pointerPlane.setFromNormalAndCoplanarPoint(normalVector, pointerPlaneOrigin)
  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster.ray.intersectPlane(pointerPlane, pointerHitPoint)
  if (!hit) {
    lastPointerIntersection = null
    return null
  }
  if (!lastPointerIntersection) {
    lastPointerIntersection = new THREE.Vector3()
  }
  lastPointerIntersection.copy(pointerHitPoint)
  return pointerHitPoint
}

const computeIndicatorPositionFromAngle = (angle) => {
  const [axisA, axisB] = ringOrientation.planeAxes
  const normalAxis = ringOrientation.normalAxis
  const axisVecA = axisVectors[axisA]
  const axisVecB = axisVectors[axisB]
  const normalVec = axisVectors[normalAxis]
  if (!axisVecA || !axisVecB || !normalVec) return null
  const radialOffset = (ringConfig.bandThickness || 0) / 2
  const effectiveRadius = Math.max(ringConfig.radius + radialOffset, 0.002)
  const position = new THREE.Vector3()
  position.addScaledVector(axisVecA, Math.cos(angle) * effectiveRadius)
  position.addScaledVector(axisVecB, Math.sin(angle) * effectiveRadius)
  position.addScaledVector(normalVec, ringConfig.offsetZ)
  return position
}

const computePointerInsertionInfo = () => {
  const intersection = getPointerRingIntersection()
  if (!intersection) return null
  const normalAxis = ringOrientation.normalAxis
  const normalVector = axisVectors[normalAxis]
  const [axisA, axisB] = ringOrientation.planeAxes
  const axisVecA = axisVectors[axisA]
  const axisVecB = axisVectors[axisB]
  if (!normalVector || !axisVecA || !axisVecB) return null
  pointerRelative.copy(intersection).sub(pointerPlaneOrigin)
  const coordA = pointerRelative.dot(axisVecA)
  const coordB = pointerRelative.dot(axisVecB)
  let angle = Math.atan2(coordB, coordA)
  if (angle < 0) {
    angle += Math.PI * 2
  }
  const ordered = marbleInstances
    .map((marble, index) => ({
      marble,
      angle: typeof marble.userData?.currentAngle === 'number' ? marble.userData.currentAngle : 0,
      index
    }))
    .filter((item) => item.marble !== reorderState.marble)
    .sort((a, b) => a.angle - b.angle)
  let insertIndex = marbleInstances.length
  if (!ordered.length) {
    insertIndex = 0
  } else {
    for (const item of ordered) {
      if (angle < item.angle) {
        insertIndex = item.index
        break
      }
    }
  }
  const position = computeIndicatorPositionFromAngle(angle)
  return position ? { index: insertIndex, position } : null
}

const getDeleteZoneElement = () => {
  const element = deleteZoneRef.value
  if (!element) return null
  return element.$el ?? element
}

const isPointerInsideDeleteZone = (event) => {
  if (!deleteZone.visible) return false
  const element = getDeleteZoneElement()
  if (!element || typeof element.getBoundingClientRect !== 'function') {
    return false
  }
  const rect = element.getBoundingClientRect()
  const position = extractPointerClientPosition(event)
  if (!position) return false
  const { clientX, clientY } = position
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
}

const updateDeleteZoneHoverState = (event) => {
  if (!reorderState.active || !deleteZone.visible) {
    deleteZone.hovered = false
    reorderState.deleteIntent = false
    reorderState.indicatorPosition = null
    return false
  }
  const hovered = isPointerInsideDeleteZone(event)
  deleteZone.hovered = hovered
  reorderState.deleteIntent = hovered
  if (hovered) {
    reorderState.insertIndex = -1
    reorderState.indicatorPosition = null
  }
  refreshDragIndicator()
  return hovered
}

const resetReorderState = () => {
  if (reorderState.marble) {
    setMarbleDragVisualState(reorderState.marble, false)
  }
  reorderState.active = false
  reorderState.marble = null
  reorderState.sourceIndex = -1
  reorderState.insertIndex = -1
  reorderState.deleteIntent = false
  reorderState.indicatorPosition = null
  enableOrbitControls()
  hideDragIndicator()
  hideDeleteZoneOverlay()
}

const beginMarbleSwapSession = (marble) => {
  if (!marble) return
  const index = marbleInstances.indexOf(marble)
  if (index === -1) return
  reorderState.active = true
  reorderState.marble = marble
  reorderState.sourceIndex = index
  reorderState.insertIndex = -1
  reorderState.deleteIntent = false
  reorderState.indicatorPosition = null
  disableOrbitControls()
  showDeleteZoneOverlay()
  setMarbleDragVisualState(marble, true)
  longPressPointer.active = false
  if (typeof uni !== 'undefined' && typeof uni.showToast === 'function') {
    uni.showToast({
      title: '拖动可插入新位置，或拖到底部删除',
      icon: 'none'
    })
  } else {
    console.info('Reorder mode activated')
  }
}

const updateInsertionFromPointer = () => {
  if (!reorderState.active || reorderState.deleteIntent) {
    refreshDragIndicator()
    return null
  }
  const info = computePointerInsertionInfo()
  if (info) {
    reorderState.insertIndex = info.index
    if (!reorderState.indicatorPosition) {
      reorderState.indicatorPosition = info.position.clone()
    } else {
      reorderState.indicatorPosition.copy(info.position)
    }
  } else {
    reorderState.insertIndex = -1
    reorderState.indicatorPosition = null
  }
  refreshDragIndicator()
  return info
}

const cancelMarbleSwapSession = () => {
  if (!reorderState.active) return
  resetReorderState()
}

const swapMarbleOrder = (first, second) => {
  if (!first || !second) {
    return { swapped: false, indexA: -1, indexB: -1 }
  }
  const indexA = marbleInstances.indexOf(first)
  const indexB = marbleInstances.indexOf(second)
  if (indexA === -1 || indexB === -1 || indexA === indexB) {
    return { swapped: false, indexA, indexB }
  }
  ;[marbleInstances[indexA], marbleInstances[indexB]] = [
    marbleInstances[indexB],
    marbleInstances[indexA]
  ]
  refreshMarbleLayout()
  return { swapped: true, indexA, indexB }
}

const moveMarbleToIndex = (marble, targetIndex) => {
  if (!marble || !Number.isInteger(targetIndex)) {
    return { moved: false, fromIndex: -1, toIndex: -1 }
  }
  const fromIndex = marbleInstances.indexOf(marble)
  if (fromIndex === -1) {
    return { moved: false, fromIndex, toIndex: -1 }
  }
  const boundedTarget = Math.min(Math.max(targetIndex, 0), marbleInstances.length)
  if (fromIndex === boundedTarget || fromIndex === boundedTarget - 1) {
    return { moved: false, fromIndex, toIndex: boundedTarget }
  }
  const [removed] = marbleInstances.splice(fromIndex, 1)
  let insertIndex = boundedTarget
  if (boundedTarget > fromIndex) {
    insertIndex = boundedTarget - 1
  }
  marbleInstances.splice(insertIndex, 0, removed)
  refreshMarbleLayout()
  return { moved: true, fromIndex, toIndex: insertIndex }
}

const completeMarbleInsertion = () => {
  if (!reorderState.active) return false
  const source = reorderState.marble
  const insertIndex = reorderState.insertIndex
  resetReorderState()
  if (!source || insertIndex < 0) return false
  const { moved, fromIndex, toIndex } = moveMarbleToIndex(source, insertIndex)
  if (!moved) return false
  pushUndoEntry({ type: 'move', marble: source, fromIndex, toIndex })
  let toastTitle = '已调整顺序'
  if (toIndex === 0) {
    toastTitle = '已移动到开头'
  } else if (toIndex === marbleInstances.length - 1) {
    toastTitle = '已移动到末尾'
  }
  if (typeof uni !== 'undefined' && typeof uni.showToast === 'function') {
    uni.showToast({
      title: toastTitle,
      icon: 'none'
    })
  } else {
    console.info('Moved marble to new position')
  }
  return true
}

const completeMarbleDeletion = () => {
  if (!reorderState.active) return false
  const source = reorderState.marble
  const sourceIndex = reorderState.sourceIndex
  resetReorderState()
  if (!source) return false
  const removed = removeMarble(source, { record: false })
  if (!removed) return false
  pushUndoEntry({ type: 'remove', marble: source, index: sourceIndex })
  if (typeof uni !== 'undefined' && typeof uni.showToast === 'function') {
    uni.showToast({
      title: '已删除该珠子',
      icon: 'none'
    })
  } else {
    console.info('Selected marble deleted')
  }
  return true
}

const capturePointerOrigin = (event) => {
  const position = extractPointerClientPosition(event)
  if (position) {
    longPressPointer.active = true
    longPressPointer.x = position.clientX
    longPressPointer.y = position.clientY
    return true
  }
  longPressPointer.active = false
  return false
}

const startLongPressTimer = (marble, event) => {
  cancelLongPressTimer()
  pendingMarble = marble
  if (!marble) return
  capturePointerOrigin(event)
  if (!Number.isFinite(LONG_PRESS_DURATION) || LONG_PRESS_DURATION <= 0) {
    beginMarbleSwapSession(marble)
    pendingMarble = null
    return
  }
  longPressTimer = setTimeout(() => {
    const target = pendingMarble
    pendingMarble = null
    longPressTimer = null
    if (target) {
      beginMarbleSwapSession(target)
    }
  }, LONG_PRESS_DURATION)
}

const selectMarbleByPointer = () => {
  if (!camera || marbleInstances.length === 0) return null
  raycaster.setFromCamera(pointer, camera)
  const intersects = raycaster.intersectObjects(marbleInstances, true)
  if (!intersects.length) return null
  const hit = intersects.find(({ object }) => resolveMarbleFromObject(object))
  if (!hit) return null
  const marble = resolveMarbleFromObject(hit.object)
  return marble || null
}

const setPointerFromEvent = (event) => {
  if (!canvasElement || !canvasElement.getBoundingClientRect) return false
  const rect = canvasElement.getBoundingClientRect()
  const position = extractPointerClientPosition(event)
  if (!position) return false
  pointer.x = ((position.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -(((position.clientY - rect.top) / rect.height) * 2 - 1)
  return true
}

const bindPointerEvents = () => {
  if (!canvasElement || pointerTeardown) return
  const target = canvasElement
  const handlePointerDown = (event) => {
    if (!sceneReady.value) return
    event.preventDefault?.()
    event.stopPropagation?.()
    lockViewerSwipe()
    cancelMarbleSwapSession()
    if (!setPointerFromEvent(event)) {
      cancelLongPressTimer()
      return
    }
    const marble = selectMarbleByPointer()
    if (marble) {
      startLongPressTimer(marble, event)
    } else {
      cancelLongPressTimer()
    }
  }
  const handlePointerMove = (event) => {
    if (reorderState.active) {
      if (setPointerFromEvent(event)) {
        const hoveringDelete = updateDeleteZoneHoverState(event)
        if (!hoveringDelete) {
          updateInsertionFromPointer()
        }
      }
      return
    }
    if (!longPressPointer.active) return
    const source =
      event?.touches?.[0] || event?.changedTouches?.[0] || event?.originalEvent?.touches?.[0] || event
    const clientX = source?.clientX
    const clientY = source?.clientY
    if (typeof clientX !== 'number' || typeof clientY !== 'number') return
    const deltaX = Math.abs(clientX - longPressPointer.x)
    const deltaY = Math.abs(clientY - longPressPointer.y)
    if (deltaX > LONG_PRESS_MOVE_THRESHOLD || deltaY > LONG_PRESS_MOVE_THRESHOLD) {
      cancelLongPressTimer()
    }
  }
  const handlePointerUp = (event) => {
    releaseViewerSwipe()
    if (reorderState.active) {
      if (setPointerFromEvent(event)) {
        const hoveringDelete = updateDeleteZoneHoverState(event)
        if (hoveringDelete) {
          completeMarbleDeletion()
        } else {
          updateInsertionFromPointer()
          completeMarbleInsertion()
        }
      } else {
        completeMarbleInsertion()
      }
    }
    cancelLongPressTimer()
    cancelMarbleSwapSession()
  }
  const handlePointerLeave = () => {
    releaseViewerSwipe()
    cancelLongPressTimer()
    cancelMarbleSwapSession()
  }
  const handlePointerCancel = () => {
    releaseViewerSwipe()
    cancelLongPressTimer()
    cancelMarbleSwapSession()
  }
  target.addEventListener('pointerdown', handlePointerDown)
  target.addEventListener('pointermove', handlePointerMove)
  target.addEventListener('pointerup', handlePointerUp)
  target.addEventListener('pointerleave', handlePointerLeave)
  target.addEventListener('pointercancel', handlePointerCancel)
  pointerTeardown = () => {
    target.removeEventListener('pointerdown', handlePointerDown)
    target.removeEventListener('pointermove', handlePointerMove)
    target.removeEventListener('pointerup', handlePointerUp)
    target.removeEventListener('pointerleave', handlePointerLeave)
    target.removeEventListener('pointercancel', handlePointerCancel)
  }
}

const initScene = async () => {
  canvasElement = await resolveCanvasElement()
  if (!canvasElement) {
    loadingText.value = '画布尚未准备好'
    return
  }
  sceneReady.value = false

  const gl = createGLContext()
  if (!gl) {
    loadingText.value = '当前环境不支持 WebGL 渲染'
    return
  }

  scene = new THREE.Scene()
  scene.background = new THREE.Color('#ffffff')
  setupDragIndicator()

  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
  camera.position.set(0, 1, 4)

  renderer = new THREE.WebGLRenderer({
    canvas: canvasElement,
    context: gl,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true
  })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  supportsUint32Index =
    renderer.capabilities.isWebGL2 || !!renderer.extensions.get('OES_element_index_uint')

  pmremGenerator = new THREE.PMREMGenerator(renderer)
  pmremGenerator.compileEquirectangularShader()
  envTexture = pmremGenerator.fromScene(new RoomEnvironment(renderer), 0.01).texture

  scene.environment = envTexture

  adjustRendererSize()
  observeResize()
  bindPointerEvents()
  // addLights()

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enablePan = false
  controls.minDistance = 1.5
  controls.maxDistance = 6
  controls.autoRotate = false

  try {
    const root = await loadModel()
    fitCameraToModel(root)
    loadingText.value = ''
    sceneReady.value = true
    if (handPreviewEnabled.value) {
      attachHandModelToScene()
    }
  } catch (error) {
    console.error('模型加载失败', error)
    loadingText.value = '模型加载失败，请确认文件是否存在'
    if (typeof uni !== 'undefined' && typeof uni.showToast === 'function') {
      uni.showToast({
        title: '模型加载失败',
        icon: 'none'
      })
    }
  }

  startRenderLoop()
}

const disposeScene = () => {
  cancelMarbleSwapSession()
  enableOrbitControls()
  if (dragIndicator) {
    dragIndicator.visible = false
    dragIndicator.geometry?.dispose?.()
    dragIndicator.material?.dispose?.()
    dragIndicator.removeFromParent?.()
    dragIndicator = null
  }
  lastPointerIntersection = null
  if (animationFrameId !== null) {
    caf(animationFrameId)
    animationFrameId = null
  }
  if (scene && marbleInstances.length) {
    marbleInstances.forEach((item) => scene.remove(item))
  }
  ringRoot = null
  ringRootBaseScale = null
  ringConfig.baseRadius = ringConfig.minRadius = 0
  detachHandModelFromScene()
  controls?.dispose?.()
  renderer?.dispose?.()
  scene?.traverse?.((child) => {
    if (child.isMesh) {
      child.geometry?.dispose?.()
      if (Array.isArray(child.material)) {
        child.material.forEach((mat) => mat?.dispose?.())
      } else {
        child.material?.dispose?.()
      }
    }
  })
  renderer = null
  scene = null
  camera = null
  controls = null
  canvasElement = null
  envTexture?.dispose?.()
  envTexture = null
  pmremGenerator?.dispose?.()
  pmremGenerator = null
  cancelLongPressTimer()
  clearUndoHistory()
  try {
    pointerTeardown?.()
  } catch (error) {
    console.warn('pointerTeardown failed', error)
  } finally {
    pointerTeardown = null
  }
  marbleTemplateCache.clear()
  productBounds.clear()
  marbleInstances.length = 0
  marbleCount.value = 0
  updateBraceletPrice()
  sceneReady.value = false
  marbleLimit.value = Infinity
  ringMetrics.minRadius = Infinity
  ringMetrics.maxRadius = 0
  ringConfig.bandThickness = 0
  if (typeof resizeTeardown === 'function') {
    resizeTeardown()
    resizeTeardown = null
  }
}

onMounted(async () => {
  loadingText.value = '素材加载中...'
  await loadMaterials()
  if (!braceletTypes.value.length) {
    loadingText.value = '暂无可用素材'
    return
  }
  loadingText.value = '加载模型中...'
  await nextTick()
  await initScene()
  if (shouldShowOnboarding()) {
    onboardingStep.value = 0
    showOnboarding.value = true
  }
})

onBeforeUnmount(() => {
  disposeScene()
  if (viewerSwipeLock.releaseTimer) {
    clearTimeout(viewerSwipeLock.releaseTimer)
    viewerSwipeLock.releaseTimer = null
  }
  if (animationVideoUrl.value) {
    URL.revokeObjectURL(animationVideoUrl.value)
  }
})

const loadMarbleTemplate = (glbPath) => {
  if (!glbPath) {
    return Promise.reject(new Error('未提供有效的产品模型路径'))
  }
  if (marbleTemplateCache.has(glbPath)) {
    const cached = marbleTemplateCache.get(glbPath)
    const bounds = productBounds.get(glbPath)
    if (bounds) updateGlobalBounds(bounds)
    return Promise.resolve(cached)
  }
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader()
    loader.load(
      glbPath,
      (gltf) => {
        const root = gltf.scene || gltf.scenes?.[0] // 取 glTF 根节点
        if (!root) {
          reject(new Error('产品模型缺少可渲染场景'))
          return
        }
        const group = new THREE.Group() // 用于包裹弹珠并方便克隆
        const clone = root.clone(true) // 深拷贝，避免直接修改原始场景
        const box = new THREE.Box3().setFromObject(clone) // 计算包围盒
        const size = box.getSize(new THREE.Vector3()) // 获取三轴尺寸
        const minSpan = Math.min(size.x, size.y, size.z)
        const maxSpan = Math.max(size.x, size.y, size.z)
        const bounds = {
          diameter: minSpan || marbleBounds.diameter,
          thickness: maxSpan || marbleBounds.thickness
        }
        productBounds.set(glbPath, bounds)
        const center = box.getCenter(new THREE.Vector3()) // 求出中心点
        clone.position.sub(center) // 平移到坐标原点，方便后续摆放
        group.add(clone)
        marbleTemplateCache.set(glbPath, group) // 缓存模板
        resolve(group)
      },
      undefined, 
      (error) => reject(error) // 加载失败时透出错误
    )
  })
}

const reflowMarbles = () => {
  if (!scene || !marbleInstances.length) return
  const radius = getBraceletRadius()
  const [axisA, axisB] = ringOrientation.planeAxes
  const normalAxis = ringOrientation.normalAxis
  const axisVecA = axisVectors[axisA]
  const axisVecB = axisVectors[axisB]
  const normalVec = axisVectors[normalAxis]
  if (!axisVecA || !axisVecB || !normalVec) return
  const radialOffset = (ringConfig.bandThickness || 0) / 2
  const position = new THREE.Vector3()
  const maxArc = Math.PI * 2
  let accumulatedArc = 0
  marbleInstances.forEach((marble) => {
    ensureMarbleBaseScale(marble)
    const diameter = getMarbleDiameter(marble)
    const arcWidth = arcWidthFromDiameter(diameter, radius)
    if (accumulatedArc + arcWidth > maxArc) return
    const angle = accumulatedArc + arcWidth / 2
    const effectiveRadius = Math.max(ringConfig.radius + radialOffset, diameter / 2 || 0.002)
    position.set(0, 0, 0)
    position.addScaledVector(axisVecA, Math.cos(angle) * effectiveRadius)
    position.addScaledVector(axisVecB, Math.sin(angle) * effectiveRadius)
    position.addScaledVector(normalVec, ringConfig.offsetZ)
    marble.userData.currentAngle = angle
    marble.userData.arcWidth = arcWidth
    marble.userData.arcStart = accumulatedArc
    marble.userData.arcEnd = accumulatedArc + arcWidth
    const rotationConfig =
      marble.userData.rotationConfig || { rotation: DEFAULT_FACE_ROTATION, axis: 'radial' }
    orientMarble(marble, position, rotationConfig)
    accumulatedArc += arcWidth
  })
}

const setRingRadius = (radius) => {
  if (!Number.isFinite(radius)) return
  const minRadius = Math.max(
    ringConfig.minRadius || ringConfig.baseRadius || MIN_RING_RADIUS,
    MIN_RING_RADIUS
  )
  const baseRadius = Math.max(ringConfig.baseRadius || minRadius, minRadius)
  const target = Math.max(radius, minRadius)
  if (Math.abs(target - ringConfig.radius) < 1e-6) return
  ringConfig.radius = target
  if (ringRoot) {
    const scaleFactor = baseRadius > 0 ? target / baseRadius : 1
    const baseScale = ringRootBaseScale || ringRoot.scale || new THREE.Vector3(1, 1, 1)
    ringRoot.scale.set(
      baseScale.x * scaleFactor,
      baseScale.y * scaleFactor,
      baseScale.z * scaleFactor
    )
  }
}

const ensureRingRadiusFitsMarbles = () => {
  const minRadius = Math.max(ringConfig.minRadius || ringConfig.baseRadius || 0.001, 0.001)
  if (!marbleInstances.length) {
    setRingRadius(minRadius)
    return ringConfig.radius
  }
  const targetArc = Math.PI * 2 - 1e-4
  let low = minRadius
  let high = Math.max(getBraceletRadius(), minRadius)
  let usageLow = computeBraceletArcUsage(low)
  if (usageLow <= targetArc) {
    setRingRadius(low)
    return ringConfig.radius
  }
  let usageHigh = computeBraceletArcUsage(high)
  let iter = 0
  while (usageHigh > targetArc && iter < 40) {
    low = high
    high *= 1.25
    usageHigh = computeBraceletArcUsage(high)
    iter++
    if (!Number.isFinite(high) || high > 10) {
      break
    }
  }
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2
    const usage = computeBraceletArcUsage(mid)
    if (usage > targetArc) {
      low = mid
    } else {
      high = mid
    }
  }
  setRingRadius(high)
  return ringConfig.radius
}

const refreshMarbleLayout = () => {
  ensureRingRadiusFitsMarbles()
  reflowMarbles()
  layoutVersion.value++
}

function refreshMarblePlacement(marble) {
  if (!marble) return
  const diameter = getMarbleDiameter(marble)
  const arcStart =
    typeof marble.userData?.arcStart === 'number' ? marble.userData.arcStart : 0
  const arcWidth =
    typeof marble.userData?.arcWidth === 'number'
      ? marble.userData.arcWidth
      : arcWidthFromDiameter(diameter, getBraceletRadius())
  const placement = buildPlacementFromArc(arcStart, arcWidth, diameter)
  if (placement) {
    orientMarble(marble, placement.position, marble.userData.rotationConfig)
  }
}

const arcWidthFromDiameter = (diameter, radius) => {
  const safeDiameter = Math.max(diameter || 0.004, 0.0005)
  const effectiveDiameter = safeDiameter * 1
  const ratio = Math.min(Math.max(effectiveDiameter / (2 * radius), 0), 1)
  return ratio > 0 ? 2 * Math.asin(ratio) : 0
}

watch(
  beadSizeOptions,
  (options) => {
    const nextIndex = clampIndex(selectedBeadSizeIndex.value, options.length)
    selectedBeadSizeIndex.value = nextIndex
  },
  { immediate: true }
)

watch(
  productList,
  (list) => {
    if (!list.length) {
      selectedProductIndex.value = 0
      return
    }
    selectedProductIndex.value = clampIndex(selectedProductIndex.value, list.length)
  },
  { immediate: true }
)

watch(
  activeBracelet,
  () => {
    selectedProductIndex.value = 0
    selectedBeadSizeIndex.value = 0
    resetMarbles()
    clearUndoHistory()
    if (sceneReady.value) {
      reloadScene()
    }
  },
  { flush: 'post' }
)

watch(
  activeBraceletName,
  (name) => {
    pageTitle.value = name || defaultPageTitle.value
  },
  { immediate: true }
)

watch(
  activeBraceletMaxBeads,
  (max) => {
    marbleLimit.value = Number.isFinite(max) ? max : Infinity
  },
  { immediate: true }
)

watch(
  activeBackgroundEntry,
  (entry) => {
    if (!entry) return
    let nextRadius = ringConfig.radius
    if (entry?.radius && Number.isFinite(entry.radius)) {
      nextRadius = Math.max(entry.radius, MIN_RING_RADIUS)
    } else if (entry?.length) {
      nextRadius = deriveRadius(entry.length, ringConfig.radius)
    } else {
      nextRadius = Math.max(nextRadius, MIN_RING_RADIUS)
    }
    ringConfig.minRadius = Math.max(nextRadius, MIN_RING_RADIUS)
    ringConfig.baseRadius = ringConfig.minRadius
    setRingRadius(nextRadius)
    marbleLimit.value = activeBraceletMaxBeads.value
    refreshMarbleLayout()
  },
  { immediate: true }
)

watch(
  activeBeadOption,
  (option) => {
    const diameter = option?.diameter || 0.004
    marbleBounds.diameter = diameter
    marbleBounds.thickness = diameter
    refreshMarbleLayout()
  },
  { immediate: true }
)

watch(
  modelUrl,
  (newUrl, oldUrl) => {
    if (!newUrl || !oldUrl || newUrl === oldUrl) return
    reloadScene()
  }
)



// Keeps cloned beads consistently aligned with the bracelet's tangent.
const orientMarble = (
  marble,
  position,
  { rotation = DEFAULT_FACE_ROTATION, axis = 'radial' } = {}
) => {
  if (!marble || !position) return
  const normalVector = axisVectors[ringOrientation.normalAxis] || axisVectors.z
  marble.up.copy(normalVector)
  marble.position.copy(position)
  marble.lookAt(0, 0, 0)
  const radialAxis = position.clone()
  if (radialAxis.lengthSq() === 0) return
  radialAxis.normalize()
  const tangentAxis = tempVector.clone().crossVectors(normalVector, radialAxis)
  if (tangentAxis.lengthSq() > 0) {
    tangentAxis.normalize()
  }
  tempQuaternion.setFromAxisAngle(radialAxis, Math.PI / 2)
  marble.applyQuaternion(tempQuaternion)
  if (!rotation) return
  let worldAxis = radialAxis
  if (axis === 'tangent' && tangentAxis.lengthSq() > 0) {
    worldAxis = tangentAxis
  } else if (axis === 'normal') {
    worldAxis = normalVector.clone().normalize()
  }
  if (worldAxis.lengthSq() > 0) {
    marble.rotateOnWorldAxis(worldAxis, rotation)
  }
  const dragOffset = typeof marble.userData?.dragOffset === 'number' ? marble.userData.dragOffset : 0
  if (dragOffset) {
    marble.position.addScaledVector(normalVector, dragOffset)
  }
}

const handleAddMarble = async () => {
  if (!scene || marbleLoading.value) return
  if (!canAddMoreMarbles.value) {
    const message = `最多可添加 ${activeBraceletMaxBeads.value} 颗`
    if (typeof uni !== 'undefined' && typeof uni.showToast === 'function') {
      uni.showToast({
        title: message,
        icon: 'none'
      })
    } else {
      console.info(message)
    }
    return
  }
  const productGlb = activeProductGlb.value
  if (!productGlb) {
    if (typeof uni !== 'undefined' && typeof uni.showToast === 'function') {
      uni.showToast({
        title: '未找到产品模型',
        icon: 'none'
      })
    }
    return
  }
  if (showOnboarding.value) {
    dismissOnboarding()
  }
  marbleLoading.value = true
  try {
    const template = await loadMarbleTemplate(productGlb)
    const bounds =
      productBounds.get(productGlb) || {
        diameter: marbleBounds.diameter || 0.004,
        thickness: marbleBounds.thickness || 0.002
      }
    const marble = template.clone(true)
    marble.traverse((node) => {
      node.userData.product = activeProduct.value
      node.userData.bounds = bounds
    })
    ensureMarbleBaseScale(marble)
    setMarbleDragVisualState(marble, false)
    if (bounds) {
      updateGlobalBounds(bounds)
    }
    const rotationConfig = {
      rotation: activeProductRotation.value,
      axis: activeProductRotationAxis.value
    }
    marble.userData.rotationConfig = rotationConfig
    marble.userData.isMarbleRoot = true
    ensureMarbleInstanceId(marble)
    scene.add(marble)
    marbleInstances.push(marble)
    marbleCount.value = marbleInstances.length
    marbleLimit.value = Infinity
    updateBraceletPrice()
    pushUndoEntry({ type: 'add', marble })
    refreshMarbleLayout()
  } catch (error) {
    console.error('添加珠子失败', error)
    if (typeof uni !== 'undefined' && typeof uni.showToast === 'function') {
      uni.showToast({
        title: '无法继续添加珠子',
        icon: 'none'
      })
    }
  } finally {
    marbleLoading.value = false
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 32rpx 32rpx 48rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  background: #ffffff;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16rpx;
}

.page-title-bar {
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  font-size: 34rpx;
  color: #111827;
}

.page-title-text {
  text-align: center;
}

.price-block {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.price-text {
  font-size: 48rpx;
  font-weight: 600;
  color: #111827;
}

.price-subtitle {
  font-size: 24rpx;
  color: #9ca3af;
}

.toolbar-actions {
  display: flex;
  gap: 12rpx;
  align-items: center;
}

.ghost-button {
  background: #fff;
  border-radius: 20rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.12);
  // padding: 12rpx 32rpx;
  font-size: 26rpx;
  color: #111827;
  box-shadow: 0 8rpx 20rpx rgba(0, 0, 0, 0.05);
  position: relative;
  overflow: hidden;
}

.ghost-button--secondary {
  border-color: rgba(99, 102, 241, 0.4);
  color: #4c1d95;
  background: rgba(99, 102, 241, 0.08);
}

.ghost-button--secondary.is-disabled {
  opacity: 0.4;
  color: #9ca3af;
  border-color: rgba(0, 0, 0, 0.08);
  background: rgba(0, 0, 0, 0.02);
}

.ghost-button.is-disabled {
  opacity: 0.4;
  color: #9ca3af;
  border-color: rgba(0, 0, 0, 0.08);
}

.ghost-button::after {
  content: none;
  border: none;
}

.selector-row {
  display: flex;
  gap: 28rpx;
  align-items: center;
}

.bracelet-indicator {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding: 0 4rpx;
}

.bracelet-name {
  font-size: 34rpx;
  font-weight: 600;
  color: #111827;
}

.bracelet-hint {
  font-size: 22rpx;
  color: #9ca3af;
}

.selector-field {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.selector-label {
  font-size: 24rpx;
  color: #000000;
}

.selector-control {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.selector-value {
  padding: 10rpx 0rpx;
  border: 1rpx solid #d1d5db;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: #1f2937;
  min-width: 100rpx;
  padding-right: 23rpx;
  text-align: center;
}

.selector-control::after {
  content: '';
  position: absolute;
  right: 18rpx;
  width: 0;
  height: 0;
  border-left: 8rpx solid transparent;
  border-right: 8rpx solid transparent;
  border-top: 10rpx solid #0e0f0f;
  pointer-events: none;
}

.selector-control-static {
  cursor: default;
}

.selector-control-static::after {
  content: none;
  border: none;
}

.viewer-card {
  position: relative;
  background: #ffffff;
  border-radius: 32rpx;
  padding: 24rpx;
  box-shadow: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  flex: 1;
  min-height: 620rpx;

}

.viewer-canvas {
  width: 100%;
  height: 560rpx;
  border-radius: 28rpx;
  background: #ffffff;
}

.viewer-canvas canvas {
  width: 100%;
  height: 100%;
  display: block;
  border-radius: inherit;
 
}

.loading {
  position: absolute;
  inset: 24rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  color: #4b5563;
}

.viewer-freeze-overlay {
  position: absolute;
  inset: 24rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.98);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.04);
}

.viewer-freeze-image {
  width: 100%;
  height: 100%;
  border-radius: 24rpx;
  object-fit: contain;
}

.hand-preview-control {
  display: flex;
  justify-content: center;
  margin-top: -6rpx;
  margin-bottom: 6rpx;
}

.hand-preview-button {
  border: none;
  background: #f3f4f6;
  color: #111827;
  border-radius: 999rpx;
  padding: 16rpx 40rpx;
  font-size: 24rpx;
}

.undo-container {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 20rpx;
  padding: 20rpx 0 8rpx;
  flex-wrap: wrap;
}

.undo-button {
  margin-right: 0;
  width: 110rpx;
  min-height: 120rpx;
  padding: 16rpx 0 12rpx;
  border: 2rpx solid rgba(59, 130, 246, 0.3);
  outline: none;
  border-radius: 25rpx;
  background: linear-gradient(140deg, #ffffff 15%, #e8eeff 100%);
  box-shadow:
    0 12rpx 24rpx rgba(15, 23, 42, 0.15);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: visible;
}

.swipe-hint {
  display: inline-flex;
  align-items: center;
  gap: 18rpx;
  padding: 12rpx 26rpx;
  border-radius: 999rpx;
  background: rgba(15, 23, 42, 0.04);
  color: #6b7280;
  font-size: 24rpx;
  pointer-events: none;
  animation: swipe-hint-fade 0.3s ease;
}

.swipe-hint-text {
  letter-spacing: 2rpx;
}

.swipe-hint-arrow {
  font-size: 30rpx;
  opacity: 0.85;
}

.swipe-hint-arrow-left {
  animation: swipe-arrow-left 1.4s ease-in-out infinite;
}

.swipe-hint-arrow-right {
  animation: swipe-arrow-right 1.4s ease-in-out infinite;
}

@keyframes swipe-arrow-left {
  0% {
    transform: translateX(0);
    opacity: 0.35;
  }
  50% {
    transform: translateX(-18rpx);
    opacity: 1;
  }
  100% {
    transform: translateX(0);
    opacity: 0.35;
  }
}

@keyframes swipe-arrow-right {
  0% {
    transform: translateX(0);
    opacity: 0.35;
  }
  50% {
    transform: translateX(18rpx);
    opacity: 1;
  }
  100% {
    transform: translateX(0);
    opacity: 0.35;
  }
}

@keyframes swipe-hint-fade {
  from {
    opacity: 0;
    transform: translateY(6rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.undo-button:disabled,
.undo-button.is-disabled {
  background: linear-gradient(140deg, #f2f2f3 10%, #e0e3e8 100%);
  box-shadow: none;
  border-color: rgba(148, 163, 184, 0.6);
}

.undo-button-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  line-height: 1;
}

.undo-label {
  font-size: 20rpx;
  color: #6b7280;
  letter-spacing: 1rpx;
  line-height: 1;
}

.undo-button::after {
  content: none;
  border: none;
}

.undo-button:disabled .undo-icon,
.undo-button.is-disabled .undo-icon {
  color: #9ca3af;
}

.undo-icon {
  font-size: 40rpx;
  color: #0f172a;
  font-weight: 600;
}

.product-carousel {
  background: #fff;
  border-radius: 32rpx;
  padding: 24rpx;
  box-shadow: none;
  position: relative;
}

.product-scroll {
  white-space: nowrap;
  display: flex;
  gap: 24rpx;
}

.product-item {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  padding: 12rpx 8rpx;
  border-radius: 24rpx;
  min-width: 140rpx;
  margin-right: 12rpx;
}

.product-item.active .product-thumb {
  transform: scale(1.05);
}

.product-thumb {
  width: 110rpx;
  height: 110rpx;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
}

.product-thumb-image {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
}

.product-name {
  font-size: 24rpx;
  color: #9ca3af;
}

.product-width {
  font-size: 22rpx;
  color: #9ca3af;
}

.carousel-fade {
  position: absolute;
  top: 24rpx;
  bottom: 72rpx;
  width: 60rpx;
  pointer-events: none;
}

.carousel-fade.left {
  left: 24rpx;
  background: linear-gradient(90deg, #fff, rgba(255, 255, 255, 0));
}

.carousel-fade.right {
  right: 24rpx;
  background: linear-gradient(270deg, #fff, rgba(255, 255, 255, 0));
}

.carousel-hint {
  display: block;
  text-align: center;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #9ca3af;
  letter-spacing: 4rpx;
}

.onboarding-overlay {
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  padding: 40rpx;
  box-sizing: border-box;
}

.onboarding-bubble {
  width: 100%;
  max-width: 480rpx;
  background: rgba(31, 41, 55, 0.95);
  color: #f9fafb;
  border-radius: 24rpx;
  padding: 28rpx 32rpx;
  box-shadow: 0 12rpx 40rpx rgba(15, 23, 42, 0.4);
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  text-align: center;
}

.bubble-title {
  font-size: 24rpx;
  color: rgba(199, 210, 254, 0.9);
  letter-spacing: 3rpx;
}

.bubble-desc {
  font-size: 26rpx;
  color: rgba(243, 244, 246, 0.92);
  font-weight: 600;
  line-height: 1.4;
}

.onboarding-button {
  margin-top: 12rpx;
  width: 100%;
  background: rgba(255, 255, 255, 0.14);
  color: rgba(249, 250, 251, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 20rpx;
  font-size: 26rpx;
  padding: 14rpx 24rpx;
}

.delete-zone {
  position: fixed;
  left: 50%;
  bottom: 80rpx;
  transform: translate(-50%, 120%);
  opacity: 0;
  pointer-events: none;
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 18rpx 32rpx;
  border-radius: 999rpx;
  background: rgba(239, 68, 68, 0.08);
  color: #b91c1c;
  font-weight: 500;
  transition: opacity 0.25s ease, transform 0.25s ease, background 0.2s ease, color 0.2s ease;
  z-index: 120;
  box-shadow: 0 4rpx 18rpx rgba(0, 0, 0, 0.08);
}

.delete-zone.is-visible {
  opacity: 1;
  transform: translate(-50%, 0);
}

.delete-zone.is-hovered {
  background: rgba(239, 68, 68, 0.2);
  color: #7f1d1d;
  box-shadow: 0 12rpx 32rpx rgba(239, 68, 68, 0.4);
}

.delete-zone-icon {
  font-size: 32rpx;
  line-height: 1;
}

.delete-zone-text {
  font-size: 26rpx;
  letter-spacing: 2rpx;
}

.bead-guide-trigger {
  cursor: pointer;
}

.bead-guide-overlay {
  position: fixed;
  inset: 0;
  z-index: 950;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.bead-guide-mask {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
}

.bead-guide-panel {
  width: 100%;
  max-height: 90vh;
  border-top-left-radius: 36rpx;
  border-top-right-radius: 36rpx;
  background: #fff;
  padding: 24rpx 28rpx 32rpx;
  box-sizing: border-box;
  z-index: 951;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.bead-guide-handle {
  width: 96rpx;
  height: 8rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.12);
  align-self: center;
}

.bead-guide-header {
  position: relative;
  display: flex;
  align-items: center;
  padding-right: 96rpx;
}

.bead-guide-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #111827;
  flex: 1;
}

.bead-guide-close {
  border: none;
  background: rgba(15, 23, 42, 0.06);
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: background 0.2s ease, transform 0.2s ease;
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
}

.bead-guide-close:active {
  transform: translateY(-50%) scale(0.95);
  background: rgba(15, 23, 42, 0.12);
}

.bead-guide-close-icon {
  font-size: 32rpx;
  color: #111827;
  line-height: 1;
}

.bead-guide-content {
  flex: 1;
  margin-top: 12rpx;
}

.bead-guide-illustration {
  width: 35%;
  height: auto;
  min-height: 180rpx;
  display: block;
  border-radius: 24rpx;
  margin-top: 4rpx;
  box-shadow: 0 10rpx 30rpx rgba(15, 23, 42, 0.12);
  object-fit: contain;
}

.bead-guide-section {
  margin-bottom: 24rpx;
}

.bead-guide-section-title {
  font-size: 28rpx;
  color: #1f2937;
  font-weight: 500;
  margin-bottom: 12rpx;
  display: block;
}

.bead-guide-line {
  display: block;
  font-size: 26rpx;
  color: #4b5563;
  line-height: 1.5;
}

.bead-guide-confirm {
  width: 100%;
  border: none;
  background: #111827;
  color: #fff;
  border-radius: 999rpx;
  font-size: 28rpx;
  padding: 20rpx 0;
}

.animation-modal {
  position: fixed;
  inset: 0;
  z-index: 960;
  display: flex;
  align-items: center;
  justify-content: center;
}

.animation-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
}

.animation-panel {
  position: relative;
  z-index: 961;
  width: calc(100% - 80rpx);
  max-width: 640rpx;
  background: #fff;
  border-radius: 28rpx;
  padding: 32rpx 28rpx 36rpx;
  box-shadow: 0 18rpx 40rpx rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.animation-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #111827;
}

.animation-video {
  width: 100%;
  border-radius: 24rpx;
  background: #000;
}

.animation-close {
  border: none;
  border-radius: 999rpx;
  background: #111827;
  color: #fff;
  font-size: 28rpx;
  padding: 20rpx 0;
}
</style>
