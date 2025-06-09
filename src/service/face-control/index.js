import { sendCommand } from '@/service/serial'
import { faceLandmarks } from '@/service/vision'
import { onMounted, watchEffect } from 'vue'

// === 1. 常量 & 索引 ===
const IDX = Object.freeze({
  leftEyebrow: 336,
  leftEyebrowCorner: 300,
  rightEyebrow: 107,
  rightEyebrowCorner: 70,
  middleEyebrow: 8,

  leftEyeball: 473,
  leftEyeOuter: 263,

  leftUpperEyelid: 386,
  leftLowerEyelid: 374,
  rightUpperEyelid: 159,
  rightLowerEyelid: 145,

  leftUpperMouth: 391,
  leftLowerMouth: 335,
  rightUpperMouth: 163,
  rightLowerMouth: 106,

  noseTip: 4,
  upperLip: 11,
  lowerLip: 16,
})

// === 2. 扁平化伺服配置 ===
const servoConfigs = [
  // —— 眉毛 —— （测 Y 轴，相对 middleEyebrow）
  { idx: 'leftEyebrow', ref: 'middleEyebrow', axis: 'y', pin: 5, closed: 70, open: 110, dMin: 0.021, dMax: 0.025, prefix: 'servo_debug' },
  { idx: 'leftEyebrowCorner', ref: 'middleEyebrow', axis: 'y', pin: 7, closed: 90, open: 140, dMin: 0.022, dMax: 0.030, prefix: 'servo_debug' },
  { idx: 'rightEyebrow', ref: 'middleEyebrow', axis: 'y', pin: 4, closed: 80, open: 50, dMin: 0.021, dMax: 0.025, prefix: 'servo_debug' },
  { idx: 'rightEyebrowCorner', ref: 'middleEyebrow', axis: 'y', pin: 6, closed: 60, open: 110, dMin: 0.022, dMax: 0.030, prefix: 'servo_debug' },

  // —— 眼球 —— （水平测 x ，垂直测 y，相对 leftEyeOuter）
  { idx: 'leftEyeball', ref: 'leftEyeOuter', axis: 'x', pin: 2, closed: 40, open: 118, dMin: -0.020, dMax: -0.012, prefix: 'servo_debug' },
  { idx: 'leftEyeball', ref: 'leftEyeOuter', axis: 'y', pin: 3, closed: 90, open: 138, dMin: -0.010, dMax: -0.030, prefix: 'servo_debug' },

  // —— 眼皮 —— （测 Y 轴，下减上）
  { idx: 'leftLowerEyelid', ref: 'leftUpperEyelid', axis: 'y', pin: 11, closed: 70, open: 12, dMin: 0.004, dMax: 0.016, prefix: 'servo_debug' },
  { idx: 'leftUpperEyelid', ref: 'leftLowerEyelid', axis: 'y', pin: 10, closed: 50, open: 170, dMin: 0.004, dMax: 0.016, prefix: 'servo_debug' },
  { idx: 'rightLowerEyelid', ref: 'rightUpperEyelid', axis: 'y', pin: 13, closed: 10, open: 50, dMin: 0.004, dMax: 0.016, prefix: 'servo_debug' },
  { idx: 'rightUpperEyelid', ref: 'rightLowerEyelid', axis: 'y', pin: 12, closed: 160, open: 10, dMin: 0.004, dMax: 0.016, prefix: 'servo_debug' },

  // —— 嘴角 —— （2D 欧氏距离，相对 noseTip）
  { idx: 'leftUpperMouth', ref: 'noseTip', axis: 'distance', pin: 6, closed: 75, open: 57, dMin: 0.064, dMax: 0.066, prefix: 'slave_debug' },
  { idx: 'leftLowerMouth', ref: 'noseTip', axis: 'distance', pin: 7, closed: 70, open: 100, dMin: 0.117, dMax: 0.158, prefix: 'slave_debug' },
  { idx: 'rightUpperMouth', ref: 'noseTip', axis: 'distance', pin: 8, closed: 100, open: 80, dMin: 0.068, dMax: 0.067, prefix: 'slave_debug' },
  { idx: 'rightLowerMouth', ref: 'noseTip', axis: 'distance', pin: 9, closed: 110, open: 140, dMin: 0.119, dMax: 0.164, prefix: 'slave_debug' },
]

// === 3. 状态 & 节流 ===
const lastAngles = Object.fromEntries(
  servoConfigs.map(cfg => [cfg.pin, null]),
)
let lastSentTime = 0

// === 4. 工具函数 ===
const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v))
function map(v, iMin, iMax, oMin, oMax) {
  const t = clamp((v - iMin) / (iMax - iMin))
  return oMin + t * (oMax - oMin)
}
function distance2D(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

// === 5. 主循环：统一遍历所有配置 ===
watchEffect(() => {
  const lm = faceLandmarks.value
  if (!lm || lm.length < 468) {
    return
  }

  const now = Date.now()
  if (now - lastSentTime < 20) {
    return
  }
  lastSentTime = now

  servoConfigs.forEach((cfg) => {
    const p1 = lm[IDX[cfg.idx]]
    const p2 = lm[IDX[cfg.ref]]
    if (!p1 || !p2) {
      return
    }

    // 计算 delta
    const delta = cfg.axis === 'distance'
      ? distance2D(p1, p2)
      : Math.abs(p1[cfg.axis] - p2[cfg.axis])

    const angle = Math.round(
      map(delta, cfg.dMin, cfg.dMax, cfg.closed, cfg.open),
    )
    if (angle === lastAngles[cfg.pin]) {
      return
    }

    sendCommand(`${cfg.prefix}:${cfg.pin},${angle}`)
    lastAngles[cfg.pin] = angle
  })

  // —— 额外：下巴张合 ——
  const lipDelta = lm[IDX.lowerLip].y - lm[IDX.upperLip].y
  sendCommand(lipDelta >= 0.07 ? 'jaw_open' : 'jaw_close')
})

// === 6. 初始化 ===
onMounted(() => sendCommand('reset'))
