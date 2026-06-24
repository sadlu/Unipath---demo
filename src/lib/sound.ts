let ctx: AudioContext | null = null

function getCtx() {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function play(freq: number, duration: number, type: OscillatorType = 'sine', vol = 0.08) {
  const c = getCtx()
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.value = freq
  g.gain.value = vol
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration)
  o.connect(g).connect(c.destination)
  o.start()
  o.stop(c.currentTime + duration)
}

export const sounds = {
  click: () => play(800, 0.06, 'sine', 0.06),
  success: () => { play(523, 0.1, 'sine', 0.07); setTimeout(() => play(659, 0.1, 'sine', 0.07), 80) },
  error: () => play(200, 0.2, 'square', 0.05),
  tab: () => play(600, 0.05, 'triangle', 0.05),
  toggleOn: () => play(900, 0.05, 'sine', 0.05),
  toggleOff: () => play(500, 0.05, 'sine', 0.04),
  submit: () => { play(440, 0.06, 'sine', 0.06); setTimeout(() => play(660, 0.08, 'sine', 0.06), 60) },
}
