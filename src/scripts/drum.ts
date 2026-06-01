// Drum Snare Accents — client logic.
// Generates a random 4/4 bar of 16 sixteenth notes (each accented or not),
// renders it as hand-drawn drum notation, and plays it back with a kick-style
// metronome pulse using the Web Audio API.

const STEPS = 16; // sixteenth notes in a 4/4 bar

// ----- Notation geometry -----
const SVG_W = 920;
const SVG_H = 135;
const STAFF_TOP = 70; // y of top staff line
const LINE_GAP = 11; // gap between staff lines
const NOTE_Y = STAFF_TOP + LINE_GAP * 1.5; // snare on the 3rd space
const NOTES_START_X = 175;
const NOTE_SPACING = 44;
const BARLINE_X = NOTES_START_X + NOTE_SPACING * (STEPS - 1) + 36;
const BEAM_Y = 30; // top of stems / first beam
const BEAM_GAP = 7; // gap between the two sixteenth beams
const STEM_DX = 6; // stem offset from notehead centre

const noteX = (i: number) => NOTES_START_X + i * NOTE_SPACING;

// ----- State -----
let accents: boolean[] = randomBar();
let bpm = 90;
let isPlaying = false;
let muteUnaccented = true;

// ----- Random generation -----
function randomBar(): boolean[] {
  const bar: boolean[] = [];
  for (let i = 0; i < STEPS; i++) bar.push(Math.random() < 0.5);
  return bar;
}

// ===================================================================
// Notation rendering (hand-drawn SVG)
// ===================================================================
function renderNotation(): void {
  const container = document.getElementById("notation")!;

  let staffLines = "";
  for (let l = 0; l < 5; l++) {
    const y = STAFF_TOP + l * LINE_GAP;
    staffLines += `<line x1="40" y1="${y}" x2="${BARLINE_X}" y2="${y}" class="hd-stroke" />`;
  }

  // Neutral percussion clef (two vertical bars) + 4/4 time signature.
  const clefX = 60;
  const clef = `
    <line x1="${clefX}" y1="${STAFF_TOP + LINE_GAP}" x2="${clefX}" y2="${STAFF_TOP + LINE_GAP * 3}" class="hd-stroke thick" />
    <line x1="${clefX + 8}" y1="${STAFF_TOP + LINE_GAP}" x2="${clefX + 8}" y2="${STAFF_TOP + LINE_GAP * 3}" class="hd-stroke thick" />`;
  const tsX = 95;
  const time = `
    <text x="${tsX}" y="${STAFF_TOP + LINE_GAP * 2}" class="hd-text time">4</text>
    <text x="${tsX}" y="${STAFF_TOP + LINE_GAP * 4}" class="hd-text time">4</text>`;

  // Notes, stems, accents.
  let notes = "";
  let accentMarks = "";
  for (let i = 0; i < STEPS; i++) {
    const x = noteX(i);
    const stemX = x + STEM_DX;
    notes += `<ellipse id="note-${i}" cx="${x}" cy="${NOTE_Y}" rx="7.5" ry="5.5" class="hd-notehead" transform="rotate(-18 ${x} ${NOTE_Y})" />`;
    notes += `<line x1="${stemX}" y1="${NOTE_Y}" x2="${stemX}" y2="${BEAM_Y}" class="hd-stroke" />`;
    if (accents[i]) {
      accentMarks += `<text x="${stemX}" y="${BEAM_Y - 8}" class="hd-text accent" id="accent-${i}">&gt;</text>`;
    }
  }

  // Beams: two connected lines per beat group of 4 sixteenths.
  let beams = "";
  for (let beat = 0; beat < 4; beat++) {
    const first = noteX(beat * 4) + STEM_DX;
    const last = noteX(beat * 4 + 3) + STEM_DX;
    beams += `<line x1="${first}" y1="${BEAM_Y}" x2="${last}" y2="${BEAM_Y}" class="hd-stroke beam" />`;
    beams += `<line x1="${first}" y1="${BEAM_Y + BEAM_GAP}" x2="${last}" y2="${BEAM_Y + BEAM_GAP}" class="hd-stroke beam" />`;
  }

  // Final barline.
  const barline = `<line x1="${BARLINE_X}" y1="${STAFF_TOP}" x2="${BARLINE_X}" y2="${STAFF_TOP + LINE_GAP * 4}" class="hd-stroke thick" />`;

  container.innerHTML = `
    <svg viewBox="0 0 ${SVG_W} ${SVG_H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Randomly generated bar of sixteenth notes with accents">
      <defs>
        <filter id="rough">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.014" numOctaves="2" seed="${Math.floor(Math.random() * 1000)}" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.2" />
        </filter>
      </defs>
      <g filter="url(#rough)">
        ${staffLines}
        ${clef}
        ${time}
        ${beams}
        ${notes}
        ${accentMarks}
        ${barline}
      </g>
    </svg>`;
}

let lastHighlight = -1;
function highlightStep(step: number): void {
  if (step === lastHighlight) return;
  if (lastHighlight >= 0) {
    document.getElementById(`note-${lastHighlight}`)?.classList.remove("active");
  }
  if (step >= 0) {
    document.getElementById(`note-${step}`)?.classList.add("active");
  }
  lastHighlight = step;
}

// ===================================================================
// Web Audio engine
// ===================================================================
let audioCtx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;

function ensureAudio(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const len = audioCtx.sampleRate * 0.4;
    noiseBuffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  if (audioCtx.state === "suspended") void audioCtx.resume();
  return audioCtx;
}

// Snare: filtered noise burst + a short body tone. Accents are louder.
function playSnare(time: number, accented: boolean): void {
  const ctx = audioCtx!;
  const peak = accented ? 1.0 : 0.34;

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1750;
  bp.Q.value = 0.8;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 900;
  const nGain = ctx.createGain();
  nGain.gain.setValueAtTime(peak, time);
  nGain.gain.exponentialRampToValueAtTime(0.001, time + 0.13);
  noise.connect(bp).connect(hp).connect(nGain).connect(ctx.destination);
  noise.start(time);
  noise.stop(time + 0.15);

  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(190, time);
  osc.frequency.exponentialRampToValueAtTime(120, time + 0.1);
  const oGain = ctx.createGain();
  oGain.gain.setValueAtTime(peak * 0.5, time);
  oGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
  osc.connect(oGain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + 0.12);
}

// Metronome: deep kick-drum-like pulse on each quarter-note.
function playKick(time: number): void {
  const ctx = audioCtx!;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(155, time);
  osc.frequency.exponentialRampToValueAtTime(48, time + 0.13);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.95, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
  osc.connect(gain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + 0.18);
}

// ===================================================================
// Scheduler (lookahead pattern for accurate timing)
// ===================================================================
const LOOKAHEAD = 0.1; // seconds scheduled ahead
const TICK_MS = 25; // scheduler poll interval
let currentStep = 0;
let nextNoteTime = 0;
let timerId: number | undefined;
const visualQueue: { step: number; time: number }[] = [];

const secondsPerStep = () => 60 / bpm / 4; // sixteenth-note duration

function scheduleStep(step: number, time: number): void {
  if (step % 4 === 0) playKick(time);
  if (accents[step] || !muteUnaccented) playSnare(time, accents[step]);
  visualQueue.push({ step, time });
}

function scheduleNotes(): void {
  const ctx = audioCtx!;
  while (nextNoteTime < ctx.currentTime + LOOKAHEAD) {
    scheduleStep(currentStep, nextNoteTime);
    nextNoteTime += secondsPerStep();
    currentStep = (currentStep + 1) % STEPS;
  }
}

function drawLoop(): void {
  if (!isPlaying) return;
  const now = audioCtx!.currentTime;
  while (visualQueue.length && visualQueue[0].time <= now) {
    highlightStep(visualQueue.shift()!.step);
  }
  requestAnimationFrame(drawLoop);
}

function play(): void {
  const ctx = ensureAudio();
  isPlaying = true;
  currentStep = 0;
  nextNoteTime = ctx.currentTime + 0.05;
  visualQueue.length = 0;
  timerId = window.setInterval(scheduleNotes, TICK_MS);
  requestAnimationFrame(drawLoop);
  updatePlayButton();
}

function stop(): void {
  isPlaying = false;
  if (timerId !== undefined) clearInterval(timerId);
  timerId = undefined;
  visualQueue.length = 0;
  highlightStep(-1);
  updatePlayButton();
}

// ===================================================================
// UI wiring
// ===================================================================
function updatePlayButton(): void {
  const btn = document.getElementById("play")!;
  btn.textContent = isPlaying ? "Stop" : "Play";
  btn.classList.toggle("playing", isPlaying);
}

function updateBpm(delta: number): void {
  bpm = Math.min(240, Math.max(30, bpm + delta));
  document.getElementById("bpm-value")!.textContent = String(bpm);
}

function setupControls(): void {
  document.getElementById("play")!.addEventListener("click", () => {
    isPlaying ? stop() : play();
  });

  document.getElementById("generate")!.addEventListener("click", () => {
    accents = randomBar();
    lastHighlight = -1;
    renderNotation();
  });

  const muteBtn = document.getElementById("mute")!;
  muteBtn.addEventListener("click", () => {
    muteUnaccented = !muteUnaccented;
    muteBtn.textContent = muteUnaccented
      ? "Unmute unaccented"
      : "Mute unaccented";
    muteBtn.classList.toggle("active", muteUnaccented);
  });

  document.querySelectorAll<HTMLButtonElement>("[data-bpm]").forEach((el) => {
    el.addEventListener("click", () => updateBpm(Number(el.dataset.bpm)));
  });

  document.getElementById("bpm-value")!.textContent = String(bpm);
}

renderNotation();
setupControls();
