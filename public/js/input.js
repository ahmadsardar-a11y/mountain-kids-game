/**
 * input.js — Keyboard and touch input handling
 */

const Input = (function () {
    // ── Constants ──
    const KEYS = {
        W: 87, A: 65, S: 83, D: 68,
        UP: 38, LEFT: 37, DOWN: 40, RIGHT: 39,
        SPACE: 32
    };

    // ── State ──
    const pressed = new Set();
    let touchInput = { x: 0, y: 0 };
    let touchActive = false;
    let firstInteraction = false;

    // ── Keyboard ──
    function onKeyDown(e) {
        pressed.add(e.keyCode);
        if (!firstInteraction) {
            firstInteraction = true;
        }
    }

    function onKeyUp(e) {
        pressed.delete(e.keyCode);
    }

    // ── Touch Joystick ──
    const JOYSTICK_MAX_RADIUS = 40;
    const JOYSTICK_DEADZONE = 0.15; // 15% deadzone for mobile
    let joystickCenter = { x: 0, y: 0 };
    let joystickDragging = false;
    let smoothedTouchInput = { x: 0, y: 0 }; // for steering smoothing

    function initJoystick() {
        const zone = document.getElementById('joystick-zone');
        const base = document.getElementById('joystick-base');
        const knob = document.getElementById('joystick-knob');
        if (!zone || !knob) return;

        function getCenter() {
            const rect = base.getBoundingClientRect();
            return {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };
        }

        function updateKnob(dx, dy) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            const clamped = Math.min(dist, JOYSTICK_MAX_RADIUS);
            const angle = Math.atan2(dy, dx);
            const nx = Math.cos(angle) * clamped;
            const ny = Math.sin(angle) * clamped;
            knob.style.transform = `translate(${nx}px, ${ny}px)`;

            // Raw normalized input (-1 to 1)
            let rawX = nx / JOYSTICK_MAX_RADIUS;
            let rawY = ny / JOYSTICK_MAX_RADIUS;

            // Apply deadzone
            let deadX = Math.abs(rawX) < JOYSTICK_DEADZONE ? 0 : (rawX - Math.sign(rawX) * JOYSTICK_DEADZONE) / (1 - JOYSTICK_DEADZONE);
            let deadY = Math.abs(rawY) < JOYSTICK_DEADZONE ? 0 : (rawY - Math.sign(rawY) * JOYSTICK_DEADZONE) / (1 - JOYSTICK_DEADZONE);

            // Apply exponential curve for finer control near center
            touchInput.x = Math.sign(deadX) * Math.pow(Math.abs(deadX), 1.4);
            touchInput.y = Math.sign(deadY) * Math.pow(Math.abs(deadY), 1.4);
        }

        function start(e) {
            e.preventDefault();
            joystickCenter = getCenter();
            joystickDragging = true;
            touchActive = true;
            firstInteraction = true;
            move(e);
        }

        function move(e) {
            if (!joystickDragging) return;
            e.preventDefault();
            const touch = e.touches ? e.touches[0] : e;
            const dx = touch.clientX - joystickCenter.x;
            const dy = touch.clientY - joystickCenter.y;
            updateKnob(dx, dy);
        }

        function end(e) {
            if (e) e.preventDefault();
            joystickDragging = false;
            touchActive = false;
            touchInput.x = 0;
            touchInput.y = 0;
            knob.style.transform = 'translate(0px, 0px)';
        }

        zone.addEventListener('touchstart', start, { passive: false });
        document.addEventListener('touchmove', move, { passive: false });
        document.addEventListener('touchend', end, { passive: false });
        zone.addEventListener('mousedown', start);
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', end);
    }

    // ── Public API ──
    function init() {
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        initJoystick();
    }

    function getThrottle() {
        let t = 0;
        if (pressed.has(KEYS.W) || pressed.has(KEYS.UP)) t += 1;
        if (pressed.has(KEYS.S) || pressed.has(KEYS.DOWN)) t -= 1;
        if (touchActive) t -= touchInput.y;
        return Math.max(-1, Math.min(1, t));
    }

    function getSteering() {
        let s = 0;
        if (pressed.has(KEYS.A) || pressed.has(KEYS.LEFT)) s -= 1;
        if (pressed.has(KEYS.D) || pressed.has(KEYS.RIGHT)) s += 1;
        if (touchActive) {
            // Smooth steering ramp (5-frame lerp for mobile)
            smoothedTouchInput.x += (touchInput.x - smoothedTouchInput.x) * 0.2;
            s += smoothedTouchInput.x;
        }
        return Math.max(-1, Math.min(1, s));
    }

    function isBraking() {
        return pressed.has(KEYS.SPACE);
    }

    function hasInteracted() {
        return firstInteraction;
    }

    function resetInteraction() {
        firstInteraction = false;
        pressed.clear();
        touchActive = false;
        touchInput.x = 0;
        touchInput.y = 0;
        smoothedTouchInput.x = 0;
        smoothedTouchInput.y = 0;
    }

    return { init, getThrottle, getSteering, isBraking, hasInteracted, resetInteraction };
})();
