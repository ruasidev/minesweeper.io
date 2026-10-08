import bombClick from "../../ui-sounds/bomb-click.mp3"
import cellClickPop from "../../ui-sounds/cell-click-pop.mp3"
import dullExplosion from "../../ui-sounds/dull-explosion.mp3"
import errorSound from "../../ui-sounds/error-sound.mp3"
import gameStartCountdown from "../../ui-sounds/game-start-countdown.mp3"
import itemRewardSound from "../../ui-sounds/item-reward-sound.mp3"
import keyboardClick from "../../ui-sounds/keyboard-click.mp3"
import lossSound from "../../ui-sounds/loss-sound.mp3"
import popExplosion from "../../ui-sounds/pop-explosion.mp3"
import roomJoin from "../../ui-sounds/room-join.mp3"
import startGameGo from "../../ui-sounds/start-game-go.mp3"
import uiClickSound from "../../ui-sounds/ui-click-sound.mp3"

type Sound = {
  file: string
  // how loud it is next to the others, 0 to 1
  volume: number
  // Set to make every play a slightly different pitch. The file's own pitch stays the most likely one;
  // these say how far a play typically strays below it and above it, in semitones. The wider side is also
  // the more likely one, so a bigger `lower` means most of the variation goes down in pitch
  pitchSpread?: { lower: number, higher: number }
}

// Every sound effect: what it is for and the file it plays.
// ui-sounds/game-found.mp3 isn't here yet: it is waiting for the matchmaking queue.
// (game-start.mp3 and button-click-select.mp3 are in the folder too, and not used any more.)
const SOUNDS = {
  // the screen changing: another page, themes or settings opening or closing, the account window opening
  transition: { file: uiClickSound, volume: 0.5 },
  // uncovering one or more cells
  reveal: { file: cellClickPop, volume: 0.8 },
  // placing or removing a flag
  flag: { file: cellClickPop, volume: 0.8 },
  // singleplayer: the click that lands on a mine, and the whole board going up after it
  mineClick: { file: bombClick, volume: 0.5 },
  boardExplodes: { file: dullExplosion, volume: 0.45 },
  // multiplayer: uncovering a mine, which only costs a few seconds
  mineHit: { file: popExplosion, volume: 0.5 },
  // singleplayer: the game-over screen appearing
  gameOver: { file: lossSound, volume: 0.5 },
  // clearing the board, in either mode
  win: { file: itemRewardSound, volume: 1 },
  // multiplayer: someone coming into the room, yourself included
  roomJoin: { file: roomJoin, volume: 0.8 },
  // each number of the countdown before a game starts, and the moment it does
  countdown: { file: gameStartCountdown, volume: 0.8 },
  go: { file: startGameGo, volume: 1 },
  // each key pressed while typing in the chat; no two presses sound quite alike, as on a real keyboard
  key: { file: keyboardClick, volume: 0.4, pitchSpread: { lower: 1.2, higher: 0.5 } },
  // something that was asked for couldn't be done (a wrong passcode, a failed log in)
  error: { file: errorSound, volume: 0.8 },
} satisfies Record<string, Sound>

export type SoundName = keyof typeof SOUNDS

// Set from the settings (see SettingsContext)
let enabled = true
let masterVolume = 0.6

export function configureSounds(options: { enabled: boolean, volume: number }) {
  enabled = options.enabled
  masterVolume = Math.min(1, Math.max(0, options.volume))
}

// Each sound is fetched and decoded once, as the app starts, and played through the Web Audio API,
// so it starts the instant it is asked for. (An <audio> element loads its file again for every play, which is heard as a lag.)
type LoadedSound = {
  buffer: AudioBuffer
  // how far into the file the sound itself begins, in seconds
  startAt: number
}
const loaded = new Map<SoundName, LoadedSound>()

// Sound files tend to open with a little silence, some of them a noticeable amount. Playing from where
// the sound actually begins is what makes it land on the click
function findStart(buffer: AudioBuffer): number {
  const AUDIBLE = 0.02
  let first = buffer.length
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel)
    for (let i = 0; i < first; i++) {
      if (Math.abs(samples[i]) > AUDIBLE) {
        first = i
        break
      }
    }
  }
  // a hair before it, so the very start of the sound isn't clipped
  return Math.max(0, first / buffer.sampleRate - 0.003)
}

async function load(name: SoundName) {
  const file = await (await fetch(SOUNDS[name].file)).arrayBuffer()
  // Decoding is done by a context that never plays anything, because a browser won't let a page
  // start one that does until the page has been clicked on
  const buffer = await new OfflineAudioContext(2, 1, 44100).decodeAudioData(file)
  loaded.set(name, { buffer, startAt: findStart(buffer) })
}
for (const name of Object.keys(SOUNDS) as SoundName[]) {
  load(name).catch(error => console.warn(`Could not load the "${name}" sound:`, error))
}

// What actually makes the noise. A browser only lets a page start one once the page has been pressed on,
// so it is started on the very first press: by the time that press turns into a click, it is ready
let output: AudioContext | null = null
function startOutput(): AudioContext {
  output ??= new AudioContext()
  if (output.state === "suspended") output.resume().catch(() => {})
  return output
}
window.addEventListener("pointerdown", startOutput, { once: true, capture: true })

// A random number from the standard normal distribution (mean 0, standard deviation 1), by the Box-Muller method.
// Cut off at 2.5 either way, so that one press in a hundred doesn't come out absurdly high or low
function randomNormal(): number {
  const value = Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random())
  return Math.max(-2.5, Math.min(2.5, value))
}

// A random pitch shift in semitones, from two half bell curves of different widths joined at their peak
// (a "two-piece" normal distribution). No shift at all is the most likely outcome. Each side is picked in
// proportion to its width, which is what keeps the peak at zero rather than leaving a step there
function randomPitchShift({ lower, higher }: { lower: number, higher: number }): number {
  const size = Math.abs(randomNormal())
  return Math.random() < lower / (lower + higher) ? -size * lower : size * higher
}

// Plays a sound, now or `delayMs` from now. A delayed sound is timed by the sound hardware's own clock,
// so it lands on the moment it was asked for rather than whenever the page next gets round to it.
// Returns a way to call it off before it has played
export function playSound(name: SoundName, delayMs = 0): () => void {
  const sound = loaded.get(name)
  if (!enabled || masterVolume === 0 || !sound) return () => {}
  const { volume, pitchSpread }: Sound = SOUNDS[name]

  const context = startOutput()
  const source = context.createBufferSource()
  source.buffer = sound.buffer
  // Playing faster raises the pitch, and each semitone up is a factor of 2^(1/12)
  if (pitchSpread) source.playbackRate.value = 2 ** (randomPitchShift(pitchSpread) / 12)
  const gain = context.createGain()
  gain.gain.value = masterVolume * volume
  source.connect(gain).connect(context.destination)
  // what is played takes a moment to come out of the speakers (a long one over Bluetooth), so a sound
  // that is timed is sent that much early
  const outputDelay = delayMs > 0 ? context.outputLatency || context.baseLatency || 0 : 0
  source.start(context.currentTime + Math.max(0, delayMs / 1000 - outputDelay), sound.startAt)
  return () => {
    try {
      source.stop()
    } catch {
      // already over
    }
  }
}
