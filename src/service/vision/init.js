import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

// eslint-disable-next-line import/no-mutable-exports
let faceLandmarker = null

export const config = {
  model: {
    assetPath: '/face_landmarker.task',
    delegate: 'CPU',
  },
  detection: {
    minConfidence: 0.5,
    smooth: true,
  },
}

export async function initializeVision() {
  if (faceLandmarker) {
    return
  }

  try {
    const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm')

    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: config.model.assetPath,
        delegate: config.model.delegate,
      },
      runningMode: 'VIDEO',
      minTrackingConfidence: config.detection.minConfidence,
      outputFaceBlendshapes: false, // 根据需要可设为 true
      outputFacialTransformationMatrix: false,
    })

    console.warn('🧠 FaceLandmarker initialized')
  } catch (error) {
    console.error('❌ FaceLandmarker 初始化失败:', error)
  }
}

/**
 * 关闭 FaceLandmarker 模型
 */
export function closeVision() {
  if (faceLandmarker) {
    faceLandmarker.close()
    faceLandmarker = null
  }
}

export { faceLandmarker }
