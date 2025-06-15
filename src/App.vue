<script setup>
import { getVideoDevices, startCamera, stopCamera } from '@/service/camera'
import { getConfig, setConfig } from '@/service/face-control'
import { parseConfig } from '@/service/face-control/parseConfig'
import { connect, disconnect, sendCommand } from '@/service/serial'
import { startFaceCapture, stopFaceCapture } from '@/service/vision'
import { onBeforeUnmount, onMounted, ref } from 'vue'

const showModal = ref(false)
const camRunning = ref(false)
const videoRef = ref(null)
const canvasRef = ref(null)
const selectRef = ref(null)
const selectedDeviceId = ref(null)
const videoDevices = ref([])
let resizeObserver = null
const isConnected = ref(false)
const isLoading = ref(false)

// 新增：配置文本和解析结果
const configText = ref('')
const parsedConfigs = ref([])

/** 从 textarea 读取并解析、应用到 face-control */
function applyConfig() {
  try {
    const cfg = parseConfig(configText.value)
    setConfig(cfg)
    parsedConfigs.value = cfg
  } catch (e) {
    console.error('配置解析失败:', e)
    // 你可以加一个 toast 提示用户
  }
}

function configsToText(configs) {
  return configs
    .map(({ idx, ref, axis, pin, closed, open, dMin, dMax, prefix }) =>
      `${idx} ${ref} ${axis} ${pin} ${closed} ${open} ${dMin} ${dMax} ${prefix};`,
    )
    .join('\n')
}

/** 2. 每次打开弹窗，就把内存里的 config 塞进 textarea */
watch(showModal, (open) => {
  if (open) {
    const current = getConfig() // 取最新的配置对象数组
    configText.value = configsToText(current)
    parsedConfigs.value = current // 顺便当展示表的数据源
  }
})

async function playBtnOnclick() {
  isLoading.value = true
  videoDevices.value = await getVideoDevices()
  if (videoDevices.value.length > 0) {
    selectedDeviceId.value = videoDevices.value[0].deviceId
  }
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
  videoRef.value.onloadedmetadata = async () => {
    adjustCanvasSize()
    await startFaceCapture(videoRef.value, canvasRef.value)
    isLoading.value = false
  }
}

function adjustCanvasSize() {
  if (videoRef.value && canvasRef.value) {
    canvasRef.value.width = videoRef.value.videoWidth
    canvasRef.value.height = videoRef.value.videoHeight
  }
}

async function connectSerial() {
  await connect(115200)
  await sendCommand('reset')
  isConnected.value = true
}

async function disconnectSerial() {
  await disconnect()
  isConnected.value = false
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
  sendCommand('reset')
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

onMounted(async () => {
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
  <v-dialog v-model="showModal" max-width="700px">
    <v-card>
      <v-card-title class="headline">
        高级设置
      </v-card-title>
      <v-divider />

      <v-card-text>
        <!-- 新增：配置输入区 -->
        <v-textarea
          v-model="configText"
          label="Servo 配置（分号结尾）"
          rows="8"
          outlined
          class="mt-4"
        />

        <!-- 新增：应用配置按钮 -->
        <v-btn color="primary" class="mt-2" @click="applyConfig">
          应用配置
        </v-btn>

        <!-- 新增：显示解析结果 -->
        <v-data-table
          v-if="parsedConfigs.length"
          :items="parsedConfigs"
          :headers="[
            { title: 'idx', value: 'idx' },
            { title: 'ref', value: 'ref' },
            { title: 'axis', value: 'axis' },
            { title: 'pin', value: 'pin' },
            { title: 'closed', value: 'closed' },
            { title: 'open', value: 'open' },
            { title: 'dMin', value: 'dMin' },
            { title: 'dMax', value: 'dMax' },
            { title: 'prefix', value: 'prefix' },
          ]"
          dense
          class="mt-4"
        />
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

    <v-card elevation="6" class="mt-4 mx-auto w-full max-w-[1080px] rounded-xl shadow-lg relative">
      <v-overlay
        :model-value="isLoading"
        contained
        class="d-flex justify-center align-center"
        style="position: absolute; inset: 0;"
      >
        <div class="d-flex flex-column align-center justify-center">
          <v-progress-circular indeterminate color="primary" size="48" />
          <div class="mt-2 text-subtitle-2 text-primary">
            模型加载中...
          </div>
        </div>
      </v-overlay>

      <div
        class="relative w-full max-w-[1080px] aspect-video bg-black rounded-xl overflow-hidden mx-auto"
        style="max-height: 60vh;"
      >
        <video
          ref="videoRef"
          class="absolute top-0 left-0 object-cover w-full h-full"
          muted
          playsinline
          autoplay
        />
        <canvas
          ref="canvasRef"
          class="absolute top-0 left-0 object-cover w-full h-full"
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
        <v-btn :disabled="isConnected" class="flex-1 min-w-[100px] h-[60px] shadow-none" @click="connectSerial">
          <v-icon left>
            mdi-power-plug
          </v-icon>
          打开串口
        </v-btn>
        <v-btn :disabled="!isConnected" class="flex-1 min-w-[100px] h-[60px] shadow-none" @click="disconnectSerial">
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
