/**
 * engine.js — Game loop, state machine, and orchestration
 */

const Engine = (function () {
    // ── Constants ──
    const STATES = {
        MENU: 'MENU',
        PLAYING: 'PLAYING',
        GAME_OVER: 'GAME_OVER'
    };
    const DT_TARGET = 1 / 60;

    // ── State ──
    let state = STATES.MENU;
    let renderer = null;
    let scene = null;
    let camera = null;
    let clock = new THREE.Clock();
    let gemFlash = null;
    let timeRemaining = 60;
    let timerActive = false;
    let difficulty = 'easy';
    let aiScore = 0;
    let playerScore = 0;

    // ── Airborne detection ──
    let airTime = 0;
    let airTimeActive = false;
    let airTimeDisplay = null;
    let airTimeDisplayTimer = 0;

    // ── Init ──
    function init() {
        const canvas = document.getElementById('game-canvas');

        // Renderer
        renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: false,
            powerPreference: 'low-power'
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.setClearColor(0x87CEEB);
        renderer.toneMapping = THREE.NoToneMapping;

        // Scene + Camera
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            400
        );

        // World
        World.init(scene, difficulty);

        // Buggy
        Buggy.init(scene, camera, World.getTerrainHeight);

        // AI Buggy
        AIBuggy.init(scene, World.getTerrainHeight, difficulty);

        // Input
        Input.init();

        // UI
        UI.init({
            onStart: startGame,
            onRestart: restartGame,
            onMuteToggle: toggleMute,
            onDifficultySelect: setDifficulty
        });
        UI.showStart();
        UI.setMuteIcon(GameAudio.isMuted());

        // Gem flash effect
        gemFlash = document.createElement('div');
        gemFlash.id = 'gem-flash';
        gemFlash.style.cssText =
            'position:absolute;top:0;left:0;width:100%;height:100%;' +
            'background:rgba(0,255,255,0.15);pointer-events:none;' +
            'opacity:0;transition:opacity 0.1s ease-out;z-index:5;';
        document.getElementById('game-container').appendChild(gemFlash);

        // Resize
        window.addEventListener('resize', onResize);

        // Loop
        requestAnimationFrame(loop);
    }

    function onResize() {
        if (!camera || !renderer) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function setDifficulty(diff) {
        difficulty = diff;
        UI.setDifficultyLabel(diff);
    }

    // ── State Transitions ──
    function startGame() {
        if (state !== STATES.MENU) return;
        state = STATES.PLAYING;
        timeRemaining = 60;
        timerActive = true;
        UI.setTimer(Math.ceil(timeRemaining));
        UI.showPlaying();
        GameAudio.startEngine();
    }

    function restartGame() {
        if (state !== STATES.GAME_OVER) return;
        state = STATES.MENU;
        timeRemaining = 60;
        timerActive = false;
        aiScore = 0;
        playerScore = 0;
        UI.setTimer(Math.ceil(timeRemaining));
        World.reset(difficulty);
        Buggy.reset(World.getTerrainHeight);
        AIBuggy.reset(World.getTerrainHeight, difficulty);
        Input.resetInteraction();
        UI.showStart();
        UI.setScore(0);
        UI.setAIScore(0);
    }

    function endGame() {
        if (state === STATES.GAME_OVER) return;
        state = STATES.GAME_OVER;
        timerActive = false;
        GameAudio.stopEngine();
        playerScore = World.getPlayerCollectedCount();
        aiScore = World.getAICollectedCount();
        
        let result = '';
        if (playerScore > aiScore) {
            result = 'win';
            GameAudio.playWin();
        } else if (aiScore > playerScore) {
            result = 'lose';
            GameAudio.playLose();
        } else {
            result = 'tie';
        }
        
        UI.showCompetitiveResult(result, playerScore, aiScore);
    }

    function toggleMute() {
        GameAudio.setMute(!GameAudio.isMuted());
        UI.setMuteIcon(GameAudio.isMuted());
    }

    // ── Game Loop ──
    function loop() {
        requestAnimationFrame(loop);

        let dt = Math.min(clock.getDelta(), 0.05); // cap delta
        let time = clock.getElapsedTime();

        // Update world (gem spin, zombies, lava)
        World.update(time, dt);

        if (state === STATES.PLAYING) {
            // Timer countdown
            if (timerActive) {
                timeRemaining -= dt;
                UI.setTimer(Math.ceil(timeRemaining));
                if (timeRemaining <= 0) {
                    timeRemaining = 0;
                    endGame();
                    return;
                }
            }

            // Check if all gems collected (early end)
            if (World.getCollectedCount() >= World.getTotalGems()) {
                endGame();
                return;
            }

            // Player Input
            let throttle = Input.getThrottle();
            let steering = Input.getSteering();
            let braking = Input.isBraking();

            // Player Buggy physics
            let speedRatio = Buggy.update(dt, World.getTerrainHeight, throttle, steering, braking, World.getObstacleData(), World.getRampHeight);
            GameAudio.updateEngine(Math.abs(speedRatio));

            // Air time detection
            let buggyPos = Buggy.getPosition();
            let groundY = World.getTerrainHeight(buggyPos.x, buggyPos.z);
            let isAirborne = buggyPos.y > groundY + 1.5;
            if (isAirborne) {
                airTime += dt;
                airTimeActive = true;
            } else {
                if (airTimeActive && airTime > 0.3) {
                    UI.showAirTime(Math.round(airTime * 10) / 10);
                    airTimeDisplayTimer = 1.5;
                }
                airTime = 0;
                airTimeActive = false;
            }
            if (airTimeDisplayTimer > 0) {
                airTimeDisplayTimer -= dt;
                if (airTimeDisplayTimer <= 0) UI.hideAirTime();
            }

            // Player hazard collisions
            if (!Buggy.isSpinning()) {
                let hazard = World.checkHazardCollisions(Buggy.getPosition(), false);
                if (hazard) {
                    Buggy.triggerSpin();
                    if (hazard.type === 'bomb') {
                        triggerBombFlash();
                        GameAudio.playBomb();
                    }
                    if (hazard.type === 'zombie') {
                        GameAudio.playZombie();
                    }
                }
            }

            // Player gem collection
            if (!Buggy.isSpinning()) {
                let collected = World.checkGemCollection(Buggy.getPosition(), false);
                if (collected !== -1) {
                    GameAudio.playCollect();
                    UI.setScore(World.getPlayerCollectedCount());
                    triggerGemFlash();
                }
            }

            // AI Buggy update (pass null obstacle data so AI drives through trees/rocks)
            let aiSpeed = AIBuggy.update(dt, World.getTerrainHeight, null);
            
            // AI hazard collisions
            if (!AIBuggy.isSpinning()) {
                let aiHazard = World.checkHazardCollisions(AIBuggy.getPosition(), true);
                if (aiHazard) {
                    AIBuggy.triggerSpin();
                }
            }

            // AI gem collection
            if (!AIBuggy.isSpinning()) {
                let aiCollected = World.checkGemCollection(AIBuggy.getPosition(), true);
                if (aiCollected !== -1) {
                    UI.setAIScore(World.getAICollectedCount());
                }
            }

        } else if (state === STATES.MENU) {
            // Auto-start on first interaction (disabled when difficulty selector shown)
            if (Input.hasInteracted() && !UI.isDifficultyScreenVisible()) {
                startGame();
            }
        }

        // Render
        renderer.render(scene, camera);
    }

    function triggerGemFlash() {
        gemFlash.style.opacity = '1';
        setTimeout(() => {
            gemFlash.style.opacity = '0';
        }, 100);
    }

    function triggerBombFlash() {
        gemFlash.style.background = 'rgba(255,0,0,0.3)';
        gemFlash.style.opacity = '1';
        setTimeout(() => {
            gemFlash.style.opacity = '0';
            gemFlash.style.background = 'rgba(0,255,255,0.15)';
        }, 200);
    }

    // ── Boot ──
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
