// Games Module

(function() {
    'use strict';

    let currentGame = null;
    let gameState = {};
    let recordingStartTime = null;
    let recordingInterval = null;
    let mediaRecorder = null;
    let audioChunks = [];

    // Rock Paper Scissors game
    const RPS_OPTIONS = ['taş', 'kağıt', 'makas'];
    const RPS_EMOJIS = { taş: '🪨', kağıt: '📄', makas: '✂️' };
    const RPS_RULES = {
        taş: { beats: 'makas', losesTo: 'kağıt' },
        kağıt: { beats: 'taş', losesTo: 'makas' },
        makas: { beats: 'kağıt', losesTo: 'taş' }
    };

    // Dice game
    const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

    // Initialize games
    function initGames() {
        const gameBtn = document.getElementById('gameBtn');
        const gameModal = document.getElementById('gameModal');
        const closeGameBtn = document.getElementById('closeGameBtn');
        const gameSelection = document.getElementById('gameSelection');
        const gameArea = document.getElementById('gameArea');

        if (gameBtn) {
            gameBtn.addEventListener('click', () => {
                gameModal.style.display = 'flex';
                resetGame();
            });
        }

        if (closeGameBtn) {
            closeGameBtn.addEventListener('click', () => {
                gameModal.style.display = 'none';
                resetGame();
            });
        }

        if (gameSelection) {
            gameSelection.addEventListener('click', (e) => {
                const gameBtn = e.target.closest('.game-btn');
                if (gameBtn) {
                    const gameType = gameBtn.dataset.game;
                    startGame(gameType);
                }
            });
        }

        // Close modal when clicking outside
        gameModal.addEventListener('click', (e) => {
            if (e.target === gameModal) {
                gameModal.style.display = 'none';
                resetGame();
            }
        });
    }

    // Start a game
    function startGame(gameType) {
        const gameSelection = document.getElementById('gameSelection');
        const gameArea = document.getElementById('gameArea');
        const gameTitle = document.getElementById('gameTitle');

        currentGame = gameType;
        gameState = {};

        if (gameSelection) gameSelection.style.display = 'none';
        if (gameArea) gameArea.style.display = 'block';

        if (gameType === 'rock-paper-scissors') {
            if (gameTitle) gameTitle.textContent = 'Taş-Kağıt-Makas';
            renderRPSGame();
        } else if (gameType === 'dice') {
            if (gameTitle) gameTitle.textContent = 'Zar Atma';
            renderDiceGame();
        }
    }

    // Reset game
    function resetGame() {
        currentGame = null;
        gameState = {};
        const gameSelection = document.getElementById('gameSelection');
        const gameArea = document.getElementById('gameArea');
        
        if (gameSelection) gameSelection.style.display = 'flex';
        if (gameArea) {
            gameArea.style.display = 'none';
            gameArea.innerHTML = '';
        }
    }

    // Render Rock Paper Scissors game
    function renderRPSGame() {
        const gameArea = document.getElementById('gameArea');
        if (!gameArea) return;

        gameArea.innerHTML = `
            <div style="margin-bottom:15px;">
                <p style="color:var(--fg-sub); margin-bottom:10px;">Seçiminizi yapın:</p>
                <div style="display:flex; gap:10px; justify-content:center;">
                    <button class="game-option-btn" data-choice="taş" style="padding:15px 25px; font-size:20px;">🪨 Taş</button>
                    <button class="game-option-btn" data-choice="kağıt" style="padding:15px 25px; font-size:20px;">📄 Kağıt</button>
                    <button class="game-option-btn" data-choice="makas" style="padding:15px 25px; font-size:20px;">✂️ Makas</button>
                </div>
            </div>
            <div id="rpsResult" style="margin-top:15px; min-height:40px;"></div>
            <button id="playAgainBtn" class="game-btn" style="margin-top:15px; display:none;">Tekrar Oyna</button>
        `;

        // Add event listeners
        gameArea.querySelectorAll('.game-option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const choice = btn.dataset.choice;
                playRPS(choice);
            });
        });

        document.getElementById('playAgainBtn').addEventListener('click', () => {
            renderRPSGame();
        });
    }

    // Play Rock Paper Scissors
    function playRPS(userChoice) {
        const computerChoice = RPS_OPTIONS[Math.floor(Math.random() * RPS_OPTIONS.length)];
        const result = determineRPSWinner(userChoice, computerChoice);

        const resultEl = document.getElementById('rpsResult');
        const playAgainBtn = document.getElementById('playAgainBtn');

        if (resultEl) {
            resultEl.innerHTML = `
                <div style="text-align:center;">
                    <p><strong>Sen:</strong> ${RPS_EMOJIS[userChoice]} ${userChoice}</p>
                    <p><strong>Bilgisayar:</strong> ${RPS_EMOJIS[computerChoice]} ${computerChoice}</p>
                    <p style="font-size:18px; font-weight:bold; color:var(--accent-yellow);">${result}</p>
                </div>
            `;
        }

        if (playAgainBtn) playAgainBtn.style.display = 'block';

        // Send result as message
        sendGameResult('Taş-Kağıt-Makas', `Sen: ${RPS_EMOJIS[userChoice]}, Bilgisayar: ${RPS_EMOJIS[computerChoice]} - ${result}`);
    }

    // Determine RPS winner
    function determineRPSWinner(user, computer) {
        if (user === computer) return 'Berabere! 🤝';
        if (RPS_RULES[user].beats === computer) return 'Kazandın! 🎉';
        return 'Kaybettin! 😢';
    }

    // Render Dice game
    function renderDiceGame() {
        const gameArea = document.getElementById('gameArea');
        if (!gameArea) return;

        gameArea.innerHTML = `
            <div style="text-align:center; margin-bottom:15px;">
                <p style="color:var(--fg-sub); margin-bottom:10px;">Zar atmak için tıklayın:</p>
                <button id="rollDiceBtn" class="game-btn" style="padding:20px 40px; font-size:24px;">🎲 Zar At</button>
                <div id="diceResult" style="margin-top:15px; min-height:40px;"></div>
            </div>
        `;

        document.getElementById('rollDiceBtn').addEventListener('click', () => {
            rollDice();
        });
    }

    // Roll dice
    function rollDice() {
        const dice1 = Math.floor(Math.random() * 6) + 1;
        const dice2 = Math.floor(Math.random() * 6) + 1;
        const total = dice1 + dice2;

        const resultEl = document.getElementById('diceResult');
        if (resultEl) {
            resultEl.innerHTML = `
                <div style="text-align:center;">
                    <p style="font-size:24px;">${DICE_FACES[dice1-1]} ${DICE_FACES[dice2-1]}</p>
                    <p style="font-size:18px; font-weight:bold;">Toplam: ${total}</p>
                </div>
            `;
        }

        // Send result as message
        sendGameResult('Zar Atma', `Zarlar: ${DICE_FACES[dice1-1]} ${DICE_FACES[dice2-1]} = ${total}`);
    }

    // Send game result as message
    function sendGameResult(gameName, resultText) {
        if (!AppConfig || !AppConfig.FB || !AppConfig.AppState.currentUser) {
            return;
        }

        const payload = {
            sender: AppConfig.AppState.currentUser,
            avatar: AppConfig.AppState.currentAvatar,
            text: `[${gameName}] ${resultText}`,
            timestamp: AppConfig.FB.serverTimestamp(),
            type: 'game'
        };

        AppConfig.FB.rawMessagesRef.push(payload);
    }

    // Render game result in message
    function renderGameResult(msg, container) {
        if (!msg || !msg.text || !container) return;

        const gameContainer = document.createElement('div');
        gameContainer.className = 'game-result';

        const match = msg.text.match(/\[([^\]]+)\]\s*(.+)/);
        if (match) {
            const gameName = match[1];
            const result = match[2];

            gameContainer.innerHTML = `
                <div class="game-label">${ChatUtils.escapeHTML(gameName)}</div>
                <div class="game-value">${ChatUtils.escapeHTML(result)}</div>
            `;
        } else {
            gameContainer.innerHTML = `
                <div class="game-label">Oyun</div>
                <div class="game-value">${ChatUtils.escapeHTML(msg.text)}</div>
            `;
        }

        container.appendChild(gameContainer);
    }

    // Initialize when DOM is ready
    function domReady() {
        return new Promise((resolve) => {
            if (document.readyState !== 'loading') {
                resolve();
            } else {
                document.addEventListener('DOMContentLoaded', resolve);
            }
        });
    }

    // Start
    domReady().then(() => {
        initGames();
    });

    // Export
    window.GameManager = {
        startGame,
        resetGame,
        renderRPSGame,
        playRPS,
        renderDiceGame,
        rollDice,
        sendGameResult,
        renderGameResult,
        initGames
    };
})();
