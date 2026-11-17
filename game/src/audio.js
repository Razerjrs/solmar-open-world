// Sound, all synthesized with WebAudio: no audio files, no network. Engine hum,
// sirens, punches, pickups and a small procedural music loop, with a mute toggle.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let engineNodes = null;
  let sirenNodes = null;
  let musicTimer = null;
  let musicStep = 0;
  let sirenOn = false;

  /** Start the audio context on the first user gesture (browsers demand one). */
  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      startMusic();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, seconds, type, gainValue, when = 0) {
    if (!context || !master) return;
    const t = context.currentTime + when;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(gainValue, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + seconds + 0.05);
  }

  function noise(seconds, gainValue, filterFreq, when = 0) {
    if (!context || !master) return;
    const t = context.currentTime + when;
    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    gain.gain.value = gainValue;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t);
  }

  /** A four-bar bassline with a hat tick, looped while the game runs. */
  function startMusic() {
    if (musicTimer || !context) return;
    const bass = [55, 0, 55, 65.41, 55, 0, 49, 58.27, 55, 0, 55, 65.41, 82.41, 73.42, 65.41, 49];
    musicTimer = window.setInterval(() => {
      if (!context || muted) return;
      const step = musicStep % 16;
      const note = bass[step];
      if (note > 0) tone(note, 0.22, 'sine', 0.16);
      if (step % 2 === 0) noise(0.03, 0.05, 6000);
      if (step === 0 || step === 8) tone(220, 0.5, 'triangle', 0.04);
      musicStep += 1;
    }, 150);
  }

  function startEngine() {
    if (!context || engineNodes) return;
    const osc = context.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 60;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const gain = context.createGain();
    gain.gain.value = 0;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start();
    engineNodes = { osc, gain };
  }

  function startSiren() {
    if (!context || sirenNodes) return;
    const osc = context.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 700;
    const gain = context.createGain();
    gain.gain.value = 0.045;
    const lfo = context.createOscillator();
    lfo.frequency.value = 1.4;
    const lfoGain = context.createGain();
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    lfo.start();
    sirenNodes = { osc, lfo, gain };
  }

  function stopSiren() {
    if (!sirenNodes) return;
    try { sirenNodes.osc.stop(); sirenNodes.lfo.stop(); } catch { /* already stopped */ }
    sirenNodes = null;
  }

  return {
    ensure,
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
      if (muted) stopSiren();
    },
    isMuted() {
      return muted;
    },
    /** Keep the engine hum and siren in step with the game: call every frame. */
    update(driving, speedRatio, wanted) {
      if (!context) return;
      if (driving) {
        startEngine();
        if (engineNodes) {
          engineNodes.osc.frequency.value = 55 + speedRatio * 130;
          engineNodes.gain.gain.value = 0.05 + speedRatio * 0.06;
        }
      } else if (engineNodes) {
        engineNodes.gain.gain.value = 0;
      }
      const shouldSiren = wanted >= 2 && !muted;
      if (shouldSiren && !sirenOn) { startSiren(); sirenOn = true; }
      if (!shouldSiren && sirenOn) { stopSiren(); sirenOn = false; }
    },
    punch() {
      noise(0.12, 0.5, 900);
      tone(90, 0.12, 'sine', 0.5);
    },
    hit() {
      noise(0.08, 0.3, 500);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.25);
      tone(990, 0.12, 'sine', 0.25, 0.08);
    },
    cash() {
      tone(880, 0.08, 'triangle', 0.22);
      tone(1174, 0.1, 'triangle', 0.22, 0.07);
      tone(1568, 0.14, 'triangle', 0.22, 0.14);
    },
    crash() {
      noise(0.3, 0.6, 400);
      tone(70, 0.25, 'sine', 0.5);
    },
    sirenBlip() {
      tone(950, 0.15, 'square', 0.12);
      tone(700, 0.15, 'square', 0.12, 0.15);
    },
    missionDone() {
      [523, 659, 784, 1046].forEach((freq, i) => tone(freq, 0.18, 'triangle', 0.25, i * 0.09));
    },
    click() {
      tone(440, 0.05, 'sine', 0.15);
    },
    busted() {
      [392, 370, 349, 311].forEach((freq, i) => tone(freq, 0.25, 'sawtooth', 0.18, i * 0.16));
    },
  };
}
