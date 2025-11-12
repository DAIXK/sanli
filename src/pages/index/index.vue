<template>
  <view class="page">
    
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

   

    <view class="marble-panel">
      <view class="marble-card">
        <view class="marble-info">
          <text class="marble-title">{{ activeProductName }}</text>
          <text class="marble-desc">点击添加 {{ activeProductName }}，仅允许围成一圈</text>
          <text class="marble-count">当前数量：{{ marbleCount }}</text>
        </view>
        <button
          class="marble-button"
          :loading="marbleLoading"
          :disabled="marbleLoading || !sceneReady || marbleCount >= marbleLimit"
          @tap="handleAddMarble"
        >
          {{ marbleLoading ? '加载中...' : '添加' }}
        </button>
      </view>
      <view class="product-selector" v-if="productList.length">
        <text class="product-selector-title">选择珠子</text>
        <view class="product-selector-list">
          <view
            v-for="(item, index) in productList"
            :key="item.glb || index"
            class="product-selector-item"
            :class="{ active: selectedProductIndex === index }"
            @tap="selectProduct(index)"
            >
              <text class="product-selector-name">{{ item.name }}</text>
              <text class="product-selector-weight">克重：{{ item.weight }}</text>
            </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
//可按 “radial/tangent/normal” 三种轴向做世界坐标旋转
const MATERIAL_CONFIG = {
  background: { glb: '/static/models/444.gltf', name: '手环模型' },
  product: [
    {
      glb: '/static/models/321.gltf',
      name: '磨砂珠',
      weight: '1',
      rotation: (3 * Math.PI) / 2,
      rotationAxis: 'radial'
    },
    {
      glb: '/static/models/绿玛瑙1.gltf',
      name: '绿玛瑙',
      weight: '2',
      rotation:  (3 * Math.PI) / 2,
      rotationAxis: 'normal'
    }
  ]
}

const productList = MATERIAL_CONFIG.product || []
const selectedProductIndex = ref(0)
const activeProduct = computed(() => productList[selectedProductIndex.value] || {})
const activeProductName = computed(() => activeProduct.value?.name || '珠子')
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

const MODEL_URL = MATERIAL_CONFIG.background?.glb || ''
const CANVAS_ID = 'modelCanvas'

const canvasRef = ref(null)
const loadingText = ref('加载模型中...')
const marbleLoading = ref(false)
const marbleCount = ref(0)
const sceneReady = ref(false)
const marbleLimit = ref(Infinity)
const selectProduct = (index) => {
  if (!Array.isArray(productList) || !productList.length) return
  if (!Number.isInteger(index)) return
  const clamped = Math.min(Math.max(index, 0), productList.length - 1)
  if (clamped === selectedProductIndex.value) return
  selectedProductIndex.value = clamped
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
let layoutNeedsUpdate = false
const layoutSignature = {
  diameter: null,
  perRing: null
}
const updateGlobalBounds = ({ diameter, thickness }) => {
  if (Number.isFinite(diameter) && diameter > 0) {
    marbleBounds.diameter = Math.max(marbleBounds.diameter, diameter)
  }
  if (Number.isFinite(thickness) && thickness > 0) {
    marbleBounds.thickness = Math.max(marbleBounds.thickness, thickness)
  }
}
const marbleInstances = []
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
const selectionTarget = new THREE.Vector3()
const axisVectors = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1)
}
const ringOrientation = {
  planeAxes: ['x', 'y'],
  normalAxis: 'z'
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
const raycaster = new THREE.Raycaster()
let arrowIndicator = null
let selectedMarble = null
let pointerTeardown = null

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
    const loader = new GLTFLoader()
    loader.load(
      MODEL_URL,
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

const ensureArrowIndicator = () => {
  if (arrowIndicator || !scene) return // 若之前已创建或场景未就绪则直接返回
  const material = new THREE.MeshStandardMaterial({
    color: 0xffb703, // 基础色：暖黄色，易于吸引注意力
    emissive: 0xffa726, // 自发光颜色：略偏橙色，营造发光感
    emissiveIntensity: 0.25, // 自发光强度，数值越大越亮
    roughness: 0.35, // 粗糙度：0 表示镜面，1 表示完全漫反射
    metalness: 0.1 // 金属度：0 漫反射材质，1 金属材质
  }) // 使用暖色金属材质让箭头更加醒目

  const group = new THREE.Group() // 用 group 汇总箭身与箭头，便于整体控制

  const shaftGeometry = new THREE.CylinderGeometry(0.0015, 0.0015, 0.02, 16) // 细长圆柱作为箭身
  shaftGeometry.rotateX(Math.PI / 2) // 旋转到 XY 平面内，方便从内圈指向外圈
  const shaft = new THREE.Mesh(shaftGeometry, material) // 生成箭身网格
  shaft.position.z = -0.01 // 稍微向后偏移，使箭头位置自然
  group.add(shaft) // 箭身：细长圆柱

  const headGeometry = new THREE.ConeGeometry(0.0035, 0.012, 24) // 圆锥作为箭头
  headGeometry.rotateX(Math.PI / 2) // 与箭身保持同一朝向
  const head = new THREE.Mesh(headGeometry, material) // 生成箭头网格
  head.position.z = -0.022 // 让箭头位于箭身前方
  group.add(head) // 箭头：圆锥

  group.visible = false // 默认隐藏，选中时再显
  arrowIndicator = group // 缓存箭头实例
  scene.add(arrowIndicator) // 放入场景以便统一渲染
}

const disposeArrowIndicator = () => {
  if (!arrowIndicator) return
  arrowIndicator.traverse((child) => {
    if (child.isMesh) {
      child.geometry?.dispose?.()
      if (Array.isArray(child.material)) {
        child.material.forEach((mat) => mat?.dispose?.())
      } else {
        child.material?.dispose?.()
      }
    }
  })
  scene?.remove(arrowIndicator)
  arrowIndicator = null
}

const highlightMarble = (marble) => {
  if (!marble || !scene) return
  ensureArrowIndicator()
  if (!arrowIndicator) return
  selectedMarble = marble
  marble.getWorldPosition(selectionTarget)

  const [axisA, axisB] = ringOrientation.planeAxes
  const normalAxis = ringOrientation.normalAxis
  const coordA = selectionTarget[axisA]
  const coordB = selectionTarget[axisB]
  const radialLength = Math.hypot(coordA, coordB)
  if (!radialLength) return
  const dirA = coordA / radialLength
  const dirB = coordB / radialLength
  const diameter = marbleBounds.diameter || 0.004
  const radialCenter = Math.max(ringConfig.radius - (ringConfig.bandThickness || 0) / 2, 0)

  const startPoint = new THREE.Vector3()
  startPoint.addScaledVector(axisVectors[axisA], dirA * radialCenter)
  startPoint.addScaledVector(axisVectors[axisB], dirB * radialCenter)
  startPoint.addScaledVector(axisVectors[normalAxis], selectionTarget[normalAxis])

  const endPoint = selectionTarget.clone()
  const midPoint = startPoint.clone().lerp(endPoint, 0.5)
  midPoint.addScaledVector(
    axisVectors[normalAxis],
    (ringConfig.bandThickness || marbleBounds.thickness || diameter) * 0.25
  )

  arrowIndicator.position.copy(midPoint)
  const lookTarget = midPoint.clone()
  lookTarget.addScaledVector(axisVectors[axisA], dirA)
  lookTarget.addScaledVector(axisVectors[axisB], dirB)
  arrowIndicator.lookAt(lookTarget)
  const scaleFactor = Math.max(startPoint.distanceTo(endPoint), diameter * 0.8)
  arrowIndicator.scale.setScalar(scaleFactor)
  arrowIndicator.visible = true
}

const clearSelection = () => {
  selectedMarble = null
  if (arrowIndicator) {
    arrowIndicator.visible = false
  }
}

const resolveMarbleFromObject = (object) => {
  let current = object
  while (current && !marbleInstances.includes(current)) {
    current = current.parent
  }
  return current || null
}

const selectMarbleByPointer = () => {
  if (!camera || marbleInstances.length === 0) return false
  raycaster.setFromCamera(pointer, camera)
  const intersects = raycaster.intersectObjects(marbleInstances, true)
  if (!intersects.length) return false
  const hit = intersects.find(({ object }) => resolveMarbleFromObject(object))
  if (!hit) return false
  const marble = resolveMarbleFromObject(hit.object)
  if (marble) {
    highlightMarble(marble)
    return true
  }
  return false
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
  const handler = (event) => {
    if (!sceneReady.value) return
    event.preventDefault?.()
    if (setPointerFromEvent(event)) {
      const hit = selectMarbleByPointer()
      if (!hit) {
        clearSelection()
      }
    }
  }
  target.addEventListener('pointerdown', handler)
  pointerTeardown = () => {
    target.removeEventListener('pointerdown', handler)
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
  scene.background = new THREE.Color('#f8f9fb')

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
  ensureArrowIndicator()
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
  try {
    pointerTeardown?.()
  } catch (error) {
    console.warn('pointerTeardown failed', error)
  } finally {
    pointerTeardown = null
  }
  disposeArrowIndicator()
  selectedMarble = null
  marbleTemplateCache.clear()
  productBounds.clear()
  layoutNeedsUpdate = false
  layoutSignature.diameter = null
  layoutSignature.perRing = null
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
        updateGlobalBounds(bounds)
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

const markLayoutDirty = (perRing, diameter) => {
  if (layoutSignature.perRing !== perRing || layoutSignature.diameter !== diameter) {
    layoutSignature.perRing = perRing
    layoutSignature.diameter = diameter
    layoutNeedsUpdate = true
  }
}

const reflowMarbles = () => {
  if (!layoutNeedsUpdate || !scene) return
  layoutNeedsUpdate = false
  marbleInstances.forEach((marble, index) => {
    const position = getMarblePosition(index)
    if (!position) return
    const rotationConfig =
      marble.userData.rotationConfig || { rotation: DEFAULT_FACE_ROTATION, axis: 'radial' }
    orientMarble(marble, position, rotationConfig)
  })
}

const getMarblePosition = (index) => {
  // if (!ringConfig.radius || ringConfig.radius <= 0) {
  //   return null
  // }
  const spacingDiameter = marbleBounds.diameter || 0
  const baseRadius = Math.max(ringConfig.radius, spacingDiameter / 2) || ringConfig.radius
  const effectiveDiameter = spacingDiameter * 1.05 // 稍微放大，预留缝隙
  const halfChordRatio = Math.min(Math.max(effectiveDiameter / (2 * baseRadius), 0), 1)
  const angularWidth = halfChordRatio > 0 ? 2 * Math.asin(halfChordRatio) : 0
  const perRing = Math.max(6, angularWidth > 0 ? Math.floor((Math.PI * 2) / angularWidth) : ringConfig.perRing || 28)
  ringConfig.perRing = perRing
  markLayoutDirty(perRing, spacingDiameter)
  marbleLimit.value = perRing
  if (index >= perRing) {
    return null
  }
  const angle = (index / perRing) * Math.PI * 2
  const radialOffset = (ringConfig.bandThickness || 0) / 2
  const radius = Math.max(ringConfig.radius + radialOffset, spacingDiameter / 2)
  const [axisA, axisB] = ringOrientation.planeAxes
  const normalAxis = ringOrientation.normalAxis
  const position = new THREE.Vector3()
  position.addScaledVector(axisVectors[axisA], Math.cos(angle) * radius)
  position.addScaledVector(axisVectors[axisB], Math.sin(angle) * radius)
  position.addScaledVector(axisVectors[normalAxis], ringConfig.offsetZ)
  return position
}




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
  if (marbleCount.value >= marbleLimit.value) {
    if (typeof uni !== 'undefined' && typeof uni.showToast === 'function') {
      uni.showToast({
        title: '已满一圈，无法继续添加',
        icon: 'none'
      })
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
  marbleLoading.value = true
  try {
    const template = await loadMarbleTemplate(productGlb)
    const marble = template.clone(true)
    marble.traverse((node) => {
      node.userData.marbleRoot = marble
      node.userData.product = activeProduct.value
    })
    const position = getMarblePosition(marbleInstances.length)
    if (!position) {
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
    reflowMarbles()
  } catch (error) {
    console.error('添加321失败', error)
    if (typeof uni !== 'undefined' && typeof uni.showToast === 'function') {
      uni.showToast({
        title: '添加321失败',
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
  gap: 32rpx;
}

.hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 32rpx;
  border-radius: 32rpx;
  background: linear-gradient(135deg, #1f2933, #3b3f58);
  color: #fff;
  box-shadow: 0 20rpx 40rpx rgba(63, 72, 97, 0.35);
}

.hero-text {
  display: flex;
  flex-direction: column;
}

.title {
  font-size: 40rpx;
  font-weight: 600;
  margin-bottom: 12rpx;
}

.subtitle {
  font-size: 26rpx;
  opacity: 0.8;
}

.hero-tag {
  padding: 12rpx 24rpx;
  border-radius: 999rpx;
  border: 1px solid rgba(255, 255, 255, 0.4);
  font-size: 24rpx;
}

.viewer-card {
  position: relative;
  background: #ffffff;
  border-radius: 40rpx;
  padding: 24rpx;
  box-shadow: 0 24rpx 50rpx rgba(15, 23, 42, 0.08);
  flex: 1;
  min-height: 400rpx;
}

.viewer-canvas {
  width: 100%;
  height: 420rpx;
  border-radius: 32rpx;
  background: radial-gradient(circle at top, #f9fbff, #e5e9f5);
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
  border-radius: 32rpx;
  background: rgba(255, 255, 255, 0.82);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  color: #4b5563;
}

.tips {
  font-size: 26rpx;
  color: #4b5563;
  line-height: 1.6;
}

.marble-panel {
  background: #ffffff;
  border-radius: 32rpx;
  padding: 28rpx;
  box-shadow: 0 16rpx 32rpx rgba(15, 23, 42, 0.08);
}

.marble-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
}

.marble-info {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.product-selector {
  margin-top: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.product-selector-title {
  font-size: 26rpx;
  color: #6b7280;
}

.product-selector-list {
  display: flex;
  gap: 16rpx;
  flex-wrap: wrap;
}

.product-selector-item {
  padding: 16rpx 20rpx;
  border-radius: 24rpx;
  border: 1px solid #e5e7eb;
  background: #fff;
  min-width: 180rpx;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  font-size: 24rpx;
  color: #4b5563;
}

.product-selector-item.active {
  border-color: #2563eb;
  background: rgba(37, 99, 235, 0.08);
  color: #1d4ed8;
}

.product-selector-name {
  font-weight: 600;
}

.product-selector-weight {
  font-size: 22rpx;
  color: #9ca3af;
}

.marble-title {
  font-size: 32rpx;
  font-weight: 600;
}

.marble-desc {
  font-size: 26rpx;
  color: #6b7280;
}

.marble-count {
  font-size: 24rpx;
  color: #9ca3af;
}

.marble-button {
  background: linear-gradient(135deg, #2563eb, #7c3aed);
  color: #fff;
  border: none;
  border-radius: 999rpx;
  padding: 18rpx 36rpx;
  font-size: 28rpx;
}

.marble-button[disabled] {
  opacity: 0.5;
}
</style>
