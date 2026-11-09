// Tool intervals may overlap. Count their union, rather than attributing a
// negative remainder to the model. The remainder also includes startup/I/O.
export function summarizeTiming(startedAt, finishedAt, firstOutputAt, events) {
  const calls = new Map()
  const intervals = []
  for (const event of events) {
    if (event.event === 'call') calls.set(String(event.id), Date.parse(event.at))
    if (event.event === 'result' && calls.has(String(event.id))) {
      const from = Math.max(startedAt, calls.get(String(event.id)))
      const to = Math.min(finishedAt, Date.parse(event.at))
      if (Number.isFinite(from) && Number.isFinite(to) && to >= from) intervals.push([from, to])
    }
  }
  let toolMs = 0
  let previous = null
  for (const interval of intervals.sort((a,b) => a[0]-b[0])) {
    if (!previous || interval[0] > previous[1]) {
      if (previous) toolMs += previous[1]-previous[0]
      previous = [...interval]
    } else previous[1] = Math.max(previous[1],interval[1])
  }
  if (previous) toolMs += previous[1]-previous[0]
  return {totalMs:finishedAt-startedAt, toolMs, nonToolMs:finishedAt-startedAt-toolMs, firstOutputMs:firstOutputAt === null ? null : firstOutputAt-startedAt, toolCalls:calls.size}
}
