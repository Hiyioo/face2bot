<script setup>
import { getVideoDevices, startCamera, stopCamera } from '@/service/camera'
import { delayMS, getConfig, setConfig } from '@/service/face-control'
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
const baudRate = ref(200000)

// 新增：配置文本和解析结果
const configText = ref('')
const parsedConfigs = ref([])

/** 从 textarea 读取并解析、应用到 face-control */
function applyConfig() {
  try {
    const cfg = parseConfig(configText.value)
    setConfig(cfg)
    parsedConfigs.value = cfg
    localStorage.setItem('servoConfigs', JSON.stringify(cfg))
  } catch (e) {
    console.error('配置解析失败', e)
  }
}

const tableHeaders = [
  { title: 'idx', value: 'idx' },
  { title: 'ref', value: 'ref' },
  { title: 'axis', value: 'axis' },
  { title: 'pin', value: 'pin' },
  { title: 'closed', value: 'closed' },
  { title: 'open', value: 'open' },
  { title: 'dMin', value: 'dMin' },
  { title: 'dMax', value: 'dMax' },
  { title: 'prefix', value: 'prefix' },
]

function configsToText(configs) {
  return configs
    .map(({ idx, ref, axis, pin, closed, open, dMin, dMax, prefix }) =>
      `${idx} ${ref} ${axis} ${pin} ${closed} ${open} ${dMin} ${dMax} ${prefix};`,
    )
    .join('\n')
}

watch(showModal, (open) => {
  if (open) {
    const saved = localStorage.getItem('servoConfigs')
    if (saved) {
      try {
        const arr = JSON.parse(saved)
        parsedConfigs.value = arr
        configText.value = configsToText(arr)
        return
      } catch {}
    }
    // fallback: 从 service 中读取
    const current = getConfig()
    parsedConfigs.value = current
    configText.value = configsToText(current)
  }
})

// 表格数据变动时，同步回文本
watch(parsedConfigs, (newVal) => {
  configText.value = configsToText(newVal)
}, { deep: true })

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
  await connect(baudRate.value)
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
  <v-dialog v-model="showModal" max-width="1000px">
    <v-card>
      <v-card-title class="headline">
        高级设置
      </v-card-title>
      <v-divider />

      <v-card-text>
        <!-- 文本编辑区 -->
        <v-number-input
          v-model:model-value="delayMS"
          :reverse="false"
          control-variant="split"
          label="command延时"
          :hide-input="false"
          :inset="false"
          max="1000"
          min="0"
        />

        <v-number-input
          v-model:model-value="baudRate"
          :reverse="false"
          control-variant="split"
          label="波特率"
          :hide-input="false"
          :inset="false"
          max="300000"
          min="0"
        />
        <v-textarea
          v-model="configText"
          label="Servo 配置（每行以分号结尾）"
          rows="6"
          outlined
        />

        <v-btn color="primary" class="mt-2" @click="applyConfig">
          应用配置
        </v-btn>

        <!-- 可编辑表格 -->
        <v-data-table
          v-if="parsedConfigs.length"
          :items="parsedConfigs"
          :headers="tableHeaders"
          dense
          class="mt-4"
        >
          <!-- idx 列 -->
          <template #item.idx="{ item }">
            <v-text-field
              v-model="item.idx"
              dense
              hide-details
              variant="plain"
              style="width: 130px;"
            />
          </template>

          <!-- ref 列 -->
          <template #item.ref="{ item }">
            <v-text-field
              v-model="item.ref"
              dense
              hide-details
              variant="plain"
              style="width: 130px;"
            />
          </template>

          <!-- axis 列 -->
          <template #item.axis="{ item }">
            <v-text-field
              v-model="item.axis"
              dense
              hide-details
              variant="plain"
            />
          </template>

          <!-- pin 列 -->
          <template #item.pin="{ item }">
            <v-text-field
              v-model.number="item.pin"
              type="number"
              dense
              hide-details
              variant="plain"
            />
          </template>

          <!-- closed 列 -->
          <template #item.closed="{ item }">
            <v-text-field
              v-model.number="item.closed"
              type="number"
              dense
              hide-details
              variant="plain"
            />
          </template>

          <!-- open 列 -->
          <template #item.open="{ item }">
            <v-text-field
              v-model.number="item.open"
              type="number"
              dense
              hide-details
              variant="plain"
            />
          </template>

          <!-- dMin 列 -->
          <template #item.dMin="{ item }">
            <v-text-field
              v-model.number="item.dMin"
              type="number"
              dense
              hide-details
              variant="plain"
            />
          </template>

          <!-- dMax 列 -->
          <template #item.dMax="{ item }">
            <v-text-field
              v-model.number="item.dMax"
              type="number"
              dense
              hide-details
              variant="plain"
            />
          </template>

          <!-- prefix 列 -->
          <template #item.prefix="{ item }">
            <v-text-field
              v-model="item.prefix"
              dense
              hide-details
              variant="plain"
            />
          </template>
        </v-data-table>
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
