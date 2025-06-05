import { DrawingUtils, FaceLandmarker } from '@mediapipe/tasks-vision'
import { ref } from 'vue'
import {
  closeVision,
  faceLandmarker,
  initializeVision,
} from './init'

let timerId = null

export const faceLandmarks = ref(null)

export const drawOptions = {
  landmarks: true, // 是否绘制每个关键点
  meshConnections: true, // 是否绘制网格线
  threshold: {
    minConfidence: 0.5,
    smooth: true,
  },
}

async function predictWebcam(video, canvas) {
  if (!video || !canvas) {
    return
  }

  if (video.paused) {
    try {
      await video.play()
    } catch (e) {
      console.error('无法播放视频', e)
      return
    }
  }

  const now = Date.now()
  const faceResult = await faceLandmarker.detectForVideo(video, now)
  const currentFaceLandmarks = faceResult ? faceResult.faceLandmarks : null
  faceLandmarks.value = currentFaceLandmarks

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    console.error('无法获取 Canvas 上下文')
    return
  }

  ctx.save()
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

  if (currentFaceLandmarks && currentFaceLandmarks.length) {
    const connectionsArray = FaceLandmarker.FACE_LANDMARKS_TESSELATION || []

    // 第 0 个人脸的 468 个关键点
    const landmarkArray = currentFaceLandmarks[0]
    if (landmarkArray && landmarkArray.length) {
      const d = new DrawingUtils(ctx)

      if (drawOptions.meshConnections && connectionsArray.length) {
        d.drawConnectors(landmarkArray, connectionsArray, {
          color: '#FFFFFF',
          lineWidth: 0.1,
        })
      }

      if (drawOptions.landmarks) {
        d.drawLandmarks(landmarkArray, { color: '#FFFFFF', radius: 0.1 })
      }
    }
  }

  ctx.restore()
  timerId = setTimeout(() => predictWebcam(video, canvas), 16)
}

export async function startFaceCapture(video, canvas) {
  if (!video || !canvas) {
    console.error('需要提供 video 和 canvas')
    return
  }

  if (!faceLandmarker) {
    console.warn('FaceLandmarker 模型加载中...')
    await initializeVision()
    console.warn('FaceLandmarker 模型加载完成')
  }

  predictWebcam(video, canvas)
}

export function stopFaceCapture(canvas) {
  if (timerId) {
    clearTimeout(timerId)
    timerId = null
  }
  closeVision()
  if (canvas) {
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }
  faceLandmarks.value = null
}
