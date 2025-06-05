const streams = new Map() // 存储设备 ID -> MediaStream 映射

/**
 * 获取可用的视频设备
 * @returns {Promise<Array>} 返回可用摄像头设备列表
 */
export async function getVideoDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const videoDevices = devices.filter(d => d.kind === 'videoinput')

    if (videoDevices.length === 0) {
      return []
    }

    return videoDevices
  } catch (error) {
    console.error('❌ 获取设备列表失败:', error)
    return []
  }
}

/**
 * 启动摄像头（返回 `MediaStream`）
 * @param {string} deviceId - 摄像头设备 ID 或 `facingMode` (iOS)
 * @returns {Promise<MediaStream | null>} 摄像头流
 */
export async function startCamera(deviceId) {
  try {
    // 其他设备使用 `deviceId`
    const constraints = { video: { deviceId: { exact: deviceId } }, audio: false }

    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    streams.set(deviceId, stream)
    return stream
  } catch (error) {
    console.warn(`⚠️ 无法启动摄像头 (${deviceId})`, error)
    return null
  }
}

/**
 * 停止摄像头
 * @param {string} deviceId - 摄像头设备 ID 或 `facingMode`
 */
export function stopCamera(deviceId) {
  const stream = streams.get(deviceId)
  if (stream) {
    stream.getTracks().forEach(track => track.stop())
    streams.delete(deviceId)
  }
}
