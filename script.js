// Game State
let gameState = {
    board: Array(9).fill(''),
    currentPlayer: 'X',
    gameMode: 'player',
    gameActive: true,
    user: null,
    isGuest: true,
    player1Name: 'Player 1',
    player2Name: 'Player 2',
    moveHistory: [],
    stats: { wins: 0, draws: 0, losses: 0 },
    games: []
};

// EmailJS Configuration
const EMAILJS_CONFIG = {
    serviceId: 'service_ww7vtcm', // Replace with your EmailJS service ID
    templateId: 'template_f2lfego', // Replace with your EmailJS template ID
    publicKey: 'm9PQkiFvTy8n3N7aV' // Replace with your EmailJS public key
};


const BACKEND_API = {
    saveGameUrl: 'http://localhost:5000/api/save-game',
    fetchGameHistoryUrl: 'http://localhost:5000/api/game-history'
};


// MongoDB Configuration (using MongoDB Atlas Data API)
const MONGODB_CONFIG = {
    apiUrl: 'https://data.mongodb-api.com/app/your-app-id/endpoint/data/v1', // Replace with your MongoDB Data API URL
    apiKey: 'your-api-key', // Replace with your MongoDB API key
    database: 'tic_tac_toe',
    collection: 'game_history'
};

// Initialize EmailJS
emailjs.init(EMAILJS_CONFIG.publicKey);

// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupNavigation();
    loadLocalData();
});

function initializeApp() {
    showSection('auth');
    updateCurrentPlayerDisplay();
}

// Navigation Functions
function setupNavigation() {
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');

    navToggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        navToggle.classList.toggle('active');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) {
            navMenu.classList.remove('active');
            navToggle.classList.remove('active');
        }
    });
}

function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });

    // Show selected section
    const targetSection = document.getElementById(sectionName + 'Section');
    if (targetSection) {
        targetSection.classList.add('active');
    }

    // Close mobile menu
    document.getElementById('navMenu').classList.remove('active');
    document.getElementById('navToggle').classList.remove('active');

    // Load section-specific data
    if (sectionName === 'history') {
        loadGameHistory();
    } else if (sectionName === 'profile') {
        updateProfileStats();
    }
}

// Authentication Functions
async function signInWithEmail() {
    const email = document.getElementById('email').value.trim();
    const name = document.getElementById('name').value.trim();

    if (!email || !name) {
        alert('Please fill in all fields.');
        return;
    }

    if (!isValidEmail(email)) {
        alert('Please enter a valid email address.');
        return;
    }

    try {
        // Send welcome email using EmailJS
        const templateParams = {
            to_email: email,
            to_name: name,
            message: `Welcome to Tic-Tac-Toe Master! Your account has been created successfully.`
        };

        await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, templateParams);
        
        // Set user data
        gameState.user = { email, name };
        gameState.isGuest = false;
        
        // Update UI
        document.getElementById('currentUser').textContent = name;
        document.getElementById('logoutBtn').style.display = 'block';
        
        // Clear form
        document.getElementById('email').value = '';
        document.getElementById('name').value = '';
        
        // Load user data and show game
        await loadUserData();
        showSection('game');
        
        alert('Welcome! A confirmation email has been sent to your address.');
    } catch (error) {
        console.error('Sign in failed:', error);
        alert('Sign in failed. Please try again.');
    }
}

function playAsGuest() {
    gameState.isGuest = true;
    gameState.user = null;
    document.getElementById('currentUser').textContent = 'Guest';
    document.getElementById('logoutBtn').style.display = 'none';
    loadLocalData();
    showSection('game');
}

function logout() {
    gameState.user = null;
    gameState.isGuest = true;
    gameState.stats = { wins: 0, draws: 0, losses: 0 };
    gameState.games = [];
    
    document.getElementById('logoutBtn').style.display = 'none';
    resetGame();
    showSection('auth');
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Data Management Functions
function loadLocalData() {
    const savedStats = localStorage.getItem('ttt_guest_stats');
    const savedGames = localStorage.getItem('ttt_guest_games');
    
    if (savedStats) {
        gameState.stats = JSON.parse(savedStats);
    }
    if (savedGames) {
        gameState.games = JSON.parse(savedGames);
    }
    
    updateStatsDisplay();
}

function saveGameToDB(gameData) {
    fetch(BACKEND_API.saveGameUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(gameData)
    })
    .then(res => res.json())
    .then(data => {
        console.log('✅ Game saved to DB:', data);
    })
    .catch(error => {
        console.error('❌ Failed to save game:', error);
    });
}


async function loadUserData() {
    if (gameState.isGuest) {
        loadLocalData();
        return;
    }

    try {
        // Load user data from MongoDB
        const userData = await fetchUserDataFromMongoDB();
        if (userData) {
            gameState.stats = userData.stats || { wins: 0, draws: 0, losses: 0 };
            gameState.games = userData.games || [];
        }
        updateStatsDisplay();
    } catch (error) {
        console.error('Error loading user data:', error);
        loadLocalData(); // Fallback to local storage
    }
}

async function saveUserData() {
    if (gameState.isGuest) {
        localStorage.setItem('ttt_guest_stats', JSON.stringify(gameState.stats));
        localStorage.setItem('ttt_guest_games', JSON.stringify(gameState.games));
        return;
    }

    try {
        await saveUserDataToMongoDB();
    } catch (error) {
        console.error('Error saving to MongoDB:', error);
        // Fallback to local storage
        localStorage.setItem('ttt_user_' + gameState.user.email, JSON.stringify({
            stats: gameState.stats,
            games: gameState.games
        }));
    }
}

// MongoDB Functions
async function fetchUserDataFromMongoDB() {
    if (!gameState.user) return null;

    try {
        const response = await fetch(`${MONGODB_CONFIG.apiUrl}/action/findOne`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': MONGODB_CONFIG.apiKey
            },
            body: JSON.stringify({
                dataSource: 'Cluster0',
                database: MONGODB_CONFIG.database,
                collection: 'users',
                filter: { email: gameState.user.email }
            })
        });

        const result = await response.json();
        return result.document;
    } catch (error) {
        console.error('MongoDB fetch error:', error);
        return null;
    }
}

async function saveUserDataToMongoDB() {
    if (!gameState.user) return;

    const userData = {
        email: gameState.user.email,
        name: gameState.user.name,
        stats: gameState.stats,
        games: gameState.games,
        lastUpdated: new Date().toISOString()
    };

    try {
        const response = await fetch(`${MONGODB_CONFIG.apiUrl}/action/replaceOne`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': MONGODB_CONFIG.apiKey
            },
            body: JSON.stringify({
                dataSource: 'Cluster0',
                database: MONGODB_CONFIG.database,
                collection: 'users',
                filter: { email: gameState.user.email },
                replacement: userData,
                upsert: true
            })
        });

        const result = await response.json();
        console.log('Data saved to MongoDB:', result);
    } catch (error) {
        console.error('MongoDB save error:', error);
        throw error;
    }
}

async function loadGameHistory() {
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = '<div class="loading">Loading history...</div>';

    try {
        if (!gameState.isGuest && gameState.user) {
            await loadUserData();
        }

        if (gameState.games.length === 0) {
            historyList.innerHTML = '<p class="text-center">No games played yet. Start playing to see your history!</p>';
            return;
        }

        const historyHTML = gameState.games.slice(0, 20).map(game => {
            const date = new Date(game.date).toLocaleDateString();
            const time = new Date(game.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const resultClass = game.result;
            const resultText = game.result === 'win' ? '🏆 Won' : 
                             game.result === 'lose' ? '😔 Lost' : '🤝 Draw';
            const modeText = game.mode === 'computer' ? '🤖 vs Computer' : '👫 vs Player';
            
            return `
                <div class="history-item">
                    <div>
                        <div class="game-result ${resultClass}">${resultText}</div>
                        <div style="font-size: 0.9rem; color: #718096; margin-top: 0.25rem;">
                            ${modeText} • ${game.player1Name} vs ${game.player2Name}
                        </div>
                    </div>
                    <div style="text-align: right; font-size: 0.9rem; color: #718096;">
                        <div>${date}</div>
                        <div>${time}</div>
                    </div>
                </div>
            `;
        }).join('');
        
        historyList.innerHTML = historyHTML;
    } catch (error) {
        console.error('Error loading history:', error);
        historyList.innerHTML = '<p class="text-center">Error loading history. Please try again.</p>';
    }
}

// Player Setup Functions
function updatePlayerNames() {
    const player1Input = document.getElementById('player1Name').value.trim();
    const player2Input = document.getElementById('player2Name').value.trim();
    
    gameState.player1Name = player1Input || 'Player 1';
    gameState.player2Name = player2Input || 'Player 2';
    
    updateCurrentPlayerDisplay();
}

// Game Mode Functions
function setGameMode(mode) {
    gameState.gameMode = mode;
    
    // Update UI
    document.getElementById('playerMode').classList.toggle('active', mode === 'player');
    document.getElementById('computerMode').classList.toggle('active', mode === 'computer');
    
    // Update player 2 input based on mode
    const player2Input = document.getElementById('player2Name');
    if (mode === 'computer') {
        player2Input.value = 'Computer';
        player2Input.disabled = true;
        gameState.player2Name = 'Computer';
    } else {
        player2Input.disabled = false;
        if (player2Input.value === 'Computer') {
            player2Input.value = '';
            gameState.player2Name = 'Player 2';
        }
    }
    
    resetGame();
}

// Game Logic Functions
function makeMove(index) {
    if (!gameState.gameActive || gameState.board[index] !== '') {
        return;
    }

    // Save move to history for undo
    gameState.moveHistory.push({
        board: [...gameState.board],
        currentPlayer: gameState.currentPlayer
    });

    // Make human move
    gameState.board[index] = gameState.currentPlayer;
    updateCell(index);

    if (checkWinner()) {
        endGame();
        return;
    }

    if (gameState.gameMode === 'player') {
        // Switch players in two-player mode
        gameState.currentPlayer = gameState.currentPlayer === 'X' ? 'O' : 'X';
        updateCurrentPlayerDisplay();
    } else {
        // Computer mode
        if (gameState.currentPlayer === 'X') {
            gameState.currentPlayer = 'O';
            updateCurrentPlayerDisplay();
            
            // Computer makes move after short delay
            setTimeout(() => {
                makeComputerMove();
            }, 800);
        }
    }
}

function makeComputerMove() {
    if (!gameState.gameActive) return;

    let move = findBestMove();
    
    if (move !== -1) {
        // Save move to history
        gameState.moveHistory.push({
            board: [...gameState.board],
            currentPlayer: gameState.currentPlayer
        });

        gameState.board[move] = 'O';
        updateCell(move);

        if (checkWinner()) {
            endGame();
            return;
        }

        gameState.currentPlayer = 'X';
        updateCurrentPlayerDisplay();
    }
}

function findBestMove() {
    // Simple AI strategy
    const availableMoves = [];
    for (let i = 0; i < 9; i++) {
        if (gameState.board[i] === '') {
            availableMoves.push(i);
        }
    }

    if (availableMoves.length === 0) return -1;

    // Try to win
    for (let i = 0; i < 9; i++) {
        if (gameState.board[i] === '') {
            gameState.board[i] = 'O';
            if (checkWinCondition('O')) {
                gameState.board[i] = '';
                return i;
            }
            gameState.board[i] = '';
        }
    }

    // Try to block player
    for (let i = 0; i < 9; i++) {
        if (gameState.board[i] === '') {
            gameState.board[i] = 'X';
            if (checkWinCondition('X')) {
                gameState.board[i] = '';
                return i;
            }
            gameState.board[i] = '';
        }
    }

    // Take center if available
    if (gameState.board[4] === '') {
        return 4;
    }

    // Take corners
    const corners = [0, 2, 6, 8];
    const availableCorners = corners.filter(corner => gameState.board[corner] === '');
    if (availableCorners.length > 0) {
        return availableCorners[Math.floor(Math.random() * availableCorners.length)];
    }

    // Take any available move
    return availableMoves[Math.floor(Math.random() * availableMoves.length)];
}

function checkWinner() {
    const winner = checkWinCondition('X') || checkWinCondition('O');
    if (winner) {
        return winner;
    }

    // Check for draw
    if (gameState.board.every(cell => cell !== '')) {
        return 'draw';
    }

    return false;
}

function checkWinCondition(player) {
    const winPatterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
        [0, 4, 8], [2, 4, 6] // diagonals
    ];

    for (let pattern of winPatterns) {
        if (pattern.every(index => gameState.board[index] === player)) {
            // Highlight winning cells
            pattern.forEach(index => {
                const cell = document.querySelector(`[data-index="${index}"]`);
                cell.classList.add('winning');
            });
            return player;
        }
    }
    return false;
}

function updateCell(index) {
    const cell = document.querySelector(`[data-index="${index}"]`);
    const symbol = gameState.board[index];
    
    cell.textContent = symbol === 'X' ? '❌' : '⭕';
    cell.classList.add(symbol.toLowerCase());
    cell.classList.add('taken');
    cell.classList.add('pulse');
    
    // Remove animation class after animation completes
    setTimeout(() => {
        cell.classList.remove('pulse');
    }, 600);
}

function updateCurrentPlayerDisplay() {
    const currentPlayerName = gameState.currentPlayer === 'X' ? gameState.player1Name : gameState.player2Name;
    const symbol = gameState.currentPlayer === 'X' ? '❌' : '⭕';
    document.getElementById('currentPlayerDisplay').textContent = `Current Player: ${symbol} ${currentPlayerName}`;
}

function endGame() {
    gameState.gameActive = false;
    const winner = checkWinner();
    
    if (winner === 'draw') {
        showWinnerModal('🤝 It\'s a Draw!', 'Great game! Try again for a decisive victory.');
        gameState.stats.draws++;
        saveGameToHistory('draw', null);
    } else {
        const winnerName = winner === 'X' ? gameState.player1Name : gameState.player2Name;
        const winnerSymbol = winner === 'X' ? '❌' : '⭕';
        
        showWinnerModal(`🎉 ${winnerSymbol} ${winnerName} Wins!`, 'Congratulations on your amazing victory!');
        showFlowerCelebration();
        
        // Update stats based on game mode
        if (gameState.gameMode === 'computer') {
            if (winner === 'X') {
                gameState.stats.wins++;
                saveGameToHistory('win', gameState.player1Name);
            } else {
                gameState.stats.losses++;
                saveGameToHistory('lose', gameState.player2Name);
            }
        } else {
            // In player vs player, track stats for player 1
            if (winner === 'X') {
                gameState.stats.wins++;
                saveGameToHistory('win', gameState.player1Name);
            } else {
                gameState.stats.losses++;
                saveGameToHistory('lose', gameState.player2Name);
            }
        }
    }
    
    updateStatsDisplay();
    saveUserData();
}

function showWinnerModal(title, subtitle) {
    document.getElementById('winnerText').textContent = title;
    document.getElementById('winnerSubtext').textContent = subtitle;
    document.getElementById('winnerModal').classList.add('show');
}

function closeWinnerModal() {
    document.getElementById('winnerModal').classList.remove('show');
    resetGame();
}

function showFlowerCelebration() {
    const overlay = document.getElementById('flowerOverlay');
    overlay.innerHTML = '';
    
    const flowers = ['🌸', '🌺', '🌻', '🌷', '🌹', '💐', '🌼', '🏵️'];
    
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const flower = document.createElement('div');
            flower.className = 'flower';
            flower.textContent = flowers[Math.floor(Math.random() * flowers.length)];
            flower.style.left = Math.random() * 100 + 'vw';
            flower.style.animationDelay = Math.random() * 0.5 + 's';
            flower.style.fontSize = (1.5 + Math.random()) + 'rem';
            overlay.appendChild(flower);
            
            // Remove flower after animation
            setTimeout(() => {
                if (flower.parentNode) {
                    flower.parentNode.removeChild(flower);
                }
            }, 5000);
        }, i * 100);
    }
}

function saveGameToHistory(result, winner) {
    const gameData = {
        date: new Date().toISOString(),
        mode: gameState.gameMode,
        result: result,
        winner: winner,
        player1Name: gameState.player1Name,
        player2Name: gameState.player2Name,
        board: [...gameState.board]
    };

    gameState.games.unshift(gameData); // Add to beginning
    
    // Keep only last 100 games
    if (gameState.games.length > 100) {
        gameState.games = gameState.games.slice(0, 100);
    }
}

function resetGame() {
    gameState.board = Array(9).fill('');
    gameState.currentPlayer = 'X';
    gameState.gameActive = true;
    gameState.moveHistory = [];
    
    // Clear board
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.textContent = '';
        cell.className = 'cell';
    });
    
    // Clear message
    document.getElementById('gameMessage').innerHTML = '';
    
    updateCurrentPlayerDisplay();
}

function undoMove() {
    if (gameState.moveHistory.length === 0) return;
    
    const lastState = gameState.moveHistory.pop();
    gameState.board = [...lastState.board];
    gameState.currentPlayer = lastState.currentPlayer;
    gameState.gameActive = true;
    
    // Update board display
    const cells = document.querySelectorAll('.cell');
    cells.forEach((cell, index) => {
        cell.textContent = gameState.board[index] === 'X' ? '❌' : gameState.board[index] === 'O' ? '⭕' : '';
        cell.className = 'cell';
        if (gameState.board[index] !== '') {
            cell.classList.add(gameState.board[index].toLowerCase());
            cell.classList.add('taken');
        }
    });
    
    updateCurrentPlayerDisplay();
}

function updateStatsDisplay() {
    document.getElementById('wins').textContent = gameState.stats.wins;
    document.getElementById('draws').textContent = gameState.stats.draws;
    document.getElementById('losses').textContent = gameState.stats.losses;
}

function updateProfileStats() {
    if (gameState.user) {
        document.getElementById('profileName').textContent = gameState.user.name;
        document.getElementById('profileEmail').textContent = gameState.user.email;
    } else {
        document.getElementById('profileName').textContent = 'Guest Player';
        document.getElementById('profileEmail').textContent = 'guest@example.com';
    }

    const totalGames = gameState.stats.wins + gameState.stats.draws + gameState.stats.losses;
    const winRate = totalGames > 0 ? Math.round((gameState.stats.wins / totalGames) * 100) : 0;
    
    // Calculate best winning streak
    let currentStreak = 0;
    let bestStreak = 0;
    
    gameState.games.forEach(game => {
        if (game.result === 'win') {
            currentStreak++;
            bestStreak = Math.max(bestStreak, currentStreak);
        } else {
            currentStreak = 0;
        }
    });

    document.getElementById('totalGames').textContent = totalGames;
    document.getElementById('winRate').textContent = winRate + '%';
    document.getElementById('bestStreak').textContent = bestStreak;
}

async function clearHistory() {
    if (confirm('Are you sure you want to clear all game history? This action cannot be undone.')) {
        gameState.games = [];
        gameState.stats = { wins: 0, draws: 0, losses: 0 };
        
        updateStatsDisplay();
        await saveUserData();
        
        const historyList = document.getElementById('historyList');
        historyList.innerHTML = '<p class="text-center">History cleared successfully!</p>';
        
        setTimeout(() => {
            loadGameHistory();
        }, 1000);
    }
}

// Keyboard Support
document.addEventListener('keydown', function(e) {
    if (e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key) - 1;
        makeMove(index);
    } else if (e.key === 'r' || e.key === 'R') {
        resetGame();
    } else if (e.key === 'u' || e.key === 'U') {
        undoMove();
    }
});

// Close modal when clicking outside
document.getElementById('winnerModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeWinnerModal();
    }
});

