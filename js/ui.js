/**
 * ui.js — DOM overlay management
 */

const UI = (function () {
    // ── Elements ──
    const startScreen = document.getElementById('start-screen');
    const hud = document.getElementById('hud');
    const winScreen = document.getElementById('win-screen');
    const loseScreen = document.getElementById('lose-screen');
    const scoreEl = document.getElementById('score');
    const timerEl = document.getElementById('timer');
    const muteBtn = document.getElementById('mute-btn');
    const playAgainBtn = document.getElementById('play-again-btn');
    const playAgainBtnLose = document.getElementById('play-again-btn-lose');
    const touchControls = document.getElementById('touch-controls');

    // ── State ──
    let onStart = null;
    let onRestart = null;
    let onMuteToggle = null;
    let onDifficultySelect = null;
    let difficultySelected = false;

    // ── Helpers ──
    function show(el) { el.classList.remove('hidden'); }
    function hide(el) { el.classList.add('hidden'); }

    function setScore(value) {
        if (scoreEl) scoreEl.textContent = String(value);
    }

    function setAIScore(value) {
        const aiScoreEl = document.getElementById('ai-score');
        if (aiScoreEl) aiScoreEl.textContent = String(value);
    }

    function setTimer(value) {
        if (!timerEl) return;
        timerEl.textContent = String(value);
        if (value <= 10) {
            timerEl.classList.add('timer-low');
        } else {
            timerEl.classList.remove('timer-low');
        }
    }

    function setMuteIcon(muted) {
        if (muteBtn) muteBtn.textContent = muted ? '🔇' : '🔊';
    }

    function setDifficultyLabel(diff) {
        const label = document.getElementById('difficulty-label');
        if (label) label.textContent = diff === 'hard' ? 'Hard Mode' : 'Easy Mode';
    }

    function showAirTime(seconds) {
        let el = document.getElementById('air-time');
        if (!el) {
            el = document.createElement('div');
            el.id = 'air-time';
            el.className = 'air-time';
            document.getElementById('game-container').appendChild(el);
        }
        el.textContent = `AIR TIME! ${seconds.toFixed(1)}s`;
        el.classList.remove('hidden');
    }

    function hideAirTime() {
        const el = document.getElementById('air-time');
        if (el) el.classList.add('hidden');
    }

    function isDifficultyScreenVisible() {
        const diffScreen = document.getElementById('difficulty-screen');
        return diffScreen && !diffScreen.classList.contains('hidden');
    }

    // ── Screens ──
    function showStart() {
        show(startScreen);
        hide(hud);
        hide(winScreen);
        hide(loseScreen);
        hide(touchControls);
        difficultySelected = false;
        showDifficultySelector();
    }

    function showDifficultySelector() {
        let diffScreen = document.getElementById('difficulty-screen');
        if (!diffScreen) {
            diffScreen = document.createElement('div');
            diffScreen.id = 'difficulty-screen';
            diffScreen.className = 'screen overlay';
            diffScreen.innerHTML = `
                <h2>Choose Difficulty</h2>
                <div class="difficulty-buttons">
                    <button id="diff-easy" class="action-btn diff-btn">🟢 Easy</button>
                    <button id="diff-hard" class="action-btn diff-btn">🔴 Hard</button>
                </div>
            `;
            document.getElementById('game-container').appendChild(diffScreen);

            document.getElementById('diff-easy').addEventListener('click', () => {
                selectDifficulty('easy');
            });
            document.getElementById('diff-hard').addEventListener('click', () => {
                selectDifficulty('hard');
            });
        }
        show(diffScreen);
    }

    function selectDifficulty(diff) {
        difficultySelected = true;
        if (onDifficultySelect) onDifficultySelect(diff);
        const diffScreen = document.getElementById('difficulty-screen');
        if (diffScreen) hide(diffScreen);
    }

    function showPlaying() {
        hide(startScreen);
        const diffScreen = document.getElementById('difficulty-screen');
        if (diffScreen) hide(diffScreen);
        show(hud);
        hide(winScreen);
        hide(loseScreen);
        show(touchControls);
    }

    function showWin() {
        hide(startScreen);
        hide(hud);
        show(winScreen);
        hide(loseScreen);
        hide(touchControls);
    }

    function showLose() {
        hide(startScreen);
        hide(hud);
        hide(winScreen);
        show(loseScreen);
        hide(touchControls);
    }

    function showCompetitiveResult(result, playerScore, aiScore) {
        hide(startScreen);
        hide(hud);
        hide(winScreen);
        hide(loseScreen);
        hide(touchControls);

        let resultScreen = document.getElementById('result-screen');
        if (!resultScreen) {
            resultScreen = document.createElement('div');
            resultScreen.id = 'result-screen';
            resultScreen.className = 'screen overlay';
            document.getElementById('game-container').appendChild(resultScreen);
        }

        let title, message, emoji;
        if (result === 'win') {
            title = 'You Won! 🏆';
            message = `You collected ${playerScore} gems vs AI's ${aiScore}!`;
            emoji = '🎉 Great driving! 🎉';
        } else if (result === 'lose') {
            title = 'You Lost!';
            message = `AI collected ${aiScore} gems vs your ${playerScore}!`;
            emoji = '💪 Try again! 💪';
        } else {
            title = "It's a Tie!";
            message = `You both collected ${playerScore} gems!`;
            emoji = '🤝 Well matched! 🤝';
        }

        resultScreen.innerHTML = `
            <h2>${title}</h2>
            <p class="result-score">${message}</p>
            <p class="celebration">${emoji}</p>
            <button id="play-again-result" class="action-btn">Play Again</button>
        `;

        document.getElementById('play-again-result').addEventListener('click', function () {
            hide(resultScreen);
            if (onRestart) onRestart();
        });

        show(resultScreen);
    }

    // ── Event Wiring ──
    function init(callbacks) {
        onStart = callbacks.onStart;
        onRestart = callbacks.onRestart;
        onMuteToggle = callbacks.onMuteToggle;
        onDifficultySelect = callbacks.onDifficultySelect;

        // Mute button
        if (muteBtn) {
            muteBtn.addEventListener('click', function () {
                if (onMuteToggle) onMuteToggle();
            });
        }

        // Play again (win)
        if (playAgainBtn) {
            playAgainBtn.addEventListener('click', function () {
                if (onRestart) onRestart();
            });
        }

        // Play again (lose)
        if (playAgainBtnLose) {
            playAgainBtnLose.addEventListener('click', function () {
                if (onRestart) onRestart();
            });
        }
    }

    return {
        init,
        showStart,
        showPlaying,
        showWin,
        showLose,
        showCompetitiveResult,
        showAirTime,
        hideAirTime,
        setScore,
        setAIScore,
        setTimer,
        setMuteIcon,
        setDifficultyLabel,
        isDifficultyScreenVisible
    };
})();
