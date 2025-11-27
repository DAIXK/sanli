<template>
  <view class="page">
    <view v-show="stage === 'assembly'" class="canvas-container" ref="assemblyMountRef"></view>
    <view v-show="stage === 'viewer'" class="canvas-container" ref="viewerMountRef"></view>
    <view class="stage-indicator">{{ stageLabel }}</view>
    <view class="toast" v-if="loadingText">{{ loadingText }}</view>
    <view class="error" v-if="errorText">{{ errorText }}</view>
  </view>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

const DIY_CACHE_KEY = 'bracelet_diy_model_cache'
const DEFAULT_BASE_MODEL = '/static/models/Human-Arm-Animation.gltf'
const DEFAULT_BG = '/static/background.png'

// Assembly defaults
const DEFAULT_RING_RADIUS = 1.185
const DEFAULT_HEIGHT = 0.04
const DEFAULT_BRACELET_SCALE = 1.85
const DEFAULT_CAM_RADIUS = 0.28
const DEFAULT_CAM_YAW = 0
const DEFAULT_CAM_PITCH = 0
const DEFAULT_BRACELET_OFFSET = { x: 0, y: 0, z: 0 }
const DEFAULT_PER_BEAD_DELAY = 0.18
const DEFAULT_FLIGHT_DURATION = 0.15
const DEFAULT_SPIN_SPEED = 4.85
const DEFAULT_SPIN_TURNS = 1
const DETAIL_SCALE = 2
const DETAIL_CAM_RADIUS = 0.18
const DETAIL_CAM_PITCH = 0
const DETAIL_TARGET_LIFT = 0.2
const DETAIL_TOP_LIFT = 3.2
const DETAIL_DELAY = 0.3
const DETAIL_ZOOM_IN = 0.6
const DETAIL_HOLD = 1
const DETAIL_ZOOM_OUT = 0.6
const DETAIL_RADIUS_GAP_FACTOR = 2
const DETAIL_GROUP_LIFT = 0.5
const RING_RADIUS_EXTRA = 0.5

const assemblyMountRef = ref(null)
const viewerMountRef = ref(null)
const stage = ref('assembly')
const loadingText = ref('加载中...')
const errorText = ref('')
const stageLabel = computed(() =>
  stage.value === 'assembly' ? '组装展示中...' : '佩戴展示中...'
)

const cachedDiyPayloadRef = ref(null)
const cachedObjectUrls = new Set()
let activeAssemblyObjectUrl = ''
let activeViewerObjectUrl = ''

const sequenceConfig = ref({
  assemblyDiy: '',
  viewerDiy: '',
  viewerBase: DEFAULT_BASE_MODEL,
  assemblyBg: DEFAULT_BG,
  viewerBg: DEFAULT_BG,
  braceletScale: DEFAULT_BRACELET_SCALE,
  braceletOffset: { ...DEFAULT_BRACELET_OFFSET },
  camRadius: DEFAULT_CAM_RADIUS,
  camYaw: DEFAULT_CAM_YAW,
  camPitch: DEFAULT_CAM_PITCH,
  spinSpeed: DEFAULT_SPIN_SPEED,
  spinTurns: DEFAULT_SPIN_TURNS,
  useCachedAssembly: false,
  useCachedViewer: false
})

const assemblyInitialized = ref(false)
const viewerInitialized = ref(false)
let assemblyCleanup = null
let viewerCleanup = null

const decodeOrRaw = (value) => {
  if (!value) return value
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const resolveMountElement = (refObj) => {
  const target = refObj.value
  if (!target) return null
  if (target instanceof HTMLElement) return target
  if (target.$el instanceof HTMLElement) return target.$el
  if (target.$el?.$el instanceof HTMLElement) return target.$el.$el
  return null
}

const restoreCachedDiyPayload = () => {
  if (typeof window === 'undefined') return false
  const raw = window.localStorage?.getItem(DIY_CACHE_KEY)
  if (!raw) return false
  try {
    const payload = JSON.parse(raw)
    if (payload?.dataUrl) {
      cachedDiyPayloadRef.value = {
        dataUrl: payload.dataUrl,
        type: payload.type || 'model/gltf-binary'
      }
      return true
    }
  } catch (error) {
    console.warn('restore diy cache failed', error)
  }
  cachedDiyPayloadRef.value = null
  return false
}

const dataUrlToBlob = (dataUrl, fallbackType = 'application/octet-stream') => {
  if (!dataUrl || typeof dataUrl !== 'string') return new Blob([], { type: fallbackType })
  const [meta, base64 = ''] = dataUrl.split(',')
  const mimeMatch = /^data:(.*?);/.exec(meta || '')
  const mime = mimeMatch?.[1] || fallbackType
  try {
    const binary = atob(base64)
    const len = binary.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    return new Blob([bytes.buffer], { type: mime })
  } catch (error) {
    console.warn('Failed to decode cached diy model', error)
    return new Blob([], { type: fallbackType })
  }
}

const createObjectUrlFromCachedPayload = () => {
  if (!cachedDiyPayloadRef.value) return ''
  try {
    const blob = dataUrlToBlob(
      cachedDiyPayloadRef.value.dataUrl,
      cachedDiyPayloadRef.value.type || 'model/gltf-binary'
    )
    if (blob.size <= 0) return ''
    const objectUrl = URL.createObjectURL(blob)
    cachedObjectUrls.add(objectUrl)
    return objectUrl
  } catch (error) {
    console.warn('create cached diy url failed', error)
    return ''
  }
}

const revokeCachedObjectUrl = (url) => {
  if (!url) return
  if (cachedObjectUrls.has(url)) {
    URL.revokeObjectURL(url)
    cachedObjectUrls.delete(url)
  }
}

const prepareSequenceConfig = () => {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  const parseNumber = (value, fallback) => {
    if (value === null || value === undefined) return fallback
    const num = parseFloat(value)
    return Number.isFinite(num) ? num : fallback
  }

  const diy = decodeOrRaw(params.get('diyModel')) || decodeOrRaw(params.get('diy'))
  const assemblyModel = decodeOrRaw(params.get('assemblyModel')) || diy
  const viewerModel = decodeOrRaw(params.get('viewerModel')) || diy
  const viewerBase =
    decodeOrRaw(params.get('viewerModel')) ||
    decodeOrRaw(params.get('humanModel')) ||
    decodeOrRaw(params.get('baseModel')) ||
    DEFAULT_BASE_MODEL
  const assemblyBg =
    decodeOrRaw(params.get('assemblyBg')) || decodeOrRaw(params.get('bg')) || DEFAULT_BG
  const viewerBg =
    decodeOrRaw(params.get('viewerBg')) || decodeOrRaw(params.get('bg')) || DEFAULT_BG

  const hasCachedPayload = restoreCachedDiyPayload()

  const braceletScale = parseNumber(params.get('scale'), DEFAULT_BRACELET_SCALE)
  const offsetX = parseNumber(params.get('offsetX'), DEFAULT_BRACELET_OFFSET.x)
  const offsetY = parseNumber(params.get('offsetY'), DEFAULT_BRACELET_OFFSET.y)
  const offsetZ = parseNumber(params.get('offsetZ'), DEFAULT_BRACELET_OFFSET.z)
  const camRadius = parseNumber(params.get('camR'), DEFAULT_CAM_RADIUS)
  const camYaw = parseNumber(params.get('camYaw'), DEFAULT_CAM_YAW)
  const camPitch = parseNumber(params.get('camPitch'), DEFAULT_CAM_PITCH)
  const spinSpeed = parseNumber(params.get('spinSpeed'), DEFAULT_SPIN_SPEED)
  const spinTurns = parseNumber(params.get('spinTurns'), DEFAULT_SPIN_TURNS)

  const assemblySource = assemblyModel || diy || ''
  const viewerSource = viewerModel || diy || ''
  const useCachedAssembly = !assemblySource && hasCachedPayload
  const useCachedViewer = !viewerSource && hasCachedPayload

  sequenceConfig.value = {
    assemblyDiy: assemblySource,
    viewerDiy: viewerSource,
    viewerBase: viewerBase || DEFAULT_BASE_MODEL,
    assemblyBg,
    viewerBg,
    braceletScale,
    braceletOffset: { x: offsetX, y: offsetY, z: offsetZ },
    camRadius,
    camYaw,
    camPitch,
    spinSpeed,
    spinTurns,
    useCachedAssembly,
    useCachedViewer
  }

  if (!sequenceConfig.value.assemblyDiy && !useCachedAssembly) {
    stage.value = 'viewer'
  }
}

const runAssemblyStage = () => {
  if (assemblyInitialized.value) return
  const mountEl = resolveMountElement(assemblyMountRef)
  if (!mountEl) {
    errorText.value = '组装容器未准备好'
    return
  }
  const config = sequenceConfig.value
  let assemblyUrl = config.assemblyDiy
  if (config.useCachedAssembly || (!assemblyUrl && cachedDiyPayloadRef.value)) {
    if (!cachedDiyPayloadRef.value) {
      restoreCachedDiyPayload()
    }
    if (cachedDiyPayloadRef.value) {
      assemblyUrl = createObjectUrlFromCachedPayload()
      activeAssemblyObjectUrl = assemblyUrl
    }
  } else {
    activeAssemblyObjectUrl = ''
  }
  if (!assemblyUrl) {
    stage.value = 'viewer'
    return
  }
  loadingText.value = '组装模型加载中...'
  errorText.value = ''
  const offsetVec = new THREE.Vector3(
    config.braceletOffset.x,
    config.braceletOffset.y,
    config.braceletOffset.z
  )
  assemblyCleanup = createAssemblyScene(mountEl, {
    diyModelUrl: assemblyUrl,
    backgroundUrl: config.assemblyBg,
    braceletScale: config.braceletScale,
    braceletOffset: offsetVec,
    camRadius: config.camRadius,
    camYaw: config.camYaw,
    camPitch: config.camPitch,
    spinSpeed: config.spinSpeed,
    spinTurns: config.spinTurns,
    onProgress: (progress) => {
      const percent = Math.min(100, Math.max(0, Math.round(progress * 100)))
      loadingText.value = `组装模型加载中 ${percent}%`
    },
    onError: (message) => {
      errorText.value = message || '组装动画加载失败'
      transitionToViewerStage()
    },
    onFinished: () => {
      loadingText.value = ''
      transitionToViewerStage()
    }
  })
  assemblyInitialized.value = true
}

const runViewerStage = () => {
  if (viewerInitialized.value) return
  const mountEl = resolveMountElement(viewerMountRef)
  if (!mountEl) {
    errorText.value = '展示容器未准备好'
    return
  }
  const config = sequenceConfig.value
  let viewerUrl = config.viewerDiy
  if (config.useCachedViewer || (!viewerUrl && cachedDiyPayloadRef.value)) {
    if (!cachedDiyPayloadRef.value) {
      restoreCachedDiyPayload()
    }
    if (cachedDiyPayloadRef.value) {
      viewerUrl = createObjectUrlFromCachedPayload()
      activeViewerObjectUrl = viewerUrl
    }
  } else {
    activeViewerObjectUrl = ''
  }
  if (!viewerUrl) {
    errorText.value = '未找到 DIY 模型'
    return
  }
  loadingText.value = '佩戴展示加载中...'
  errorText.value = ''
  viewerCleanup = createViewerScene(mountEl, {
    diyUrl: viewerUrl,
    baseModelUrl: config.viewerBase || DEFAULT_BASE_MODEL,
    backgroundUrl: config.viewerBg || DEFAULT_BG,
    onProgress: (progress) => {
      const percent = Math.min(100, Math.max(0, Math.round(progress * 100)))
      loadingText.value = `加载中 ${percent}%`
    },
    onError: (message) => {
      errorText.value = message || '佩戴展示加载失败'
    }
  })
  viewerInitialized.value = true
}

const stopAssemblyStage = () => {
  if (assemblyCleanup) {
    assemblyCleanup()
    assemblyCleanup = null
  }
  if (activeAssemblyObjectUrl) {
    revokeCachedObjectUrl(activeAssemblyObjectUrl)
    activeAssemblyObjectUrl = ''
  }
  assemblyInitialized.value = false
}

const stopViewerStage = () => {
  if (viewerCleanup) {
    viewerCleanup()
    viewerCleanup = null
  }
  if (activeViewerObjectUrl) {
    revokeCachedObjectUrl(activeViewerObjectUrl)
    activeViewerObjectUrl = ''
  }
  viewerInitialized.value = false
}

const transitionToViewerStage = () => {
  stopAssemblyStage()
  stage.value = 'viewer'
}

const startStage = (value) => {
  if (value === 'assembly') {
    nextTick(runAssemblyStage)
  } else {
    nextTick(runViewerStage)
  }
}

watch(stage, (value, prev) => {
  if (prev === 'assembly' && value !== 'assembly') {
    stopAssemblyStage()
  }
  if (prev === 'viewer' && value !== 'viewer') {
    stopViewerStage()
  }
  startStage(value)
})

onMounted(() => {
  prepareSequenceConfig()
  startStage(stage.value)
})

onBeforeUnmount(() => {
  stopAssemblyStage()
  stopViewerStage()
  cachedObjectUrls.forEach((url) => {
    URL.revokeObjectURL(url)
  })
  cachedObjectUrls.clear()
})

const createAssemblyScene = (mountEl, options) => {
  const {
    diyModelUrl,
    backgroundUrl,
    braceletScale,
    braceletOffset,
    camRadius,
    camYaw,
    camPitch,
    spinSpeed,
    spinTurns,
    onProgress,
    onError,
    onFinished
  } = options
  if (!diyModelUrl) return null
  let disposed = false
  let animationId = 0
  const scene = new THREE.Scene()
  const clock = new THREE.Clock()

  const texLoader = new THREE.TextureLoader()
  let bgTexture = null
  const fallbackColor = 0x0c0d0f
  if (backgroundUrl) {
    try {
      bgTexture = texLoader.load(
        backgroundUrl,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace
          scene.background = tex
        },
        undefined,
        () => {
          scene.background = new THREE.Color(fallbackColor)
        }
      )
    } catch {
      scene.background = new THREE.Color(fallbackColor)
    }
  } else {
    scene.background = new THREE.Color(fallbackColor)
  }

  const braceletGroup = new THREE.Group()
  scene.add(braceletGroup)

  const getSize = () => ({
    width: mountEl.clientWidth || mountEl.offsetWidth || 1,
    height: mountEl.clientHeight || mountEl.offsetHeight || 1
  })
  const { width, height } = getSize()
  const camera = new THREE.PerspectiveCamera(55, width / height, 0.01, 10)
  camera.position.set(0.12, 0.06, 0.2)
  camera.lookAt(0, DEFAULT_HEIGHT, 0)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1
  mountEl.appendChild(renderer.domElement)

  const pmremGenerator = new THREE.PMREMGenerator(renderer)
  const envMap = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = envMap

  const hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 1.2)
  scene.add(hemi)
  const dir = new THREE.DirectionalLight(0xffffff, 1.6)
  dir.position.set(1, 1, 1)
  scene.add(dir)
  const rim = new THREE.DirectionalLight(0x88aaff, 0.8)
  rim.position.set(-1, 0.6, -0.6)
  scene.add(rim)

  const ringBasis = {
    center: new THREE.Vector3(0, DEFAULT_HEIGHT, 0),
    normal: new THREE.Vector3(0, 1, 0),
    topDir: new THREE.Vector3(0, 0, 1),
    sideDir: new THREE.Vector3(1, 0, 0),
    radius: DEFAULT_RING_RADIUS,
    avgDiameter: DEFAULT_RING_RADIUS * 0.02
  }

  let beadAnimations = []
  let sequenceEnd = 0
  let detailPhase = 'idle'
  let detailPhaseStart = 0
  let detailProgress = 0
  let spinProgress = 0
  const spinTarget = spinTurns * Math.PI * 2
  let finished = false

  const applyCamera = (detailFactor) => {
    const { center, radius, topDir, normal } = ringBasis
    const baseR = camRadius || radius * 3
    const baseYaw = camYaw
    const basePitch = camPitch
    const targetR = DETAIL_CAM_RADIUS || baseR * 0.6
    const targetYaw = baseYaw
    const targetPitch = DETAIL_CAM_PITCH
    const r = THREE.MathUtils.lerp(baseR, targetR, detailFactor)
    const yaw = THREE.MathUtils.lerp(baseYaw, targetYaw, detailFactor)
    const pitch = THREE.MathUtils.lerp(basePitch, targetPitch, detailFactor)
    const horizontal = r * Math.cos(pitch)
    const target = center
      .clone()
      .add(normal.clone().multiplyScalar(detailFactor * radius * DETAIL_TARGET_LIFT))
      .add(topDir.clone().multiplyScalar(detailFactor * radius * DETAIL_TOP_LIFT))
    const pos = new THREE.Vector3(
      target.x + horizontal * Math.sin(yaw),
      target.y + r * Math.sin(pitch),
      target.z + horizontal * Math.cos(yaw)
    )
    camera.position.copy(pos)
    camera.lookAt(target)
  }

  const collectBeads = (root) => {
    const sources = []
    const center = new THREE.Vector3()
    let diameterSum = 0
    let diameterCount = 0

    root.traverse((obj) => {
      const extras = obj.userData || {}
      if (!extras || !extras.isMarbleRoot) return
      const targetPos = obj.getWorldPosition(new THREE.Vector3())
      const targetQuat = obj.getWorldQuaternion(new THREE.Quaternion())
      const targetScale = obj.getWorldScale(new THREE.Vector3())
      center.add(targetPos)
      if (extras.bounds?.diameter) {
        diameterSum += extras.bounds.diameter
        diameterCount += 1
      }
      sources.push({ obj, extras, targetPos, targetQuat, targetScale })
    })

    if (!sources.length) {
      beadAnimations = []
      return
    }

    center.divideScalar(sources.length)

    const normal = new THREE.Vector3()
    for (let i = 0; i < sources.length; i += 1) {
      const a = sources[i].targetPos.clone().sub(center)
      const b = sources[(i + 1) % sources.length].targetPos.clone().sub(center)
      normal.add(a.cross(b))
    }
    if (normal.lengthSq() < 1e-6) {
      normal.set(0, 1, 0)
    } else {
      normal.normalize()
    }

    const worldUp = new THREE.Vector3(0, 1, 0)
    const topDir = worldUp.clone().sub(normal.clone().multiplyScalar(worldUp.dot(normal)))
    if (topDir.lengthSq() < 1e-6) {
      topDir.copy(sources[0].targetPos.clone().sub(center))
    }
    if (topDir.lengthSq() < 1e-6) {
      topDir.set(0, 0, 1)
    }
    topDir.normalize()
    const sideDir = new THREE.Vector3().crossVectors(normal, topDir).normalize()

    let radiusSum = 0
    let radiusCount = 0
    sources.forEach((s) => {
      const v = s.targetPos.clone().sub(center)
      const len = v.length()
      if (len > 0) {
        radiusSum += len
        radiusCount += 1
      }
    })
    const ringRadius = radiusCount > 0 ? radiusSum / radiusCount : DEFAULT_RING_RADIUS
    const avgDiameter =
      diameterCount > 0 ? diameterSum / diameterCount : Math.max(0.0005, ringRadius * 0.02)

    ringBasis.center = center
    ringBasis.normal = normal
    ringBasis.topDir = topDir
    ringBasis.sideDir = sideDir
    ringBasis.radius = ringRadius
    ringBasis.avgDiameter = avgDiameter

    const ringScale =
      ringRadius > 1e-6 ? (ringRadius + RING_RADIUS_EXTRA) / ringRadius : 1
    if (Math.abs(ringScale - 1) > 1e-6) {
      root.traverse((obj) => {
        const name = obj.name?.toLowerCase?.() || ''
        if (name.includes('rope') || name.includes('ring') || name.includes('circle')) {
          obj.scale.multiplyScalar(ringScale)
          obj.updateMatrixWorld(true)
        }
      })
    }

    sources.sort((a, b) => {
      const aVec = a.targetPos.clone().sub(center)
      const bVec = b.targetPos.clone().sub(center)
      const aAngleRaw = Math.atan2(aVec.dot(sideDir), aVec.dot(topDir))
      const bAngleRaw = Math.atan2(bVec.dot(sideDir), bVec.dot(topDir))
      const aAngle = a.extras?.arcStart ?? a.extras?.currentAngle ?? aAngleRaw
      const bAngle = b.extras?.arcStart ?? b.extras?.currentAngle ?? bAngleRaw
      return aAngle - bAngle
    })
    sources.reverse()

    const beads = []
    const startAngle = 0.1
    const spawnPos = topDir
      .clone()
      .multiplyScalar(Math.cos(startAngle) * ringRadius)
      .add(sideDir.clone().multiplyScalar(Math.sin(startAngle) * ringRadius))
      .add(center)
      .add(normal.clone().multiplyScalar(0.01))
    const twoPi = Math.PI * 2
    const baseStart = clock.getElapsedTime()
    const perBeadDelay = DEFAULT_PER_BEAD_DELAY
    const flightDuration = DEFAULT_FLIGHT_DURATION
    const arcHeightBase = 0

    sources.forEach((source, index) => {
      const vec = source.targetPos.clone().sub(center)
      let targetAngle = Math.atan2(vec.dot(sideDir), vec.dot(topDir))
      while (targetAngle < startAngle - 1e-6) targetAngle += twoPi
      const angleDelta = targetAngle - startAngle

      const targetPos = topDir
        .clone()
        .multiplyScalar(Math.cos(targetAngle) * ringRadius)
        .add(sideDir.clone().multiplyScalar(Math.sin(targetAngle) * ringRadius))
        .add(center)
      const startPos = spawnPos.clone()
      const beadClone = source.obj.clone(true)
      beadClone.position.copy(spawnPos)
      beadClone.quaternion.copy(source.targetQuat)
      beadClone.scale.copy(source.targetScale)
      beadClone.visible = false
      braceletGroup.add(beadClone)

      const arcHeight = arcHeightBase

      beads.push({
        object: beadClone,
        startTime: baseStart + index * perBeadDelay,
        duration: flightDuration,
        spawnPos: spawnPos.clone(),
        startPos,
        targetPos,
        startAngle,
        targetAngle,
        angleDelta,
        startQuat: source.targetQuat.clone(),
        targetQuat: source.targetQuat.clone(),
        arcHeight,
        baseScale: source.targetScale.clone()
      })

      source.obj.visible = false
    })

    beadAnimations = beads
    sequenceEnd =
      beads.length > 0 ? baseStart + (beads.length - 1) * perBeadDelay + flightDuration : 0
    detailPhase = 'idle'
    detailPhaseStart = 0
    detailProgress = 0
    spinProgress = 0
    finished = false
    applyCamera(0)
  }

  const loader = new GLTFLoader()
  loader.load(
    diyModelUrl,
    (gltf) => {
      if (disposed) return
      const diyRoot = gltf.scene
      diyRoot.position.set(
        braceletOffset.x,
        DEFAULT_HEIGHT + braceletOffset.y,
        braceletOffset.z
      )
      diyRoot.rotation.set(0, 0, 0)
      diyRoot.scale.set(braceletScale, braceletScale, braceletScale)
      braceletGroup.add(diyRoot)

      diyRoot.updateMatrixWorld(true)
      collectBeads(diyRoot)
      if (onProgress) onProgress(1)
    },
    (xhr) => {
      if (disposed) return
      const total = xhr.total || 1
      if (onProgress) onProgress(xhr.loaded / total)
    },
    (error) => {
      console.error('Failed to load diy model', error)
      if (!disposed && onError) {
        onError('组装模型加载失败')
      }
    }
  )

  const animate = () => {
    if (disposed) return
    animationId = requestAnimationFrame(animate)
    const delta = clock.getDelta()
    const now = clock.elapsedTime

    if (sequenceEnd > 0) {
      if (detailPhase === 'idle' && now >= sequenceEnd + DETAIL_DELAY) {
        detailPhase = 'zoomIn'
        detailPhaseStart = now
      }
      if (detailPhase === 'zoomIn') {
        const p = Math.min(1, (now - detailPhaseStart) / DETAIL_ZOOM_IN)
        detailProgress = p
        if (p >= 1) {
          detailPhase = 'hold'
          detailPhaseStart = now
        }
      } else if (detailPhase === 'hold') {
        detailProgress = 1
        if (now - detailPhaseStart >= DETAIL_HOLD) {
          detailPhase = 'zoomOut'
          detailPhaseStart = now
        }
      } else if (detailPhase === 'zoomOut') {
        const p = Math.min(1, (now - detailPhaseStart) / DETAIL_ZOOM_OUT)
        detailProgress = 1 - p
        if (p >= 1) {
          detailPhase = 'done'
        }
      } else if (detailPhase === 'done') {
        detailProgress = 0
      }
    }

    const { radius, avgDiameter, normal } = ringBasis
    const gapDelta =
      detailProgress * ((DETAIL_RADIUS_GAP_FACTOR * (avgDiameter || 0)) / Math.max(radius, 1e-6))
    const detailScale = 1 + detailProgress * (DETAIL_SCALE - 1)
    const groupScale = detailScale * (1 + gapDelta)
    braceletGroup.scale.setScalar(groupScale)
    const lift = detailProgress * radius * DETAIL_GROUP_LIFT
    braceletGroup.position.copy(normal.clone().multiplyScalar(lift))

    if (beadAnimations.length) {
      const { center, topDir, sideDir } = ringBasis
      beadAnimations.forEach((item) => {
        const t = (now - item.startTime) / item.duration
        if (t <= 0) {
          item.object.visible = false
          return
        }
        const clamped = Math.min(1, t)
        const eased = clamped * clamped * (3 - 2 * clamped)
        item.object.visible = true
        const angle = item.startAngle + item.angleDelta * eased
        const pos = topDir
          .clone()
          .multiplyScalar(Math.cos(angle) * ringBasis.radius)
          .add(sideDir.clone().multiplyScalar(Math.sin(angle) * ringBasis.radius))
          .add(center)
        item.object.position.copy(pos)
        const beadScaleFactor = 1 / (1 + gapDelta)
        item.object.scale.copy(item.baseScale).multiplyScalar(beadScaleFactor)
        item.object.quaternion.slerpQuaternions(item.startQuat, item.targetQuat, eased)
      })
    }

    if (detailPhase === 'done') {
      const spinAxis = new THREE.Vector3(0, 1, 0)
      if (spinProgress < spinTarget) {
        const step = spinSpeed * delta
        const remaining = spinTarget - spinProgress
        const applied = Math.min(step, remaining)
        braceletGroup.rotateOnWorldAxis(spinAxis, applied)
        spinProgress += applied
      }
      const spinDone =
        spinProgress >= spinTarget - 1e-6 || spinTarget <= 1e-6 || spinSpeed <= 1e-6
      if (!finished && spinDone) {
        finished = true
        if (typeof onFinished === 'function') {
          onFinished()
        }
      }
    }

    applyCamera(detailProgress)
    renderer.render(scene, camera)
  }
  animate()

  const handleResize = () => {
    if (disposed) return
    const size = getSize()
    camera.aspect = size.width / size.height
    camera.updateProjectionMatrix()
    renderer.setSize(size.width, size.height)
    applyCamera(detailProgress)
  }
  window.addEventListener('resize', handleResize)

  return () => {
    disposed = true
    window.removeEventListener('resize', handleResize)
    cancelAnimationFrame(animationId)
    if (mountEl && renderer.domElement?.parentNode === mountEl) {
      mountEl.removeChild(renderer.domElement)
    }
    if (bgTexture) {
      bgTexture.dispose()
    }
    pmremGenerator.dispose()
    envMap.dispose?.()
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose())
        } else {
          obj.material.dispose()
        }
      }
    })
    renderer.dispose()
    beadAnimations = []
  }
}

const createViewerScene = (mountEl, options) => {
  const { diyUrl, baseModelUrl, backgroundUrl, onProgress, onError } = options
  let disposed = false
  let animationId = 0
  const scene = new THREE.Scene()
  const texLoader = new THREE.TextureLoader()
  try {
    const bgTex = texLoader.load(
      backgroundUrl || DEFAULT_BG,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        scene.background = tex
      },
      undefined,
      () => {
        scene.background = new THREE.Color(0x0c0d0f)
      }
    )
    scene.background = bgTex
  } catch {
    scene.background = new THREE.Color(0x0c0d0f)
  }

  const getSize = () => ({
    width: mountEl.clientWidth || mountEl.offsetWidth || 1,
    height: mountEl.clientHeight || mountEl.offsetHeight || 1
  })
  const size = getSize()
  const camera = new THREE.PerspectiveCamera(75, size.width / size.height, 0.1, 1000)
  camera.position.set(2, 2, 5)
  camera.lookAt(0, 0, 0)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(size.width, size.height)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  mountEl.appendChild(renderer.domElement)

  const pmremGenerator = new THREE.PMREMGenerator(renderer)
  const envMap = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = envMap

  const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 2)
  hemisphereLight.position.set(0, 20, 0)
  scene.add(hemisphereLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 2)
  directionalLight.position.set(10, 10, 10)
  scene.add(directionalLight)

  const directionalLight2 = new THREE.DirectionalLight(0xffffff, 1)
  directionalLight2.position.set(-10, -10, -10)
  scene.add(directionalLight2)

  const loader = new GLTFLoader()
  let mixer = null
  const clock = new THREE.Clock()

  loader.load(
    baseModelUrl || DEFAULT_BASE_MODEL,
    (gltf) => {
      if (disposed) return
      const model = gltf.scene
      model.position.set(3.4, 1.4, 0)
      model.rotation.set(1, 1, 1)
      model.scale.set(4.5, 4.5, 4.5)
      scene.add(model)

      if (gltf.animations && gltf.animations.length) {
        mixer = new THREE.AnimationMixer(model)
        const sourceClip = gltf.animations[0]
        const fullDur = sourceClip.duration
        const windowStart = Math.max(0, fullDur * 0.35)
        const windowEnd = Math.max(windowStart + 0.0001, fullDur * 0.44)
        const fps = 30
        const windowClip = THREE.AnimationUtils.subclip(
          sourceClip,
          'windowClip',
          windowStart * fps,
          windowEnd * fps,
          fps
        )
        const action = mixer.clipAction(windowClip)
        action.setLoop(THREE.LoopOnce, 0)
        action.clampWhenFinished = true
        action.setDuration(1.6)
        action.reset().play()
      }

      const ropeBone = model.getObjectByName('rope')
      const ropeMesh = model.getObjectByName('RopeMesh')
      if (ropeMesh) ropeMesh.visible = false

      if (ropeBone && diyUrl) {
        const beadGroup = new THREE.Group()
        beadGroup.name = 'AnimatedBeads'
        ropeBone.add(beadGroup)

        const localToBone = new THREE.Matrix4()
        const targetMatrix = new THREE.Matrix4()
        const targetPos = new THREE.Vector3()
        const targetQuat = new THREE.Quaternion()
        const targetScale = new THREE.Vector3()

        const diyLoader = new GLTFLoader()
        diyLoader.load(
          diyUrl,
          (diyGltf) => {
            if (disposed) return
            const diyRoot = new THREE.Group()
            diyRoot.name = 'DIYBraceletAttachment'
            diyGltf.scene.position.set(0, 0, 0)
            diyGltf.scene.rotation.set(0, 0, 0)
            diyGltf.scene.scale.set(1, 1, 1)
            diyRoot.add(diyGltf.scene)

            ropeBone.updateMatrixWorld(true)
            ropeMesh?.updateMatrixWorld(true)
            const boneWorldQuat = ropeBone.getWorldQuaternion(new THREE.Quaternion())
            const targetQ = ropeMesh?.getWorldQuaternion(new THREE.Quaternion())
            if (targetQ) {
              const localQuat = boneWorldQuat.clone().invert().multiply(targetQ)
              diyRoot.quaternion.copy(localQuat)
              diyRoot.rotation.x += 0.2
              diyRoot.rotation.y -= 0.48
              diyRoot.rotation.z -= 0.4
              diyRoot.rotateY(0.1)
              diyRoot.rotateX(-0.2)
            }

            diyRoot.position.set(0.5, -0.2, 0)
            diyRoot.scale.set(100, 100, 100)
            const nonUniformScale = new THREE.Vector3(1.05, 1.05, 1.05)
            diyRoot.scale.multiply(nonUniformScale)
            const inverseScale = new THREE.Vector3(
              1 / nonUniformScale.x,
              1 / nonUniformScale.y,
              1 / nonUniformScale.z
            )
            diyRoot.traverse((obj) => {
              if (obj.isMesh) {
                obj.scale.multiply(inverseScale)
              }
            })
            ropeBone.add(diyRoot)

            if (ropeMesh) {
              ropeBone.updateMatrixWorld(true)
              diyRoot.updateMatrixWorld(true)
              const ropeBox = new THREE.Box3().setFromObject(ropeMesh)
              const diyBox = new THREE.Box3().setFromObject(diyRoot)
              const ropeSphere = ropeBox.getBoundingSphere(new THREE.Sphere())
              const diySphere = diyBox.getBoundingSphere(new THREE.Sphere())
              const braceletTightness = 0.8
              if (ropeSphere.radius > 0 && diySphere.radius > 0) {
                const fitScale = (ropeSphere.radius / diySphere.radius) * braceletTightness
                diyRoot.scale.multiplyScalar(fitScale)
                diyRoot.updateMatrixWorld(true)
              }
            }

            const baseLocalPosition = diyRoot.position.clone()
            const baseLocalScale = diyRoot.scale.clone()
            const baseParentScale = new THREE.Vector3()
            const currentParentScale = new THREE.Vector3()
            const safeParentScale = new THREE.Vector3()
            ropeBone.updateMatrixWorld(true)
            ropeBone.getWorldScale(baseParentScale)

            let updateBraceletTransform = () => {}
            updateBraceletTransform = () => {
              ropeBone.updateMatrixWorld(true)
              ropeBone.getWorldScale(currentParentScale)
              safeParentScale.set(
                Math.abs(currentParentScale.x) < 1e-6 ? 1e-6 : currentParentScale.x,
                Math.abs(currentParentScale.y) < 1e-6 ? 1e-6 : currentParentScale.y,
                Math.abs(currentParentScale.z) < 1e-6 ? 1e-6 : currentParentScale.z
              )
              diyRoot.position.copy(baseLocalPosition).multiply(baseParentScale).divide(safeParentScale)
              diyRoot.scale.copy(baseLocalScale).multiply(baseParentScale).divide(safeParentScale)
            }
            updateBraceletTransform()

            diyRoot.updateMatrixWorld(true)
            ropeBone.updateMatrixWorld(true)
            const ropeWorldInv = localToBone.copy(ropeBone.matrixWorld).invert()

            diyRoot.traverse((obj) => {
              const extras = obj.userData || {}
              if (!extras.isMarbleRoot) return
              obj.updateMatrixWorld(true)
              targetMatrix.multiplyMatrices(ropeWorldInv, obj.matrixWorld)
              targetMatrix.decompose(targetPos, targetQuat, targetScale)
              const beadClone = obj.clone(true)
              beadClone.position.copy(targetPos)
              beadClone.quaternion.copy(targetQuat)
              beadClone.scale.copy(targetScale)
              beadClone.visible = true
              beadGroup.add(beadClone)
              obj.visible = false
            })
          },
          undefined,
          (error) => {
            if (disposed) return
            console.error('Failed to load DIY bracelet glTF:', error)
            if (onError) onError('DIY 模型加载失败')
          }
        )
      } else if (!diyUrl && onError) {
        onError('未找到 DIY 模型')
      }

      if (onProgress) onProgress(1)
    },
    (xhr) => {
      if (disposed) return
      const total = xhr.total || 1
      if (onProgress) onProgress(xhr.loaded / total)
    },
    (error) => {
      console.error('An error happened during loading:', error)
      if (!disposed && onError) onError('基础模型加载失败')
    }
  )

  const animate = () => {
    if (disposed) return
    animationId = requestAnimationFrame(animate)
    const delta = clock.getDelta()
    if (mixer) mixer.update(delta)
    renderer.render(scene, camera)
  }
  animate()

  const handleResize = () => {
    if (disposed) return
    const nextSize = getSize()
    camera.aspect = nextSize.width / nextSize.height
    camera.updateProjectionMatrix()
    renderer.setSize(nextSize.width, nextSize.height)
  }
  window.addEventListener('resize', handleResize)

  return () => {
    disposed = true
    window.removeEventListener('resize', handleResize)
    cancelAnimationFrame(animationId)
    if (mountEl && renderer.domElement?.parentNode === mountEl) {
      mountEl.removeChild(renderer.domElement)
    }
    pmremGenerator.dispose()
    envMap.dispose?.()
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose())
        } else {
          obj.material.dispose()
        }
      }
    })
    renderer.dispose()
  }
}
</script>

<style scoped>
.page {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: fixed;
  inset: 0;
  background: #000;
}
.canvas-container {
  width: 100%;
  height: 100%;
  position: relative;
}
.stage-indicator {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  border-radius: 8px;
  font-size: 14px;
  z-index: 10;
}
.toast,
.error {
  position: absolute;
  top: 60px;
  left: 12px;
  right: 12px;
  padding: 10px 12px;
  font-size: 14px;
  color: #fff;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.55);
  pointer-events: none;
}
.error {
  top: auto;
  bottom: 12px;
  background: rgba(217, 83, 79, 0.8);
}
</style>
