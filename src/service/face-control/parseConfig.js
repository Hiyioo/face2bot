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
