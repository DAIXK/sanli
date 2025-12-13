<template>
  <view class="page" :style="pageStyle">
    <view
      v-if="recordingOverlayEnabled && recordingOverlayVisible"
      class="recording-overlay"
    >
      <view class="spinner"></view>
      <view class="overlay-title">{{ overlayTitle }}</view>
    </view>
    <!-- <view class="overlay-toggle" @tap="toggleRecordingOverlay">
      {{ recordingOverlayEnabled ? '遮罩开' : '遮罩关' }}
    </view> -->
    <view
      v-if="!snapshotOnlyMode"
      v-show="stage === 'assembly'"
      class="canvas-container"
      :style="containerStyle"
      ref="assemblyMountRef"
    ></view>
    <view
      v-if="!snapshotOnlyMode"
      v-show="stage === 'viewer'"
      class="canvas-container"
      :style="containerStyle"
      ref="viewerMountRef"
    ></view>
    <view v-if="!snapshotOnlyMode" class="stage-indicator">{{ stageLabel }}</view>
    <!-- <view class="toast" v-if="loadingText">{{ loadingText }}</view> -->
    <view class="error" v-if="errorText">{{ errorText }}</view>
    
  
    
    <!-- Left Debug Panel (Model & Camera) -->
    <view class="debug-panel" v-if="stage === 'viewer' && debugParams.showPanel">
      <view class="debug-item">
        <text>Scale:</text>
        <input type="number" v-model.number="debugParams.scale" step="0.1" />
      </view>
      <view class="debug-item">
        <text>Rot X:</text>
        <input type="number" v-model.number="debugParams.rotX" step="0.1" />
      </view>
      <view class="debug-item">
        <text>Rot Y:</text>
        <input type="number" v-model.number="debugParams.rotY" step="0.1" />
      </view>
      <view class="debug-item">
        <text>Rot Z:</text>
        <input type="number" v-model.number="debugParams.rotZ" step="0.1" />
      </view>
      <view class="debug-item">
        <text>Pos X:</text>
        <input type="number" v-model.number="debugParams.posX" step="0.1" />
      </view>
      <view class="debug-item">
        <text>Pos Y:</text>
        <input type="number" v-model.number="debugParams.posY" step="0.1" />
      </view>
      <view class="debug-item">
        <text>Pos Z:</text>
        <input type="number" v-model.number="debugParams.posZ" step="0.1" />
      </view>
      <view class="debug-item">
        <text>Cam Z:</text>
        <input type="number" v-model.number="debugParams.cameraZoom" step="0.1" />
      </view>
      <view class="debug-item">
        <text>Anim Start:</text>
        <input type="number" v-model.number="debugParams.animStart" step="0.1" />
      </view>
      <view class="debug-item">
        <text>Anim End:</text>
        <input type="number" v-model.number="debugParams.animEnd" step="0.1" />
      </view>
      <view class="debug-item">
        <text>Speed:</text>
        <input type="number" v-model.number="debugParams.animSpeed" step="0.1" />
      </view>
      <view class="debug-item">
        <text>Amb Int:</text>
        <input type="number" v-model.number="debugParams.ambientIntensity" step="0.1" />
      </view>
      <view class="debug-item">
        <text>Dir Int:</text>
        <input type="number" v-model.number="debugParams.dirIntensity" step="0.1" />
      </view>
      <view class="debug-item">
        <text>Dir X:</text>
        <input type="number" v-model.number="debugParams.dirX" step="1" />
      </view>
      <view class="debug-item">
        <text>Dir Y:</text>
        <input type="number" v-model.number="debugParams.dirY" step="1" />
      </view>
      <view class="debug-item">
        <text>Dir Z:</text>
        <input type="number" v-model.number="debugParams.dirZ" step="1" />
      </view>
      <button class="debug-btn" @click="replayAnimation">Replay</button>
    </view>

    <!-- Right Debug Panel (Bracelet) -->
    <view class="debug-panel debug-panel-right" v-if="stage === 'viewer' && debugParams.showPanel">
      <view class="debug-item">
        <text>B.Scale:</text>
        <input type="number" v-model.number="braceletDebugParams.scale" step="0.1" />
      </view>
      <view class="debug-item">
        <text>B.Rot X:</text>
        <input type="number" v-model.number="braceletDebugParams.rotX" step="0.1" />
      </view>
      <view class="debug-item">
        <text>B.Rot Y:</text>
        <input type="number" v-model.number="braceletDebugParams.rotY" step="0.1" />
      </view>
      <view class="debug-item">
        <text>B.Rot Z:</text>
        <input type="number" v-model.number="braceletDebugParams.rotZ" step="0.1" />
      </view>
      <view class="debug-item">
        <text>B.Pos X:</text>
        <input type="number" v-model.number="braceletDebugParams.posX" step="0.01" />
      </view>
      <view class="debug-item">
        <text>B.Pos Y:</text>
        <input type="number" v-model.number="braceletDebugParams.posY" step="0.01" />
      </view>
      <view class="debug-item">
        <text>B.Pos Z:</text>
        <input type="number" v-model.number="braceletDebugParams.posZ" step="0.01" />
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

import { saveModelToDB, loadModelFromDB } from '../../utils/db.js'
import { buildApiUrl } from '../../utils/api'

const DIY_CACHE_KEY = 'bracelet_diy_model_cache'
const VIDEO_CACHE_KEY = 'bracelet_generated_video_cache'
// const DEFAULT_BASE_MODEL = '/static/models/Human-Arm-Animation.gltf'
const DEFAULT_BASE_MODEL = '/static/models/human2.gltf'

const debugParams = ref({
  scale: 142.4,
  rotX: 1.8,
  rotY: 2.4,
  rotZ: 1,
  posX: 3.6,
  posY: -5.8,
  posZ: -1.4,
  cameraZoom: 1,
  animStart: 1.8,
  animEnd: 2,
  animSpeed: 0.1,
  ambientIntensity: 6.9,
  dirIntensity: 1.9,
  dirX: 3,
  dirY: 3,
  dirX: 3,
  dirY: 3,
  dirZ: 3,
  showPanel: false
})

const replayTrigger = ref(0)
const replayAnimation = () => {
  replayTrigger.value++
}

const braceletDebugParams = ref({
  scale: 1.2,
  rotX: -0.1,
  rotY: -1,
  rotZ: 0,
  posX: -0.29,
  posY: 0,
  posZ: 0
})

const DEFAULT_BG = '/static/img/background.png'
const VIDEO_FILE_REGEX = /\.(mp4|webm|ogg|m4v)$/i
const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000 // 7 days
const uploadState = ref('idle') // idle | uploading | success | error
const uploadError = ref('')
const uploadedVideoUrl = ref('')
const uploadedSnapshotUrl = ref('')
const autoRecordEnabled = ref(true)
const snapshotOnlyMode = ref(false)
const recordingOverlayEnabled = ref(true)
const recordingOverlayVisible = ref(false)
const toggleRecordingOverlay = () => {
  recordingOverlayEnabled.value = !recordingOverlayEnabled.value
  if (!recordingOverlayEnabled.value) {
    recordingOverlayVisible.value = false
  } else if (mediaRecorder.value && mediaRecorder.value.state === 'recording') {
    recordingOverlayVisible.value = true
  }
}

const notify = (title, icon = 'none') => {
  if (typeof uni !== 'undefined' && typeof uni.showToast === 'function') {
    uni.showToast({ title, icon })
  }
}

const getSnapshotBlob = () =>
  new Promise((resolve, reject) => {
    if (!recordingCanvas) {
      reject(new Error('暂无可用的截图画布'))
      return
    }
    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = recordingCanvas.width
    exportCanvas.height = recordingCanvas.height
    const ctx = exportCanvas.getContext('2d')
    if (!ctx) {
      reject(new Error('无法获取导出画布上下文'))
      return
    }
    // 白底
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
    ctx.drawImage(recordingCanvas, 0, 0, exportCanvas.width, exportCanvas.height)
    exportCanvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('生成截图失败'))
        }
      },
      'image/jpeg',
      0.92
    )
  })

const uploadSnapshotImage = async () => {
  try {
    const blob = await getSnapshotBlob()
    const file = new File([blob], `bracelet-snapshot-${Date.now()}.jpg`, {
      type: 'image/jpeg'
    })
    const formData = new FormData()
    formData.append('file', file)
    const endpoint = buildApiUrl('/api/mobile/upload')
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData
    })
    if (!response.ok) {
      const txt = await response.text().catch(() => '')
      throw new Error(`图片上传失败 ${response.status} ${txt}`)
    }
    const contentType = response.headers?.get?.('content-type') || ''
    let result = null
    if (contentType.includes('application/json')) {
      result = await response.json().catch(() => null)
    } else {
      const text = await response.text()
      try {
        result = text ? JSON.parse(text) : null
      } catch {
        result = { url: text }
      }
    }
    const imageUrl =
      result?.url || result?.data?.url || result?.imageUrl || result?.image_url || null
    if (imageUrl) {
      uploadedSnapshotUrl.value = imageUrl
      console.log('Recorder: snapshot image url', imageUrl)
    }
    return imageUrl
  } catch (error) {
    console.warn('截图上传失败', error)
    return null
  }
}

const buildQueryString = (params = {}) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    search.append(key, String(value))
  })
  const str = search.toString()
  return str ? `?${str}` : ''
}

const sendVideoUrlToMiniProgram = (url, options = {}) => {
  const { allowEmpty = false, snapshotUrl } = options
  const finalUrl = url || ''
  if (!finalUrl && !allowEmpty) return false
  const beadSummaryString = JSON.stringify(sequenceConfig.value?.beadSummary || [])
  const extras = {
    ringSize: sequenceConfig.value?.ringSize,
    braceletId: sequenceConfig.value?.braceletId,
    braceletName: sequenceConfig.value?.braceletName,
    productId: sequenceConfig.value?.productId,
    productName: sequenceConfig.value?.productName,
    productImage: sequenceConfig.value?.productImage,
    beadSize: sequenceConfig.value?.beadSize,
    price: sequenceConfig.value?.price,
    formattedPrice: sequenceConfig.value?.formattedPrice,
    selectedProductIndex: sequenceConfig.value?.selectedProductIndex,
    marbleCount: sequenceConfig.value?.marbleCount,
    beadSummary: beadSummaryString,
    snapshotUrl: snapshotUrl ?? uploadedSnapshotUrl.value
  }
  const payload = {
    action: 'navigateToVideo',
    url: finalUrl,
    videoUrl: finalUrl,
    ...extras
  }
  const query = buildQueryString({ videoUrl: finalUrl, ...extras })
  let delivered = false
  try {
    const bridge = window?.wx?.miniProgram
    if (bridge) {
      if (typeof bridge.postMessage === 'function') {
        bridge.postMessage({ data: payload })
        delivered = true
        console.log('Recorder: postMessage video url to mini program', finalUrl)
      }
      if (typeof bridge.navigateTo === 'function') {
        const target = `/pages/video/index${query}`
        bridge.navigateTo({ url: target })
        delivered = true
        console.log('Recorder: navigateTo mini program video page', target)
      }
    }
  } catch (error) {
    console.warn('Mini program communication failed', error)
  }
  return delivered
}

const sendSnapshotToMiniProgram = () => {
  const snapshot = uploadedSnapshotUrl.value || sequenceConfig.value?.snapshotUrl || ''
  if (!snapshot) {
    errorText.value = '未找到截图，无法发送至小程序'
    console.warn('Snapshot URL missing, cannot notify mini program')
    return false
  }
  const delivered = sendVideoUrlToMiniProgram('', { allowEmpty: true, snapshotUrl: snapshot })
  if (!delivered) {
    errorText.value = '发送到小程序失败，请重试'
  }
  return delivered
}

const uploadRecordedVideo = async (blob, mimeType) => {
  if (!(blob instanceof Blob) || blob.size <= 0) {
    throw new Error('无效的视频数据')
  }
  if (typeof fetch !== 'function' || typeof FormData === 'undefined') {
    throw new Error('当前环境不支持视频上传')
  }
  uploadState.value = 'uploading'
  uploadError.value = ''
  const useMp4 = mimeType?.includes?.('mp4')
  const safeType = useMp4 ? 'video/mp4' : 'video/webm'
  const ext = useMp4 ? 'mp4' : 'webm'
  const normalizedFile = new File([blob], `bracelet-${Date.now()}.${ext}`, { type: safeType })
  const formData = new FormData()
  formData.append('file', normalizedFile)
  // 兼容后端字段名可能是 video
  formData.append('video', normalizedFile)
  const endpoint = buildApiUrl('/api/mobile/upload-video')

  try {
    const response = await fetch(endpoint, { method: 'POST', body: formData })
    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      console.warn('视频上传接口返回非 2xx', response.status, errorText)
      throw new Error(`上传失败 (${response.status})`)
    }
    const contentType = response.headers?.get?.('content-type') || ''
    let result = null
    if (contentType.includes('application/json')) {
      result = await response.json().catch(() => null)
    } else {
      const text = await response.text()
      try {
        result = text ? JSON.parse(text) : null
      } catch {
        result = { url: text }
      }
    }
    uploadedVideoUrl.value =
      result?.url || result?.videoUrl || result?.data?.url || uploadedVideoUrl.value
    uploadState.value = 'success'
    if (uploadedVideoUrl.value) {
      console.log('Recorder: uploaded video url', uploadedVideoUrl.value)
      await uploadSnapshotImage()
      sendVideoUrlToMiniProgram(uploadedVideoUrl.value)
    }
    // notify('视频上传成功', 'success')
    return result
  } catch (error) {
    uploadState.value = 'error'
    uploadError.value = error?.message || '上传失败'
    console.warn('视频上传失败', error)
    notify('视频上传失败', 'none')
    throw error
  }
}



// Recording defaults / fallback
const RECORDING_MAX_DURATION = 15_000 // force stop after 15s to ensure onstop runs
let recordingTimeout = null

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
const containerStyle = computed(() => {
  if (snapshotOnlyMode.value) {
    return {
      backgroundImage: 'none',
      backgroundColor: 'transparent'
    }
  }
  const bgUrl =
    stage.value === 'assembly'
      ? sequenceConfig.value.assemblyBg || DEFAULT_BG
      : sequenceConfig.value.viewerBg || DEFAULT_BG
  const isVideoBg = VIDEO_FILE_REGEX.test(bgUrl || '')
  return {
    backgroundImage: !isVideoBg && bgUrl ? `url(${bgUrl})` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat'
  }
})
const pageStyle = computed(() => {
  if (snapshotOnlyMode.value) {
    return {
      backgroundColor: 'transparent',
      backgroundImage: 'none'
    }
  }
  const bgUrl =
    stage.value === 'assembly'
      ? sequenceConfig.value.assemblyBg || DEFAULT_BG
      : sequenceConfig.value.viewerBg || DEFAULT_BG
  const isVideoBg = VIDEO_FILE_REGEX.test(bgUrl || '')
  return {
    backgroundColor: '#000',
    backgroundImage: !isVideoBg && bgUrl ? `url(${bgUrl})` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  }
})
const overlayTitle = computed(() => (snapshotOnlyMode.value ? '生成图片中' : '生成视频中'))

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

// Recording state
let recordingCanvas = null
const mediaRecorder = ref(null)
const recordedChunks = ref([])
const lastRecordedBlob = ref(null)
const showDownloadBtn = ref(false)
const downloadUrl = ref('')
const downloadExt = ref('webm')
let holdFrameCanvas = null
let holdFrameUntil = 0
let holdFrameRaf = 0

const stopFrameHold = () => {
  if (holdFrameRaf) {
    cancelAnimationFrame(holdFrameRaf)
    holdFrameRaf = 0
  }
  holdFrameCanvas = null
  holdFrameUntil = 0
}

const pumpHoldFrame = () => {
  if (!recordingCanvas || !holdFrameCanvas) {
    stopFrameHold()
    return
  }
  const ctx = recordingCanvas.getContext('2d')
  if (!ctx) {
    stopFrameHold()
    return
  }
  ctx.drawImage(holdFrameCanvas, 0, 0, recordingCanvas.width, recordingCanvas.height)
  if (Date.now() >= holdFrameUntil) {
    stopFrameHold()
    return
  }
  holdFrameRaf = requestAnimationFrame(pumpHoldFrame)
}

const startFrameHold = (duration = 1200) => {
  if (!recordingCanvas) return
  const cached = document.createElement('canvas')
  cached.width = recordingCanvas.width
  cached.height = recordingCanvas.height
  const sourceCtx = recordingCanvas.getContext('2d')
  const cacheCtx = cached.getContext('2d')
  if (!sourceCtx || !cacheCtx) return
  cacheCtx.drawImage(recordingCanvas, 0, 0)
  holdFrameCanvas = cached
  holdFrameUntil = Date.now() + duration
  if (!holdFrameRaf) {
    holdFrameRaf = requestAnimationFrame(pumpHoldFrame)
  }
}

const finalizeRecording = async (blob, mimeType) => {
  if (!(blob instanceof Blob)) return
  lastRecordedBlob.value = blob
  downloadUrl.value = URL.createObjectURL(blob)
  downloadExt.value = mimeType.includes('mp4') ? 'mp4' : 'webm'
  showDownloadBtn.value = true
  console.log('Recorder: download button should show')

  try {
    await saveModelToDB(VIDEO_CACHE_KEY, {
      blob,
      type: mimeType,
      savedAt: Date.now()
    })
    console.log('Recorder: video cached to IndexedDB')
  } catch (error) {
    console.warn('Recorder: failed to cache video', error)
  }

  try {
    console.log('Recorder: start upload to /api/mobile/upload-video')
    await uploadRecordedVideo(blob, mimeType)
  } catch (error) {
    console.warn('Recorder: upload failed', error)
  }
}

const clearRecordingTimeout = () => {
  if (recordingTimeout) {
    clearTimeout(recordingTimeout)
    recordingTimeout = null
  }
}

const forceStopRecording = () => {
  if (mediaRecorder.value && mediaRecorder.value.state === 'recording') {
    console.log('Recorder: force stop (timeout reached)')
    mediaRecorder.value.stop()
    return
  }
  if (!lastRecordedBlob.value && recordedChunks.value.length) {
    const mime = recordedChunks.value[0]?.type || 'video/webm'
    const blob = new Blob(recordedChunks.value, { type: mime })
    console.log('Recorder: force finalize after timeout, blob size', blob.size)
    finalizeRecording(blob, mime)
  }
}

const startRecording = () => {
  stopFrameHold()
  recordedChunks.value = []
  downloadUrl.value = ''
  uploadedVideoUrl.value = ''
  uploadState.value = 'idle'
  uploadError.value = ''
  lastRecordedBlob.value = null
  recordingOverlayVisible.value = recordingOverlayEnabled.value
  clearRecordingTimeout()
  // Create canvas programmatically to avoid uni-app template issues
  if (!recordingCanvas) {
    recordingCanvas = document.createElement('canvas')
  }
  if (!recordingCanvas.parentNode && typeof document !== 'undefined') {
    // Some browsers require the canvas to be in the DOM for captureStream
    recordingCanvas.style.position = 'fixed'
    recordingCanvas.style.pointerEvents = 'none'
    recordingCanvas.style.opacity = '0'
    recordingCanvas.style.zIndex = '-1'
    document.body.appendChild(recordingCanvas)
  }
  const canvas = recordingCanvas
 
  // Ensure canvas size matches design or screen
  canvas.width = window.innerWidth * window.devicePixelRatio
  canvas.height = window.innerHeight * window.devicePixelRatio

  // Handle browser compatibility for captureStream
  let stream = null
  if (canvas.captureStream) {
    stream = canvas.captureStream(60)
  } else if (canvas.webkitCaptureStream) {
    stream = canvas.webkitCaptureStream(60)
  } else if (canvas.mozCaptureStream) {
    stream = canvas.mozCaptureStream(60)
  }

  if (!stream) {
    console.warn('MediaRecorder: captureStream not supported')
    notify('当前环境不支持录屏', 'none')
    return
  }

  // 优先 mp4，不支持则回退 webm
  const mimeTypes = [
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm'
  ]
  let selectedMimeType = ''
  for (const type of mimeTypes) {
    if (MediaRecorder.isTypeSupported(type)) {
      selectedMimeType = type
      break
    }
  }
  
  if (!selectedMimeType) {
    console.warn('MediaRecorder: No supported mime type found')
    notify('当前环境不支持录屏', 'none')
    return
  }
  console.log('Recorder: using mime type', selectedMimeType)

  try {
    const recorder = new MediaRecorder(stream, {
      mimeType: selectedMimeType
    })
    
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.value.push(e.data)
        // console.log('Recorder: chunk received', e.data.size)
      }
    }
    
    recorder.onstop = async () => {
      console.log('Recorder: stopped. Total chunks:', recordedChunks.value.length)
      const blob = new Blob(recordedChunks.value, { type: selectedMimeType })
      console.log('Recorder: blob created, size:', blob.size)
      await finalizeRecording(blob, selectedMimeType)
    }
    
    recorder.start()
    mediaRecorder.value = recorder
    console.log('Recorder: started')
    clearRecordingTimeout()
    recordingTimeout = setTimeout(forceStopRecording, RECORDING_MAX_DURATION)
  } catch (error) {
    console.warn('MediaRecorder init failed:', error)
  }
}

const stopRecording = () => {
  console.log('Recorder: stop requested')
  clearRecordingTimeout()
  stopFrameHold()
  if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
    mediaRecorder.value.stop()
  } else {
    console.log('Recorder: cannot stop, state is', mediaRecorder.value?.state)
    if (lastRecordedBlob.value) {
      console.log('Recorder: using last recorded blob to finalize')
      finalizeRecording(lastRecordedBlob.value, lastRecordedBlob.value.type || 'video/webm')
    }
  }
}

const downloadVideo = () => {
  if (!downloadUrl.value) return
  const a = document.createElement('a')
  a.href = downloadUrl.value
  const ext = downloadExt.value
  a.download = `bracelet-animation-${Date.now()}.${ext}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

const handlePostRender = (sourceCanvas) => {
  const target = recordingCanvas
  if (!target || !sourceCanvas) return
  const ctx = target.getContext('2d')
  if (!ctx) return
  // Draw the current frame from the WebGL canvas to the recording canvas
  ctx.drawImage(sourceCanvas, 0, 0, target.width, target.height)
  if (holdFrameCanvas) {
    stopFrameHold()
  }
}

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

const restoreCachedDiyPayload = async () => {
  if (typeof window === 'undefined') return
  try {
    // Try IndexedDB first
    let raw = await loadModelFromDB(DIY_CACHE_KEY)
    
    // Fallback to localStorage if not found (for backward compatibility)
    if (!raw) {
      const localData = window.localStorage?.getItem(DIY_CACHE_KEY)
      if (localData) {
        raw = JSON.parse(localData)
      }
    }

    if (!raw) {
      cachedDiyPayloadRef.value = null
      return
    }
    
    // If raw is already an object (from IndexedDB), use it directly
    // If it's from localStorage, it might need parsing (but we parsed it above)
    const payload = raw
    
    if (payload && payload.savedAt && Date.now() - payload.savedAt < CACHE_MAX_AGE) {
      cachedDiyPayloadRef.value = payload
    } else {
      // Clear expired cache
      window.localStorage?.removeItem(DIY_CACHE_KEY)
      cachedDiyPayloadRef.value = null
    }
  } catch (error) {
    console.warn('restore cached diy payload failed', error)
    cachedDiyPayloadRef.value = null
  }
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

const setupSceneBackground = (scene, url, fallbackColor = 0x000000) => {
  let videoEl = null
  let videoTexture = null
  let texture = null
  const applyFallback = () => {
    scene.background = new THREE.Color(fallbackColor)
  }
  applyFallback()
  if (url && VIDEO_FILE_REGEX.test(url)) {
    try {
      const video = document.createElement('video')
      video.src = url
      video.loop = true
      video.muted = true
      video.autoplay = true
      video.playsInline = true
      video.crossOrigin = 'anonymous'
      const playPromise = video.play()
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
          console.warn('视频背景播放失败', error)
        })
      }
      videoTexture = new THREE.VideoTexture(video)
      videoTexture.colorSpace = THREE.SRGBColorSpace
      videoTexture.needsUpdate = true
      scene.background = videoTexture
      videoEl = video
    } catch (error) {
      console.warn('视频背景初始化失败', error)
      applyFallback()
    }
  } else if (url) {
    const loader = new THREE.TextureLoader()
    try {
      texture = loader.load(
        url,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace
          scene.background = tex
        },
        undefined,
        () => {
          applyFallback()
        }
      )
      if (!texture) {
        applyFallback()
      }
    } catch (error) {
      console.warn('图片背景加载失败', error)
      applyFallback()
    }
  }
  return () => {
    if (videoTexture) {
      videoTexture.dispose()
      videoTexture = null
    }
    if (videoEl) {
      videoEl.pause()
      videoEl.src = ''
      videoEl.load()
      videoEl = null
    }
    if (texture) {
      texture.dispose()
      texture = null
    }
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

  const overlayParam = (params.get('overlay') || '').toLowerCase()
  const autoRecordParam = (params.get('autoRecord') || '').toLowerCase()
  recordingOverlayEnabled.value =
    overlayParam === '' || overlayParam === '1' || overlayParam === 'true'
  autoRecordEnabled.value = autoRecordParam === '' || autoRecordParam === '1' || autoRecordParam === 'true'
  snapshotOnlyMode.value = !autoRecordEnabled.value

  const braceletScale = parseNumber(params.get('scale'), DEFAULT_BRACELET_SCALE)
  const offsetX = parseNumber(params.get('offsetX'), DEFAULT_BRACELET_OFFSET.x)
  const offsetY = parseNumber(params.get('offsetY'), DEFAULT_BRACELET_OFFSET.y)
  const offsetZ = parseNumber(params.get('offsetZ'), DEFAULT_BRACELET_OFFSET.z)
  const camRadius = parseNumber(params.get('camR'), DEFAULT_CAM_RADIUS)
  const camYaw = parseNumber(params.get('camYaw'), DEFAULT_CAM_YAW)
  const camPitch = parseNumber(params.get('camPitch'), DEFAULT_CAM_PITCH)
  const spinSpeed = parseNumber(params.get('spinSpeed'), DEFAULT_SPIN_SPEED)
  const spinTurns = parseNumber(params.get('spinTurns'), DEFAULT_SPIN_TURNS)

  const hasCachedPayload = snapshotOnlyMode.value ? false : restoreCachedDiyPayload()

  const assemblySource = assemblyModel || diy || ''
  const viewerSource = viewerModel || diy || ''
  const useCachedAssembly = !assemblySource && hasCachedPayload
  const useCachedViewer = !viewerSource && hasCachedPayload

  const braceletId = decodeOrRaw(params.get('braceletId'))
  const braceletName = decodeOrRaw(params.get('braceletName'))
  const productId = decodeOrRaw(params.get('productId'))
  const productName = decodeOrRaw(params.get('productName'))
  const productImage = decodeOrRaw(params.get('productImage'))
  const ringSize = decodeOrRaw(params.get('ringSize'))
  const beadSize = decodeOrRaw(params.get('beadSize'))
  const price = decodeOrRaw(params.get('price'))
  const formattedPrice = decodeOrRaw(params.get('formattedPrice'))
  const selectedProductIndex = parseNumber(params.get('selectedProductIndex'), null)
  const marbleCount = parseNumber(params.get('marbleCount'), null)
  const snapshotUrl = decodeOrRaw(params.get('snapshotUrl'))
  let beadSummary = []
  const beadSummaryRaw = decodeOrRaw(params.get('beadSummary'))
  if (beadSummaryRaw) {
    try {
      const parsed = JSON.parse(beadSummaryRaw)
      if (Array.isArray(parsed)) {
        beadSummary = parsed
      }
    } catch (error) {
      console.warn('解析 beadSummary 失败', error)
    }
  }

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
    useCachedViewer,
    braceletId,
    braceletName,
    productId,
    productName,
    productImage,
    ringSize,
    beadSize,
    price,
    formattedPrice,
    selectedProductIndex,
    marbleCount,
    snapshotUrl,
    beadSummary
  }
  if (snapshotUrl) {
    uploadedSnapshotUrl.value = snapshotUrl
  }

  if (!sequenceConfig.value.assemblyDiy && !useCachedAssembly) {
    stage.value = 'viewer'
  }
}

const runAssemblyStage = async () => {
  if (snapshotOnlyMode.value) return
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
      await restoreCachedDiyPayload()
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
    },
    onPostRender: handlePostRender
  })
  assemblyInitialized.value = true
}

const runViewerStage = async () => {
  if (snapshotOnlyMode.value) return
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
      await restoreCachedDiyPayload()
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
    onReady: stopFrameHold,
    onProgress: (progress) => {
      const percent = Math.min(100, Math.max(0, Math.round(progress * 100)))
      loadingText.value = `加载中 ${percent}%`
    },
    onError: (message) => {
      errorText.value = message || '佩戴展示加载失败'
    },
    onPostRender: handlePostRender,
    onFinished: () => {
      if (autoRecordEnabled.value) {
        stopRecording()
      } else {
        sendSnapshotToMiniProgram()
      }
    }
  })
  viewerInitialized.value = true
}

const stopAssemblyStage = () => {
  if (assemblyCleanup) {
    assemblyCleanup()
    assemblyCleanup = null
  }
  assemblyInitialized.value = false
}

const stopViewerStage = () => {
  if (viewerCleanup) {
    viewerCleanup()
    viewerCleanup = null
  }
  viewerInitialized.value = false
}

const transitionToViewerStage = () => {
  startFrameHold(1800)
  stopAssemblyStage()
  stage.value = 'viewer'
}

const startStage = (value) => {
  if (snapshotOnlyMode.value) return
  if (value === 'assembly') {
    nextTick(runAssemblyStage)
  } else {
    nextTick(runViewerStage)
  }
}

watch(stage, (value, prev) => {
  if (snapshotOnlyMode.value) return
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
  if (snapshotOnlyMode.value) {
    recordingOverlayVisible.value = recordingOverlayEnabled.value
    const delivered = sendSnapshotToMiniProgram()
    recordingOverlayVisible.value = false
    if (!delivered) {
      recordingOverlayVisible.value = false
    }
    return
  }
  if (autoRecordEnabled.value) {
    startRecording() // Start recording immediately
  }
  startStage(stage.value)
})

onBeforeUnmount(() => {
  stopAssemblyStage()
  stopViewerStage()
  stopFrameHold()
  cachedObjectUrls.forEach((url) => {
    URL.revokeObjectURL(url)
  })
  cachedObjectUrls.clear()
  recordingOverlayVisible.value = false
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
    onFinished,
    onPostRender
  } = options
  if (!diyModelUrl) return null
  let disposed = false
  let animationId = 0
  const scene = new THREE.Scene()
  const clock = new THREE.Clock()

  const cleanupBackground = setupSceneBackground(scene, backgroundUrl, 0x000000)

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
  renderer.setClearColor(new THREE.Color(0x000000), 0)
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

    // Use the root object's position as the center of the ring
    // This ensures that even if beads don't form a full circle (e.g. partial assembly),
    // the center is still correct relative to the bracelet origin.
    root.getWorldPosition(center)

    const normal = new THREE.Vector3()
    if (sources.length >= 3) {
      // Use 3 points to calculate the plane normal
      // This is more robust for partial rings or unsorted beads than the polygon method
      const p0 = sources[0].targetPos
      const p1 = sources[Math.floor(sources.length / 3)].targetPos
      const p2 = sources[Math.floor((sources.length * 2) / 3)].targetPos
      const v1 = p1.clone().sub(p0)
      const v2 = p2.clone().sub(p0)
      normal.crossVectors(v1, v2).normalize()
    }
    
    // Fallback or check validity
    if (normal.lengthSq() < 1e-6) {
      normal.set(0, 1, 0)
    } else if (normal.y < 0) {
       // Prefer upward facing normal for consistency
       normal.negate()
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
          const before = obj.getWorldPosition(new THREE.Vector3())
          obj.scale.multiplyScalar(ringScale)
          obj.updateMatrixWorld(true)
          const after = obj.getWorldPosition(new THREE.Vector3())
          const delta = before.sub(after)
          obj.position.add(delta)
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
    if (onPostRender) onPostRender(renderer.domElement)
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
    cleanupBackground?.()
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
  const {
    diyUrl,
    baseModelUrl,
    backgroundUrl,
    onProgress,
    onError,
    onPostRender,
    onFinished,
    onReady
  } = options
  let disposed = false
  let animationId = 0
  let viewerFinished = false
  let viewerFinishTimer = null
  let readySignaled = false
  const scene = new THREE.Scene()
  const cleanupBackground = setupSceneBackground(scene, backgroundUrl || DEFAULT_BG, 0x000000)

  const signalReady = () => {
    if (readySignaled) return
    readySignaled = true
    if (typeof onReady === 'function') {
      onReady()
    }
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
  renderer.setClearColor(new THREE.Color(0x000000), 0)
  mountEl.appendChild(renderer.domElement)

  const pmremGenerator = new THREE.PMREMGenerator(renderer)
  const envMap = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = envMap

  const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, debugParams.value.ambientIntensity)
  hemisphereLight.position.set(0, 20, 0)
  scene.add(hemisphereLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, debugParams.value.dirIntensity)
  directionalLight.position.set(debugParams.value.dirX, debugParams.value.dirY, debugParams.value.dirZ)
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
      // Use debug params
      model.scale.set(debugParams.value.scale, debugParams.value.scale, debugParams.value.scale)
      model.rotation.set(debugParams.value.rotX, debugParams.value.rotY, debugParams.value.rotZ)
      model.position.set(debugParams.value.posX, debugParams.value.posY, debugParams.value.posZ)
      scene.add(model)

      // Remove the wall/plane BEFORE calculating bounding box
      const wall = model.getObjectByName('平面')
      if (wall) {
        wall.removeFromParent()
      }

      // Calculate bounding box for camera positioning (but do NOT move model)
      const box = new THREE.Box3().setFromObject(model)
      const size = box.getSize(new THREE.Vector3())

      // Adjust camera to fit the model
      const maxDim = Math.max(size.x, size.y, size.z)
      const fov = camera.fov * (Math.PI / 180)
      let baseCameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2))
      
      // Initial camera set
      camera.position.set(0, 0, baseCameraZ * debugParams.value.cameraZoom)
      camera.lookAt(0, 0, 0)
      
      if (controls) {
        controls.target.set(0, 0, 0)
        controls.update()
      }

      // Watch debug params
      watch(debugParams, (newVal) => {
        if (model) {
          model.scale.set(newVal.scale, newVal.scale, newVal.scale)
          model.rotation.set(newVal.rotX, newVal.rotY, newVal.rotZ)
          model.position.set(newVal.posX, newVal.posY, newVal.posZ)
        }
        if (camera) {
             camera.position.set(0, 0, baseCameraZ * newVal.cameraZoom)
             camera.lookAt(0, 0, 0)
        }
      }, { deep: true })

      // Adjust materials to be matte (remove reflection)
      model.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.roughness = 1.0
          child.material.metalness = 0.0
          child.material.envMapIntensity = 0.0 // Disable environment map reflection
          
          if (child.material.specularIntensity !== undefined) {
            child.material.specularIntensity = 0.0
          }
          if (child.material.clearcoat !== undefined) {
            child.material.clearcoat = 0.0
          }
          if (child.material.transmission !== undefined) {
            child.material.transmission = 0.0
          }

          if (child.material.map) {
            child.material.map.colorSpace = THREE.SRGBColorSpace
          }
          child.material.needsUpdate = true
        }
      })

      if (gltf.animations && gltf.animations.length) {
        mixer = new THREE.AnimationMixer(model)
        mixer.timeScale = debugParams.value.animSpeed // Apply initial speed
        const action = mixer.clipAction(gltf.animations[0])
        action.clampWhenFinished = true
        action.loop = THREE.LoopOnce
        action.play()
        console.log('Animation loaded. Duration:', gltf.animations[0].duration)
        
        // Listen for animation finish
        mixer.addEventListener('finished', () => {
             console.log('Animation finished')
             if (onFinished) onFinished()
        })
      }

      // Watch for animation timing changes
      watch(() => [debugParams.value.animStart, debugParams.value.animEnd], ([start, end]) => {
         if (mixer) {
           const action = mixer.existingAction(mixer._actions[0]._clip)
           if (action) {
             action.time = start
             action.play()
           }
         }
      })
      
      // Watch for speed changes
      watch(() => debugParams.value.animSpeed, (speed) => {
        if (mixer) {
          mixer.timeScale = speed
        }
      })

      // Watch for lighting changes
      watch(() => [
        debugParams.value.ambientIntensity,
        debugParams.value.dirIntensity,
        debugParams.value.dirX,
        debugParams.value.dirY,
        debugParams.value.dirZ
      ], ([ambInt, dirInt, dx, dy, dz]) => {
        if (hemisphereLight) hemisphereLight.intensity = ambInt
        if (directionalLight) {
          directionalLight.intensity = dirInt
          directionalLight.position.set(dx, dy, dz)
        }
      })

      // Watch replay trigger
      watch(replayTrigger, () => {
         if (mixer) {
           const action = mixer.existingAction(mixer._actions[0]._clip)
           if (action) {
             action.stop()
             action.reset()
             action.time = debugParams.value.animStart
             action.paused = false
             action.play()
           }
         }
      })
      // Find the rope bone/mesh to attach the bracelet
      const ropeBone = model.getObjectByName('rope_joint')
      const ropeMesh = model.getObjectByName('rope_mesh')
      if (ropeMesh) ropeMesh.visible = false

      if (ropeBone && diyUrl) {
        const beadGroup = new THREE.Group()
        beadGroup.name = 'AnimatedBeads'
        // ropeBone.add(beadGroup) // Moved to debugWrapper

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

            diyRoot.position.set(0, 0, 0)
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

            
            // Apply auto-scaling (fitScale) BEFORE adding to debugWrapper
            // This ensures debugWrapper's scale is applied ON TOP of the fitted scale
            if (ropeMesh) {
              ropeBone.add(diyRoot) // Temporarily add to bone for calculation
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
              ropeBone.remove(diyRoot) // Remove after calculation
            }

            // Create a wrapper for debug adjustments
            const debugWrapper = new THREE.Group()
            debugWrapper.name = 'DebugWrapper'
            
            // Apply initial debug params
            debugWrapper.scale.set(braceletDebugParams.value.scale, braceletDebugParams.value.scale, braceletDebugParams.value.scale)
            debugWrapper.rotation.set(braceletDebugParams.value.rotX, braceletDebugParams.value.rotY, braceletDebugParams.value.rotZ)
            debugWrapper.position.set(braceletDebugParams.value.posX, braceletDebugParams.value.posY, braceletDebugParams.value.posZ)
            
            debugWrapper.add(diyRoot)
            debugWrapper.add(beadGroup) // Add beads to debug wrapper
            ropeBone.add(debugWrapper)

            // Watch bracelet debug params
            watch(braceletDebugParams, (newVal) => {
              if (debugWrapper) {
                debugWrapper.scale.set(newVal.scale, newVal.scale, newVal.scale)
                debugWrapper.rotation.set(newVal.rotX, newVal.rotY, newVal.rotZ)
                debugWrapper.position.set(newVal.posX, newVal.posY, newVal.posZ)
              }
            }, { deep: true })

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
            debugWrapper.updateMatrixWorld(true)
            // Calculate relative to debugWrapper instead of ropeBone
            const wrapperInv = localToBone.copy(debugWrapper.matrixWorld).invert()

            diyRoot.traverse((obj) => {
              const extras = obj.userData || {}
              if (!extras.isMarbleRoot) return
              obj.updateMatrixWorld(true)
              targetMatrix.multiplyMatrices(wrapperInv, obj.matrixWorld)
              targetMatrix.decompose(targetPos, targetQuat, targetScale)
              const beadClone = obj.clone(true)
              beadClone.position.copy(targetPos)
              beadClone.quaternion.copy(targetQuat)
              beadClone.scale.copy(targetScale)
              beadClone.visible = true
              // Disable frustum culling to prevent beads from disappearing when attached to bone
              beadClone.frustumCulled = false
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

      signalReady()
      if (onProgress) onProgress(1)
    },
    (xhr) => {
      if (disposed) return
      const total = xhr.total || 1
      if (onProgress) onProgress(xhr.loaded / total)
    },
    (error) => {
      console.error('An error happened during loading:', error)
      signalReady()
      if (!disposed && onError) onError('基础模型加载失败')
    }
  )

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.enableZoom = true
  controls.enableRotate = true

  const markViewerFinished = () => {
    if (viewerFinished) return
    viewerFinished = true
    if (viewerFinishTimer) {
      clearTimeout(viewerFinishTimer)
      viewerFinishTimer = null
    }
    if (typeof onFinished === 'function') {
      onFinished()
    }
  }

  const animate = () => {
    if (disposed) return
    animationId = requestAnimationFrame(animate)
    const delta = clock.getDelta()
    if (mixer) {
      const action = mixer.existingAction(mixer._actions[0]._clip)
      if (action) {
         // console.log('Action time:', action.time, 'Start:', debugParams.value.animStart, 'End:', debugParams.value.animEnd)
         if (action.time >= debugParams.value.animEnd) {
           action.paused = true
           action.time = debugParams.value.animEnd
         }
         // Also ensure we don't go before start
         if (action.time < debugParams.value.animStart) {
            action.time = debugParams.value.animStart
         }
         const clipDuration = action._clip?.duration || 0
         const endTime = Math.min(debugParams.value.animEnd || clipDuration, clipDuration || Infinity)
         if (action.time >= endTime - 1e-3) {
           markViewerFinished()
         }
      }
      mixer.update(delta)
    }
    controls.update()
    renderer.render(scene, camera)
    if (onPostRender) onPostRender(renderer.domElement)
  }
  const fallbackDuration = 12_000 // ms, ensure we don't hang recording
  viewerFinishTimer = setTimeout(markViewerFinished, fallbackDuration)
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
    if (viewerFinishTimer) {
      clearTimeout(viewerFinishTimer)
      viewerFinishTimer = null
    }
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
    cleanupBackground?.()
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
.recording-overlay {
  position: fixed;
  inset: 0;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 12;
  flex-direction: column;
}
.spinner {
  width: 72rpx;
  height: 72rpx;
  border: 8rpx solid rgba(0, 0, 0, 0.08);
  border-top-color: rgba(0, 0, 0, 0.7);
  border-radius: 50%;
  animation: spinner-rotate 1s linear infinite;
}
@keyframes spinner-rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
.overlay-title {
  margin-top: 16rpx;
  font-size: 30rpx;
  color: #000;
  letter-spacing: 1rpx;
}
.overlay-toggle {
  position: fixed;
  right: 20rpx;
  top: 20rpx;
  z-index: 13;
  padding: 10rpx 18rpx;
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
  border-radius: 12rpx;
  font-size: 26rpx;
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
.recording-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
  z-index: -1;
}
.download-btn {
  position: absolute;
  bottom: 30px;
  right: 20px;
  padding: 10px 20px;
  background: #fff;
  color: #000;
  border-radius: 24px;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  z-index: 100;
  cursor: pointer;
}
.download-btn:active {
  transform: scale(0.95);
  opacity: 0.9;
}
.preview-btn {
  position: absolute;
  bottom: 30px;
  right: 140px; /* Positioned to the left of download button */
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 24px;
  font-size: 14px;
  font-weight: 600;
  backdrop-filter: blur(4px);
  z-index: 100;
  cursor: pointer;
}
.preview-btn:active {
  transform: scale(0.98);
  opacity: 0.9;
  background: rgba(255, 255, 255, 0.3);
}

.debug-panel {
  position: fixed;
  top: 100px;
  left: 10px;
  background: rgba(0, 0, 0, 0.7);
  padding: 10px;
  border-radius: 8px;
  color: white;
  z-index: 1000;
  font-size: 12px;
}

.debug-panel-right {
  left: auto;
  right: 10px;
}

.debug-item {
  display: flex;
  align-items: center;
  margin-bottom: 5px;
}

.debug-btn {
  background: #4CAF50;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 4px;
  margin-top: 5px;
  font-size: 12px;
  width: 100%;
}

.debug-item text {
  width: 50px;
}

.debug-item input {
  width: 60px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 2px 5px;
  border-radius: 4px;
}
</style>
