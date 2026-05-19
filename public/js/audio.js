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

    // ── Win Sound ──
    function playWin() {
        if (!ctx || muted) return;
        const now = ctx.currentTime;
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
            const g = ctx.createGain();
            g.connect(masterGain);
            g.gain.setValueAtTime(0.2, now + i * 0.15);
            g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.4);

            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            osc.connect(g);
            osc.start(now + i * 0.15);
            osc.stop(now + i * 0.15 + 0.4);
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
        playWin,
        setMute,
        isMuted
    };
})();
