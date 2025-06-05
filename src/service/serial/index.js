import { onBeforeUnmount, ref } from 'vue'

export const port = ref(null)
export const isConnected = ref(false)

export async function connect(baudRate) {
  try {
    port.value = await navigator.serial.requestPort()
    await port.value.open({ baudRate })
    isConnected.value = true
  } catch {
    throw new Error('不是目标设备或串口不可用')
  }
}

export async function disconnect() {
  if (port.value) {
    await port.value.close()
    port.value = null
  }
  isConnected.value = false
}

onBeforeUnmount(disconnect)
