<template>
  <view class="page">
    <view class="hero">
      <view class="hero-text">
        <text class="title">矿石 3D 预览</text>
        <text class="subtitle">单指拖拽旋转 · 双指捏合缩放</text>
      </view>
      <view class="hero-tag">GLB</view>
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

    <view class="tips">
      <text>提示：</text>
      <text>模型文件位于 public 目录，可直接替换为其他 .glb 文件。</text>
    </view>

    <view class="marble-panel">
      <view class="marble-card">
        <view class="marble-info">
          <text class="marble-title">321</text>
          <text class="marble-desc">点击添加，可堆叠多个</text>
          <text class="marble-count">当前数量：{{ marbleCount }}</text>
        </view>
        <button
          class="marble-button"
          :loading="marbleLoading"
          :disabled="marbleLoading || !sceneReady"
          @tap="handleAddMarble"
        >
          {{ marbleLoading ? '加载中...' : '添加321' }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

const MODEL_URL = '/static/models/444.gltf'
const MARBLE_URL = '/static/models/321.gltf'
const CANVAS_ID = 'modelCanvas'

const canvasRef = ref(null)
const loadingText = ref('加载模型中...')
const marbleLoading = ref(false)
const marbleCount = ref(0)
const sceneReady = ref(false)

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
let marbleTemplate = null
const marbleInstances = []

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
  marbleTemplate = null
  marbleInstances.length = 0
  marbleCount.value = 0
  sceneReady.value = false
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

const loadMarbleTemplate = () => {
  if (marbleTemplate) return Promise.resolve(marbleTemplate)
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader()
    loader.load(
      MARBLE_URL,
      (gltf) => {
        const root = gltf.scene || gltf.scenes?.[0]
        if (!root) {
          reject(new Error('321模型缺少可渲染场景'))
          return
        }
        const group = new THREE.Group()
        const clone = root.clone(true)
        const box = new THREE.Box3().setFromObject(clone)
        const center = box.getCenter(new THREE.Vector3())
        clone.position.sub(center)
        group.add(clone)
        marbleTemplate = group
        resolve(marbleTemplate)
      },
      undefined,
      (error) => reject(error)
    )
  })
}

const getMarblePosition = (index) => {
  const spacing = 0.05
  const perRow = 4
  const row = Math.floor(index / perRow)
  const col = index % perRow
  const offset = (perRow - 1) / 2
  return new THREE.Vector3((col - offset) * spacing, -0.02, -0.12 - row * spacing)
}

const handleAddMarble = async () => {
  if (!scene || marbleLoading.value) return
  marbleLoading.value = true
  try {
    const template = await loadMarbleTemplate()
    const marble = template.clone(true)
    const position = getMarblePosition(marbleInstances.length)
    marble.position.copy(position)
    scene.add(marble)
    marbleInstances.push(marble)
    marbleCount.value = marbleInstances.length
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
  min-height: 600rpx;
}

.viewer-canvas {
  width: 100%;
  height: 520rpx;
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
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
}

.marble-info {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
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
