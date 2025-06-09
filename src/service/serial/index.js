import { onBeforeUnmount, ref } from 'vue'

export const port = ref(null)
export const isConnected = ref(false)

let writer = null

/**
 * 连接串口
 * @param {number} baudRate
 */
export async function connect(baudRate) {
  try {
    port.value = await navigator.serial.requestPort()
    await port.value.open({ baudRate })
    isConnected.value = true

    writer = port.value.writable.getWriter()
  } catch (e) {
    console.error(e)
    throw new Error('不是目标设备或串口不可用')
  }
}

export async function disconnect() {
  if (writer) {
    try {
      await writer.close()
    } catch (e) {
      console.warn('writer.close() 时出错：', e)
    }
    try {
      writer.releaseLock()
    } catch { /* 忽略 */ }
    writer = null
  }

  if (port.value) {
    try {
      await port.value.close()
    } catch (e) {
      console.warn('port.close() 时出错：', e)
    }
    port.value = null
  }

  isConnected.value = false
}

/**
 * 发送一段字符串到串口
 * @param {string} commandText
 */
export async function sendCommand(commandText) {
  if (!isConnected.value || !writer) {
    console.warn('串口尚未连接，无法发送')
    return
  }
  try {
    const encoder = new TextEncoder()
    const data = encoder.encode(`${commandText.trim()}\n`)
    await writer.write(data)
  } catch (e) {
    console.error('发送失败：', e)
    throw e
  }
}

onBeforeUnmount(disconnect)
