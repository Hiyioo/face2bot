<script setup>
import { getVideoDevices, startCamera, stopCamera } from '@/service/camera'
import { startFaceCapture, stopFaceCapture } from '@/service/vision'
import { onBeforeUnmount, onMounted, ref } from 'vue'

const showModal = ref(false)

// 本组件局部管理 camera 运行状态
const camRunning = ref(false)

const videoRef = ref(null)
const canvasRef = ref(null)
const selectRef = ref(null)

const selectedDeviceId = ref(null)
const videoDevices = ref([])
let resizeObserver = null

/**
 * 播放按钮点击
 */
async function playBtnOnclick() {
  if (!selectedDeviceId.value) {
    console.warn('⚠️ 未选择摄像头设备')
    return
  }

  // 启动摄像头
  const stream = await startCamera(selectedDeviceId.value)
  if (!stream) {
    console.error('❌ 摄像头启动失败')
    return
  }

  videoRef.value.srcObject = stream
  camRunning.value = true

  // 视频元数据加载完成后，调整 canvas 大小并启动人脸检测
  videoRef.value.onloadedmetadata = () => {
    adjustCanvasSize()
    startFaceCapture(videoRef.value, canvasRef.value)
  }
}

/**
 * 调整 Canvas 大小匹配 Video
 */
function adjustCanvasSize() {
  if (videoRef.value && canvasRef.value) {
    canvasRef.value.width = videoRef.value.videoWidth
    canvasRef.value.height = videoRef.value.videoHeight
  }
}

function observeVideoSize() {
  if (!videoRef.value) {
    return
  }

  resizeObserver = new ResizeObserver(() => {
    adjustCanvasSize()
  })
  resizeObserver.observe(videoRef.value)
}

function stopPlayBtnOnclick() {
  if (!selectedDeviceId.value) {
    console.warn('⚠️ 没有摄像头正在运行')
    return
  }

  stopFaceCapture(canvasRef.value)
  stopCamera(selectedDeviceId.value)
  camRunning.value = false
}

async function handleChange(newId) {
  const oldId = selectedDeviceId.value
  selectedDeviceId.value = newId

  if (camRunning.value) {
    // 停止旧摄像头和检测
    stopFaceCapture(canvasRef.value)
    stopCamera(oldId)

    // 启动新摄像头并继续检测
    const stream = await startCamera(newId)
    if (!stream) {
      console.error('❌ 摄像头启动失败')
      return
    }
    videoRef.value.srcObject = stream

    videoRef.value.onloadedmetadata = () => {
      adjustCanvasSize()
      startFaceCapture(videoRef.value, canvasRef.value)
    }
  }
}

onMounted(async () => {
  // 获取可用摄像头设备列表
  videoDevices.value = await getVideoDevices()

  // 默认选中第一个设备
  if (videoDevices.value.length > 0) {
    selectedDeviceId.value = videoDevices.value[0].deviceId
  }

  observeVideoSize()
})

onBeforeUnmount(() => {
  // 停止 ResizeObserver
  if (resizeObserver && videoRef.value) {
    resizeObserver.unobserve(videoRef.value)
    resizeObserver = null
  }

  // 如果摄像头仍在运行，则停止
  if (camRunning.value && selectedDeviceId.value) {
    stopFaceCapture(canvasRef.value)
    stopCamera(selectedDeviceId.value)
  }
})
</script>

<template>
  <v-container fluid class="pa-0">
    <!-- 摄像头选择 -->
    <v-row justify="center" class="mt-6">
      <v-col cols="12" md="6" lg="4">
        <v-select
          ref="selectRef"
          v-model="selectedDeviceId"
          :items="videoDevices"
          item-title="label"
          item-value="deviceId"
          label="选择摄像头"
          placeholder="请选择摄像头"
          dense
          outlined
          @change="handleChange"
        />
      </v-col>
    </v-row>

    <div class="relative">
      <video
        ref="videoRef"
        class="video-element"
        muted
        playsinline
        autoplay
      />
      <canvas
        ref="canvasRef"
        class="canvas-element"
      />
    </div>

    <!-- 控制按钮 -->
    <v-row justify="center" class="controls">
      <v-btn
        v-if="!camRunning"
        color="primary"
        large
        rounded
        @click="playBtnOnclick"
      >
        <v-icon left>
          {{ 'mdi-play' }}
        </v-icon>
      </v-btn>
      <v-btn
        v-else
        color="error"
        large
        rounded
        @click="stopPlayBtnOnclick"
      >
        <v-icon left>
          {{ 'mdi-stop' }}
        </v-icon>
      </v-btn>
      <v-btn
        color="secondary"
        large
        rounded
        @click="showModal = !showModal"
      >
        <v-icon left>
          {{ 'mdi-cog' }}
        </v-icon>
      </v-btn>
      <v-btn
        large
        rounded
      >
        <v-icon left>
          {{ 'mdi-power-plug' }}
        </v-icon>
      </v-btn>
    </v-row>
    <!-- <settingsModal v-model:is-open="showModal" /> -->
  </v-container>
</template>

<style scoped>
.video-element,
.canvas-element {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  image-rendering: crisp-edges;
}

.video-element {
  z-index: 1;
}

.canvas-element {
  z-index: 2;
  pointer-events: none;
}

.controls {
  position: fixed;
  bottom: 5%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
