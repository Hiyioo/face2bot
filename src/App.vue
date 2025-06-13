<script setup>
import { getVideoDevices, startCamera, stopCamera } from '@/service/camera'
import { connect, disconnect, sendCommand } from '@/service/serial'
import { startFaceCapture, stopFaceCapture } from '@/service/vision'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import '@/service/face-control'

const showModal = ref(false)
const camRunning = ref(false)
const videoRef = ref(null)
const canvasRef = ref(null)
const selectRef = ref(null)
const selectedDeviceId = ref(null)
const videoDevices = ref([])
let resizeObserver = null

async function playBtnOnclick() {
  if (!selectedDeviceId.value) {
    console.warn('⚠️ 未选择摄像头设备')
    return
  }
  const stream = await startCamera(selectedDeviceId.value)
  if (!stream) {
    console.error('❌ 摄像头启动失败')
    return
  }
  videoRef.value.srcObject = stream
  camRunning.value = true
  videoRef.value.onloadedmetadata = () => {
    adjustCanvasSize()
    startFaceCapture(videoRef.value, canvasRef.value)
  }
}

function adjustCanvasSize() {
  if (videoRef.value && canvasRef.value) {
    canvasRef.value.width = videoRef.value.videoWidth
    canvasRef.value.height = videoRef.value.videoHeight
  }
}

async function connectSerial() {
  await connect(200000)
  await sendCommand('reset')
}

function observeVideoSize() {
  if (!videoRef.value) {
    return
  }
  resizeObserver = new ResizeObserver(() => adjustCanvasSize())
  resizeObserver.observe(videoRef.value)
}

function stopPlayBtnOnclick() {
  if (!camRunning.value) {
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
    stopFaceCapture(canvasRef.value)
    stopCamera(oldId)
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

async function refreshDevices() {
  videoDevices.value = await getVideoDevices()
}

onMounted(async () => {
  videoDevices.value = await getVideoDevices()
  if (videoDevices.value.length > 0) {
    selectedDeviceId.value = videoDevices.value[0].deviceId
  }
  observeVideoSize()
  window.sendCommand = sendCommand
})

onBeforeUnmount(() => {
  if (resizeObserver && videoRef.value) {
    resizeObserver.unobserve(videoRef.value)
    resizeObserver = null
  }
  if (camRunning.value && selectedDeviceId.value) {
    stopFaceCapture(canvasRef.value)
    stopCamera(selectedDeviceId.value)
  }
})
</script>

<template>
  <v-dialog v-model="showModal" max-width="400">
    <v-card>
      <v-card-title class="headline">
        高级设置
      </v-card-title>
      <v-divider />
      <v-card-text>
        <v-btn text @click="refreshDevices">
          刷新摄像头列表
        </v-btn>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn text @click="showModal = false">
          关闭
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-toolbar color="primary" dark>
    <v-toolbar-title>Face To Bot</v-toolbar-title>
    <v-spacer />
    <v-btn icon @click="showModal = !showModal">
      <v-icon>mdi-cog</v-icon>
    </v-btn>
  </v-toolbar>

  <v-container fluid class="p-0 w-full h-full flex flex-col">
    <v-row class="mt-6" justify="center">
      <v-col cols="12" md="6" lg="4" />
    </v-row>

    <v-card elevation="6" class="mt-4 mx-auto w-full max-w-[1080px] rounded-xl shadow-lg">
      <div class="pt-[56.25%] bg-black rounded-xl overflow-hidden">
        <video
          ref="videoRef"
          class="absolute top-0 left-0 object-cover w-full"
          muted
          playsinline
          autoplay
        />
        <canvas
          ref="canvasRef"
          class="absolute top-0 left-0 object-cover w-full"
        />
      </div>
    </v-card>

    <v-sheet class="fixed bottom-5 inset-x-0 mx-auto w-[90%] max-w-[720px] bg-white/60 dark:bg-gray-800/60 backdrop-blur-lg p-4 pt-8 shadow-xl rounded-2xl flex flex-col gap-4">
      <v-row class="flex-wrap gap-2 justify-center">
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
          class="w-full sm:w-auto flex-1 px-2"
          variant="outlined"
          hide-details
          @change="handleChange"
        />
      </v-row>

      <v-row dense align="center" justify="center" class="flex-wrap gap-4">
        <v-btn class="flex-1 min-w-[100px] h-[60px] shadow-none" @click="connectSerial">
          <v-icon left>
            mdi-power-plug
          </v-icon>
          打开串口
        </v-btn>
        <v-btn class="flex-1 min-w-[100px] h-[60px] shadow-none" @click="disconnect">
          <v-icon left>
            mdi-power-plug-off
          </v-icon>
          关闭串口
        </v-btn>
        <v-btn
          v-if="!camRunning"
          color="primary"
          class="w-[60px] h-[60px] shadow-none"
          variant="text"
          @click="playBtnOnclick"
        >
          <v-icon size="28">
            mdi-play
          </v-icon>
        </v-btn>
        <v-btn
          v-else
          color="error"
          class="w-[60px] h-[60px] shadow-none"
          variant="text"
          @click="stopPlayBtnOnclick"
        >
          <v-icon size="28">
            mdi-stop
          </v-icon>
        </v-btn>
      </v-row>
    </v-sheet>
  </v-container>
</template>
