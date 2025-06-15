export function parseConfig(str) {
  return str
    // 1) 先统一用分号和换行符分割
    .split(/;|\r?\n/)
    // 2) 去除每段的首尾空白
    .map(line => line.trim())
    // 3) 过滤掉空行和注释
    .filter(line => line && !line.startsWith('//'))
    // 4) 按空白再拆字段
    .map((line) => {
      const [idx, ref, axis, pin, closed, open, dMin, dMax, prefix]
        = line.split(/\s+/)
      return {
        idx,
        ref,
        axis,
        pin: Number(pin),
        closed: Number(closed),
        open: Number(open),
        dMin: Number.parseFloat(dMin),
        dMax: Number.parseFloat(dMax),
        prefix,
      }
    })
}

const text = `
leftEyebrow middleEyebrow y 5 35 135 0.219 0.279 U;
leftEyebrow middleEyebrow y 7 140 60 0.219 0.279 U;
rightEyebrow middleEyebrow y 4 140 60 0.219 0.279 U;
rightEyebrow middleEyebrow y 6 40 135 0.219 0.279 U;
leftEyeball leftEyeOuter x 2 72 178 0.186 0.312 U;
leftEyeball leftEyeOuter y 3 90 140 0.132 0.174 U;
rightLowerEyelid rightUpperEyelid y 11 80 43 0.1 0.262 U;
rightUpperEyelid rightLowerEyelid y 10 90 180 0.1 0.244 U;
leftLowerEyelid leftUpperEyelid y 13 84 134 0.1 0.262 U;
leftUpperEyelid leftLowerEyelid y 12 110 20 0.1 0.244 U;
rightUpperMouth zero distance 6 40 130 0.31 0.37 F;
rightLowerMouth zero distance 7 40 120 0.48 0.6 F;
leftUpperMouth zero distance 8 135 50 0.3 0.39 F;
leftLowerMouth zero distance 9 150 92 0.49 0.7 F;
UpperLip lowerLip distance 3 70 120 0.58 0.64 F;
UpperLip lowerLip distance 2 100 60 0.68 0.73 F;
UpperLip lowerLip distance 5 140 50 0.54 0.61 F;
UpperLip lowerLip distance 4 120 70 0.65 0.75 F;
UpperLip lowerLip distance 0 100 70 0.25 1.05 F;
`

console.log(parseConfig(text))
