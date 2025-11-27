<template>
  <view class="page">
    <video
      v-if="videoUrl"
      :src="videoUrl"
      class="video-player"
      autoplay
      loop
      controls
      object-fit="contain"
    ></video>
    <view v-else-if="loading" class="loading">
      <text>加载视频中...</text>
    </view>
    <view v-else class="error">
      <text>{{ errorText }}</text>
      <button class="retry-btn" @tap="loadVideo">重试</button>
    </view>

    <view class="controls">
      <button class="back-btn" @tap="goBack">返回</button>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { loadModelFromDB } from '../../utils/db.js'

const VIDEO_CACHE_KEY = 'bracelet_generated_video_cache'

const videoUrl = ref('')
const loading = ref(true)
const errorText = ref('')

const loadVideo = async () => {
  loading.value = true
  errorText.value = ''
  try {
    const data = await loadModelFromDB(VIDEO_CACHE_KEY)
    if (!data || !data.blob) {
      throw new Error('未找到缓存的视频')
    }
    
    if (videoUrl.value) {
      URL.revokeObjectURL(videoUrl.value)
    }
    
    videoUrl.value = URL.createObjectURL(data.blob)
  } catch (error) {
    console.error('Failed to load video:', error)
    errorText.value = '视频加载失败'
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  uni.navigateBack()
}

onMounted(() => {
  loadVideo()
})

onBeforeUnmount(() => {
  if (videoUrl.value) {
    URL.revokeObjectURL(videoUrl.value)
  }
})
</script>

<style scoped>
.page {
  width: 100vw;
  height: 100vh;
  background: #000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}

.video-player {
  width: 100%;
  height: 100%;
}

.loading, .error {
  color: #fff;
  font-size: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.controls {
  position: absolute;
  top: 40px;
  left: 20px;
  z-index: 10;
}

.back-btn, .retry-btn {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.5);
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 14px;
  backdrop-filter: blur(4px);
}

.retry-btn {
  background: #fff;
  color: #000;
  border: none;
}
</style>
