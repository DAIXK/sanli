<template>
  <view class="page" @touchstart="handlePageTouchStart" @touchend="handlePageTouchEnd">
    <view class="page-title-bar" v-if="showH5Title">
      <text class="page-title-text">{{ pageTitle }}</text>
    </view>
    <view class="toolbar">
      <view class="price-block">
        <text class="price-text">¥ {{ formattedPrice }}</text>
       
      </view>
      <button class="ghost-button" disabled="true" @tap="handleGenerateVideo">生成视频</button>
    </view>



    <view class="selector-row">
      <view class="selector-field">
        <text class="selector-label">圈长</text>
        <picker
          class="selector-control"
          mode="selector"
          :value="selectedRingSizeIndex"
          :range="ringSizeLabels"
          @change="handleRingSizeChange"
        >
          <view class="selector-value">{{ ringSizeLabels[selectedRingSizeIndex] }}</view>
        </picker>
      </view>
      <view class="selector-field">
        <text class="selector-label">珠径</text>
        <picker
          class="selector-control"
          mode="selector"
          :value="selectedBeadSizeIndex"
          :range="beadSizeLabels"
          @change="handleBeadSizeChange"
        >
          <view class="selector-value">{{ beadSizeLabels[selectedBeadSizeIndex] }}</view>
        </picker>
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
    </view>

    <view class="undo-container" v-if="productList.length">
      <button
        class="undo-button"
        type="button"
        :class="{ 'is-disabled': !canUndo }"
        :disabled="!canUndo"
        @tap="handleUndo"
      >
        <text class="undo-icon">↺</text>
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
              mode="aspectFill"
            />
          </view>
          <text class="product-name">{{ item.name }}</text>
          <text class="product-width" v-if="item.width">{{ item.width }}</text>
        </view>
      </scroll-view>
    </view>
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
  ref,
  toRaw,
  watch
} from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
//可按 “radial/tangent/normal” 三种轴向做世界坐标旋转


const DEFAULT_API_BASE_URL = 'http://localhost:5001'
let envApiBaseUrl = ''
try {
  envApiBaseUrl = import.meta.env?.VITE_API_BASE_URL || ''
} catch (error) {
  envApiBaseUrl = ''
}
const normalizeBaseUrl = (value) => {
  if (typeof value !== 'string') return ''
  return value.replace(/\/+$/, '')
}
const API_BASE_URL = normalizeBaseUrl(envApiBaseUrl || DEFAULT_API_BASE_URL)
const MATERIAL_ENDPOINT = API_BASE_URL ? `${API_BASE_URL}/api/materials` : ''
const isAbsoluteUrl = (value) => typeof value === 'string' && /^https?:\/\//i.test(value)
const buildAssetUrl = (value) => {
  if (typeof value !== 'string' || !value) return value
  if (!API_BASE_URL || isAbsoluteUrl(value)) return value
  const normalizedPath = value.startsWith('/') ? value : `/${value}`
  return `${API_BASE_URL}${normalizedPath}`
}
const normalizeCollection = (collection) => (Array.isArray(collection) ? collection : [])
const transformMaterialEntry = (entry = {}) => ({
  ...entry,
  background: normalizeCollection(entry.background).map((item) => ({
    ...item,
    glb: buildAssetUrl(item.glb),
    png: buildAssetUrl(item.png)
  })),
  product: normalizeCollection(entry.product).map((item) => ({
    ...item,
    glb: buildAssetUrl(item.glb),
    png: buildAssetUrl(item.png)
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
const selectedRingSizeIndex = ref(0)
const selectedBeadSizeIndex = ref(0)

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
const deriveRadius = (length, fallback) => {
  const numeric = Number(length)
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric / 1000
  }
  return fallback
}
const ringSizeOptions = computed(() =>
  backgroundOptions.value.map((item, index) => {
    const label =
      typeof item.length !== 'undefined'
        ? `${item.length}cm`
        : item.name || `圈长${index + 1}`
    const radius = Number(item.radius)
    return {
      label,
      radius: Number.isFinite(radius) ? radius : deriveRadius(item.length, ringConfig.radius),
      glb: item.glb || '',
      raw: item
    }
  })
)
const ringSizeLabels = computed(() => ringSizeOptions.value.map((item) => item.label))
const activeRingOption = computed(
  () => ringSizeOptions.value[selectedRingSizeIndex.value] || ringSizeOptions.value[0] || null
)
const modelUrl = computed(() => activeRingOption.value?.glb || '')

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

const canvasRef = ref(null)
const loadingText = ref('加载模型中...')
const marbleLoading = ref(false)
const marbleCount = ref(0)
const sceneReady = ref(false)
const marbleLimit = ref(Infinity)
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
const handleRingSizeChange = (event) => {
  const idx = Number(event?.detail?.value)
  if (Number.isNaN(idx)) return
  selectedRingSizeIndex.value = idx
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
const switchBracelet = (index) => {
  const list = braceletTypes.value
  if (!list.length) return
  const clamped = clampIndex(index, list.length)
  if (clamped === selectedBraceletIndex.value) return
  selectedBraceletIndex.value = clamped
}
const handlePageTouchStart = (event) => {
  const touch = event?.touches?.[0]
  if (!touch) return
  swipeState.startX = touch.clientX
  swipeState.startY = touch.clientY
  swipeState.active = true
}
const handlePageTouchEnd = (event) => {
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
  if (deltaX < 0) {
    switchBracelet(selectedBraceletIndex.value + 1)
  } else {
    switchBracelet(selectedBraceletIndex.value - 1)
  }
  swipeState.active = false
}
const handleGenerateVideo = () => {
  if (typeof uni !== 'undefined' && typeof uni.showToast === 'function') {
    uni.showToast({
      title: '正在生成',
      icon: 'none'
    })
  } else {
    console.info('Generate video triggered')
  }
}
const noop = () => {}

const requestJson = (url) => {
  if (!url) return Promise.reject(new Error('缺少请求地址'))
  if (typeof uni !== 'undefined' && typeof uni.request === 'function') {
    return new Promise((resolve, reject) => {
      uni.request({
        url,
        method: 'GET',
        success: (response) => resolve(response?.data),
        fail: (error) => reject(error)
      })
    })
  }
  if (typeof fetch === 'function') {
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`)
      }
      return response.json()
    })
  }
  return Promise.reject(new Error('当前环境缺少网络请求能力'))
}

const fetchMaterialConfig = async () => {
  if (!MATERIAL_ENDPOINT) return
  try {
    const data = await requestJson(MATERIAL_ENDPOINT)
    if (data && typeof data === 'object') {
      materialConfig.value = transformMaterialConfig(data)
      selectedBraceletIndex.value = 0
      selectedRingSizeIndex.value = 0
      selectedBeadSizeIndex.value = 0
      selectedProductIndex.value = 0
    }
  } catch (error) {
    console.error('获取素材配置失败', error)
    if (typeof uni !== 'undefined' && typeof uni.showToast === 'function') {
      uni.showToast({
        title: '素材数据加载失败',
        icon: 'none'
      })
    }
  }
}

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
const instance = getCurrentInstance()
const isH5 = typeof window !== 'undefined' && typeof document !== 'undefined'
let supportsUint32Index = true
const marbleTemplateCache = new Map()
const marbleBounds = {
  diameter: 0,
  thickness: 0
}
const productBounds = new Map()
const updateGlobalBounds = ({ diameter, thickness }) => {
  if (Number.isFinite(diameter) && diameter > 0) {
    marbleBounds.diameter = diameter
  }
  if (Number.isFinite(thickness) && thickness > 0) {
    marbleBounds.thickness = thickness
  }
}
const marbleInstances = []
const undoStack = ref([])
const canUndo = computed(() => marbleCount.value > 0 && undoStack.value.length > 0)
const ringConfig = {
  radius: 0.018,
  perRing: 28,
  depthStep: 0.0008,
  layerGap: 0.0012,
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
const price = ref(2288)
const formattedPrice = computed(() => price.value.toLocaleString('zh-CN'))
const DEFAULT_PAGE_TITLE = '3D 模型预览'
const pageTitle = ref(DEFAULT_PAGE_TITLE)
const showH5Title = isH5
const applyPageTitle = (title) => {
  const finalTitle = title || DEFAULT_PAGE_TITLE
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

const resetMarbles = () => {
  if (scene && marbleInstances.length) {
    marbleInstances.forEach((item) => scene.remove(item))
  }
  marbleInstances.length = 0
  marbleCount.value = 0
  marbleLimit.value = Infinity
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
let longPressTimer = null
let pendingMarble = null
const raycaster = new THREE.Raycaster()
let pointerTeardown = null

const cancelLongPressTimer = () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
  pendingMarble = null
}

const pushUndoEntry = (entry) => {
  if (!entry || typeof entry !== 'object') return
  const normalized = { ...entry }
  if (normalized.marble && typeof normalized.marble === 'object') {
    const rawMarble = toRaw(normalized.marble)
    normalized.marble = rawMarble ? markRaw(rawMarble) : rawMarble
  }
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
  scene.add(hemiLight)

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
  dirLight.position.set(5, 10, 7.5)
  scene.add(dirLight)

  const fillLight = new THREE.PointLight(0x77aaff, 0.4)
  fillLight.position.set(-4, -2, -3)
  scene.add(fillLight)
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
        scene.add(root)
        resolve(root)
      },
      undefined,
      (error) => reject(error)
    )
  })
}

const fitCameraToModel = (root) => {
  if (!root || !camera || !controls) return
  const boundingBox = new THREE.Box3().setFromObject(root)
  if (boundingBox.isEmpty()) return

  const size = boundingBox.getSize(new THREE.Vector3())
  const center = boundingBox.getCenter(new THREE.Vector3())

  root.position.sub(center)
  setRingOrientationBySize(size)
  updateRingMetrics(root)

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
  const clamped = Math.min(Math.max(index, 0), marbleInstances.length)
  scene.add(marble)
  marbleInstances.splice(clamped, 0, marble)
  marbleCount.value = marbleInstances.length
  marbleLimit.value = Infinity
  reflowMarbles()
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
  if (record) {
    pushUndoEntry({ type: 'remove', marble: target, index })
  }
  reflowMarbles()
  return true
}

const removeMarbleWithFeedback = (marble, options = {}) => {
  const removed = removeMarble(marble, options)
  if (!removed) return false
  if (typeof uni !== 'undefined' && typeof uni.showToast === 'function') {
    uni.showToast({
      title: '已删除该珠子',
      icon: 'none'
    })
  } else {
    console.info('Selected marble removed')
  }
  return true
}

const startLongPressTimer = (marble) => {
  cancelLongPressTimer()
  pendingMarble = marble
  if (!marble) return
  if (!Number.isFinite(LONG_PRESS_DURATION) || LONG_PRESS_DURATION <= 0) {
    removeMarbleWithFeedback(marble)
    pendingMarble = null
    return
  }
  longPressTimer = setTimeout(() => {
    const target = pendingMarble
    pendingMarble = null
    longPressTimer = null
    if (target) {
      removeMarbleWithFeedback(target)
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
  const source =
    event.touches?.[0] || event.changedTouches?.[0] || event.originalEvent?.touches?.[0] || event
  const clientX = source?.clientX
  const clientY = source?.clientY
  if (typeof clientX !== 'number' || typeof clientY !== 'number') return false
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -(((clientY - rect.top) / rect.height) * 2 - 1)
  return true
}

const bindPointerEvents = () => {
  if (!canvasElement || pointerTeardown) return
  const target = canvasElement
  const handlePointerDown = (event) => {
    if (!sceneReady.value) return
    event.preventDefault?.()
    if (!setPointerFromEvent(event)) {
      cancelLongPressTimer()
      return
    }
    const marble = selectMarbleByPointer()
    if (marble) {
      startLongPressTimer(marble)
    } else {
      cancelLongPressTimer()
    }
  }
  const handlePointerUp = () => cancelLongPressTimer()
  const handlePointerLeave = () => cancelLongPressTimer()
  const handlePointerCancel = () => cancelLongPressTimer()
  target.addEventListener('pointerdown', handlePointerDown)
  target.addEventListener('pointerup', handlePointerUp)
  target.addEventListener('pointerleave', handlePointerLeave)
  target.addEventListener('pointercancel', handlePointerCancel)
  pointerTeardown = () => {
    target.removeEventListener('pointerdown', handlePointerDown)
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
  envTexture = pmremGenerator.fromScene(new RoomEnvironment(renderer), 0.04).texture

  scene.environment = envTexture

  adjustRendererSize()
  observeResize()
  bindPointerEvents()
  addLights()

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
  if (animationFrameId !== null) {
    caf(animationFrameId)
    animationFrameId = null
  }
  if (scene && marbleInstances.length) {
    marbleInstances.forEach((item) => scene.remove(item))
  }
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

onMounted(() => {
  fetchMaterialConfig()
  nextTick(() => initScene())
})

onBeforeUnmount(() => {
  disposeScene()
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
  marbleInstances.forEach((marble, index) => {
    const diameter = marble.userData.bounds?.diameter || marbleBounds.diameter || 0.004
    const position = computeMarblePosition(index, diameter)
    if (!position) return
    const rotationConfig =
      marble.userData.rotationConfig || { rotation: DEFAULT_FACE_ROTATION, axis: 'radial' }
    orientMarble(marble, position, rotationConfig)
  })
}

const arcWidthFromDiameter = (diameter, radius) => {
  const safeDiameter = Math.max(diameter || 0.004, 0.0005)
  const effectiveDiameter = safeDiameter * 1.02
  const ratio = Math.min(Math.max(effectiveDiameter / (2 * radius), 0), 1)
  return ratio > 0 ? 2 * Math.asin(ratio) : 0
}

const computeMarblePosition = (index, diameterOverride) => {
  const radius = Math.max(ringConfig.radius, 0.001)
  const maxArc = Math.PI * 2
  let accumulatedArc = 0
  for (let i = 0; i <= index; i++) {
    const isTarget = i === index
    const targetMarble = marbleInstances[i]
    const diameter = isTarget
      ? diameterOverride
      : targetMarble?.userData?.bounds?.diameter ?? marbleBounds.diameter ?? 0.004
    const arcWidth = arcWidthFromDiameter(diameter, radius)
    if (isTarget) {
      if (accumulatedArc + arcWidth > maxArc) {
        return null
      }
      const angle = accumulatedArc + arcWidth / 2
      const [axisA, axisB] = ringOrientation.planeAxes
      const normalAxis = ringOrientation.normalAxis
      const radialOffset = (ringConfig.bandThickness || 0) / 2
      const effectiveRadius = Math.max(ringConfig.radius + radialOffset, diameter / 2 || 0.002)
      const position = new THREE.Vector3()
      position.addScaledVector(axisVectors[axisA], Math.cos(angle) * effectiveRadius)
      position.addScaledVector(axisVectors[axisB], Math.sin(angle) * effectiveRadius)
      position.addScaledVector(axisVectors[normalAxis], ringConfig.offsetZ)
      return position
    }
    accumulatedArc += arcWidth
  }
  return null
}

watch(
  ringSizeOptions,
  (options) => {
    const nextIndex = clampIndex(selectedRingSizeIndex.value, options.length)
    selectedRingSizeIndex.value = nextIndex
  },
  { immediate: true }
)

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
    selectedRingSizeIndex.value = 0
    selectedBeadSizeIndex.value = 0
    resetMarbles()
    clearUndoHistory()
    reloadScene()
  },
  { flush: 'post' }
)

watch(
  activeBraceletName,
  (name) => {
    pageTitle.value = name || DEFAULT_PAGE_TITLE
  },
  { immediate: true }
)

watch(
  activeRingOption,
  (option) => {
    if (option?.radius && Number.isFinite(option.radius)) {
      ringConfig.radius = option.radius
    }
    reflowMarbles()
  },
  { immediate: true }
)

watch(
  activeBeadOption,
  (option) => {
    const diameter = option?.diameter || 0.004
    marbleBounds.diameter = diameter
    marbleBounds.thickness = diameter
    reflowMarbles()
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
}

const handleAddMarble = async () => {
  if (!scene || marbleLoading.value) return
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
      node.userData.marbleRoot = marble
      node.userData.product = activeProduct.value
      node.userData.bounds = bounds
    })
    if (bounds) {
      updateGlobalBounds(bounds)
    }
    const diameterForPlacement = bounds?.diameter || marbleBounds.diameter || 0.004
    const position = computeMarblePosition(marbleInstances.length, diameterForPlacement)
    if (!position) {
      marbleLimit.value = marbleCount.value
      throw new Error('弹珠数量超出一圈容量')
    }
    const rotationConfig = {
      rotation: activeProductRotation.value,
      axis: activeProductRotationAxis.value
    }
    marble.userData.rotationConfig = rotationConfig
    orientMarble(marble, position, rotationConfig)
    scene.add(marble)
    marbleInstances.push(marble)
    marbleCount.value = marbleInstances.length
    marbleLimit.value = Infinity
    pushUndoEntry({ type: 'add', marble })
    reflowMarbles()
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

.ghost-button {
  background: #fff;
  border-radius: 20rpx;
  border: 1rpx solid rgba(0, 0, 0, 0.12);
  // padding: 12rpx 32rpx;
  font-size: 26rpx;
  color: #111827;
  box-shadow: 0 8rpx 20rpx rgba(0, 0, 0, 0.05);
  margin-left: auto;
  margin-right: 0;
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

.undo-container {
  display: flex;
  justify-content: flex-end;
  padding: 16rpx 0;
}

.undo-button {
  border: none;
  background: #ffffff;
  border-radius: 24rpx;
  padding: 0rpx 28rpx;
  box-shadow: 0 8rpx 18rpx rgba(0, 0, 0, 0.08);
  border: 1rpx solid rgba(0, 0, 0, 0.08);
  margin-right: 0;
}

.undo-button:disabled,
.undo-button.is-disabled {
  background: #e5e7eb;
  border-color: rgba(0, 0, 0, 0.12);
  opacity: 1;
  box-shadow: none;
  cursor: not-allowed;
}

.undo-button:disabled .undo-icon,
.undo-button.is-disabled .undo-icon {
  color: #9ca3af;
}

.undo-icon {
  font-size: 32rpx;
  color: #111827;
}

.product-carousel {
  background: #fff;
  border-radius: 32rpx;
  padding: 24rpx;
  box-shadow: none;
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
  object-fit: cover;
}

.product-name {
  font-size: 24rpx;
  color: #4b5563;
}

.product-width {
  font-size: 22rpx;
  color: #9ca3af;
}
</style>
