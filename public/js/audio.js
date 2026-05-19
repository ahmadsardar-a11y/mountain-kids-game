/**
 * audio.js — Web Audio API sound engine
 */

const GameAudio = (function () {
    // ── State ──
    let ctx = null;
    let engineGain = null;
    let engineOsc = null;
    let masterGain = null;
    let muted = false;
    let started = false;

    // ── Init ──
    function ensureContext() {
        if (!ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            ctx = new AudioContext();
            masterGain = ctx.createGain();
            masterGain.connect(ctx.destination);
            masterGain.gain.value = 0.4;
        }
    }

    function startEngine() {
        if (started) return;
        ensureContext();
        started = true;

        // Resume context if suspended (autoplay policy)
        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        // Engine drone: mix of two oscillators for a "motor" feel
        engineGain = ctx.createGain();
        engineGain.connect(masterGain);
        engineGain.gain.value = 0.15;

        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 80;
        engineOsc.connect(engineGain);
        engineOsc.start();
    }

    function stopEngine() {
        if (!started) return;
        started = false;
        if (engineOsc) {
            try {
                engineOsc.stop();
            } catch (e) {
                // oscillator may already be stopped
            }
            engineOsc.disconnect();
            engineOsc = null;
        }
        if (engineGain) {
            engineGain.disconnect();
            engineGain = null;
        }
    }

    // ── Engine Pitch ──
    function updateEngine(speedRatio) {
        if (!engineOsc) return;
        // Map speed ratio 0..1 to frequency 80..220
        const base = 80 + speedRatio * 140;
        engineOsc.frequency.setTargetAtTime(base, ctx.currentTime, 0.1);
        if (engineGain) {
            const vol = 0.05 + speedRatio * 0.15;
            engineGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.1);
        }
    }

    // ── Collect Chime ──
    function playCollect() {
        if (!ctx || muted) return;
        const now = ctx.currentTime;

        // Two-tone pleasant chime
        const g = ctx.createGain();
        g.connect(masterGain);
        g.gain.setValueAtTime(0.25, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        const osc1 = ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, now);
        osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.3);
        osc1.connect(g);
        osc1.start(now);
        osc1.stop(now + 0.5);

        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1100, now);
        osc2.connect(g);
        osc2.start(now);
        osc2.stop(now + 0.5);
    }

    // ── Bomb Sound (ticking + explosion) ──
    function playBomb() {
        if (!ctx || muted) return;
        const now = ctx.currentTime;
        // Ticking: 3 fast beeps
        for (let i = 0; i < 3; i++) {
            const g = ctx.createGain();
            g.connect(masterGain);
            g.gain.setValueAtTime(0.3, now + i * 0.12);
            g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.08);
            const osc = ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.value = 880;
            osc.connect(g);
            osc.start(now + i * 0.12);
            osc.stop(now + i * 0.12 + 0.08);
        }
        // Explosion: noise burst + low boom
        const noise = ctx.createBufferSource();
        const bufferSize = ctx.sampleRate * 0.3;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.05));
        }
        noise.buffer = buffer;
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.4, now + 0.4);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
        noise.connect(noiseGain);
        noiseGain.connect(masterGain);
        noise.start(now + 0.4);

        // Low boom
        const boom = ctx.createOscillator();
        boom.type = 'sine';
        boom.frequency.setValueAtTime(120, now + 0.4);
        boom.frequency.exponentialRampToValueAtTime(30, now + 0.7);
        const boomGain = ctx.createGain();
        boomGain.gain.setValueAtTime(0.4, now + 0.4);
        boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
        boom.connect(boomGain);
        boomGain.connect(masterGain);
        boom.start(now + 0.4);
        boom.stop(now + 0.7);
    }

    // ── Zombie Hit (Mario bump) ──
    function playZombie() {
        if (!ctx || muted) return;
        const now = ctx.currentTime;
        const g = ctx.createGain();
        g.connect(masterGain);
        g.gain.setValueAtTime(0.3, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.15);
        osc.connect(g);
        osc.start(now);
        osc.stop(now + 0.2);
    }

    // ── Win Sound (Mario victory fanfare) ──
    function playWin() {
        if (!ctx || muted) return;
        const now = ctx.currentTime;
        const notes = [
            { freq: 523, duration: 0.15 },
            { freq: 659, duration: 0.15 },
            { freq: 784, duration: 0.15 },
            { freq: 1047, duration: 0.4 }
        ];
        notes.forEach((note, i) => {
            const g = ctx.createGain();
            g.connect(masterGain);
            g.gain.setValueAtTime(0.25, now + i * 0.18);
            g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + note.duration);
            const osc = ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.value = note.freq;
            osc.connect(g);
            osc.start(now + i * 0.18);
            osc.stop(now + i * 0.18 + note.duration);
        });
    }

    // ── Lose Sound (Mario death descending) ──
    function playLose() {
        if (!ctx || muted) return;
        const now = ctx.currentTime;
        const notes = [880, 830, 784, 740, 698, 659, 622, 587, 554, 523];
        notes.forEach((freq, i) => {
            const g = ctx.createGain();
            g.connect(masterGain);
            g.gain.setValueAtTime(0.2, now + i * 0.08);
            g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.12);
            const osc = ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.value = freq;
            osc.connect(g);
            osc.start(now + i * 0.08);
            osc.stop(now + i * 0.08 + 0.12);
        });
    }

    // ── Mute ──
    function setMute(value) {
        muted = value;
        if (masterGain) {
            masterGain.gain.setTargetAtTime(muted ? 0 : 0.4, ctx.currentTime, 0.05);
        }
    }

    function isMuted() {
        return muted;
    }

    return {
        startEngine,
        stopEngine,
        updateEngine,
        playCollect,
        playBomb,
        playZombie,
        playWin,
        playLose,
        setMute,
        isMuted
    };
})();
