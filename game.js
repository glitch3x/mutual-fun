const BOARD_SIZE = 4;
let board = [];
let score = 0;

// Separate high scores
let bestScoreClassic = localStorage.getItem('mutualFunBestClassic') || 0;
let bestScoreTimeAttack = localStorage.getItem('mutualFunBestTime') || 0;

let won = false;
let over = false;
let hasKeptPlaying = false;

// Time attack mode
let isTimeAttack = false;
let timerValue = 60;
let timerInterval = null;

// The Funds
const FUNDS = [
    { name: 'ARGON', color: '#7ba0c0' }, // Blue
    { name: 'BOGLE', color: '#8fb193' }, // Green
    { name: 'SMAUG', color: '#c0898a' }, // Rose
    { name: 'MIDAS', color: '#c7b067' }, // Gold
    { name: 'VLADD', color: '#907bb0' }  // Lilac
];
let currentFund = null;

// Audio context
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playSound(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    
    if (type === 'slide') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'merge') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'win') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.setValueAtTime(600, now + 0.1);
        osc.frequency.setValueAtTime(800, now + 0.2);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    }
}

// Chair mappings based on the image
const TIER_MAP = {
    2: { name: "Folding Chair", color: "var(--t-2)", emoji: "🪑" },
    4: { name: "Office Chair", color: "var(--t-4)", emoji: "💺" },
    8: { name: "Wood Swivel", color: "var(--t-8)", emoji: "🪑" },
    16: { name: "Green Armchair", color: "var(--t-16)", emoji: "🛋️" },
    32: { name: "Red Armchair", color: "var(--t-32)", emoji: "🛋️" },
    64: { name: "Brown Leather", color: "var(--t-64)", emoji: "💺" },
    128: { name: "Wood Exec", color: "var(--t-128)", emoji: "🪑" },
    256: { name: "Bronze Throne", color: "var(--t-256)", emoji: "🪑" },
    512: { name: "Silver Throne", color: "var(--t-512)", emoji: "🪑" },
    1024: { name: "Gold Throne", color: "var(--t-1024)", emoji: "🪑" },
    2048: { name: "The Throne", color: "var(--t-2048)", emoji: "👑" },
};

document.addEventListener('DOMContentLoaded', () => {
    initGame();
    setupInputs();
    renderLegend();
    
    document.getElementById('restart-btn').addEventListener('click', () => { initAudio(); initGame(); });
    document.getElementById('retry-btn').addEventListener('click', () => { initAudio(); initGame(); });
    document.getElementById('keep-playing-btn').addEventListener('click', () => {
        initAudio();
        document.getElementById('game-message').style.display = 'none';
        hasKeptPlaying = true;
    });

    document.getElementById('dark-mode-btn').addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
    });

    document.getElementById('time-attack-btn').addEventListener('click', () => {
        isTimeAttack = !isTimeAttack;
        document.getElementById('timer-box').style.display = isTimeAttack ? 'block' : 'none';
        initGame();
    });

    // Virtual D-pad events
    document.getElementById('btn-up').addEventListener('click', () => { handleVirtualMove(0, -1); });
    document.getElementById('btn-down').addEventListener('click', () => { handleVirtualMove(0, 1); });
    document.getElementById('btn-left').addEventListener('click', () => { handleVirtualMove(-1, 0); });
    document.getElementById('btn-right').addEventListener('click', () => { handleVirtualMove(1, 0); });
});

function handleVirtualMove(dc, dr) {
    if(over || (won && !hasKeptPlaying)) return;
    move(dc, dr);
}

function initGame() {
    board = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(0));
    score = 0;
    won = false;
    over = false;
    hasKeptPlaying = false;
    
    // Assign random fund
    currentFund = FUNDS[Math.floor(Math.random() * FUNDS.length)];
    document.documentElement.style.setProperty('--fund-color', currentFund.color);
    document.getElementById('fund-name').textContent = `FUND: ${currentFund.name}`;
    
    updateScore();
    document.getElementById('best-score').textContent = isTimeAttack ? bestScoreTimeAttack : bestScoreClassic;
    document.getElementById('game-message').style.display = 'none';
    
    // Time attack reset
    if (timerInterval) clearInterval(timerInterval);
    if (isTimeAttack) {
        timerValue = 60;
        document.getElementById('timer').textContent = timerValue;
        timerInterval = setInterval(() => {
            if (over || (won && !hasKeptPlaying)) return;
            timerValue--;
            document.getElementById('timer').textContent = timerValue;
            if (timerValue <= 0) {
                clearInterval(timerInterval);
                over = true;
                showOverlay('Time is Up!', 'You ran out of time.', false);
            }
        }, 1000);
    }

    const tileContainer = document.getElementById('tile-container');
    tileContainer.innerHTML = '';
    
    addRandomTile();
    addRandomTile();
    renderBoard();
}

function setupInputs() {
    document.addEventListener('keydown', handleKey);
    
    // Swipe handling
    let touchStartX = 0;
    let touchStartY = 0;
    
    const grid = document.getElementById('grid-container');
    
    // Touch swipe handling
    grid.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, {passive: false});
    
    grid.addEventListener('touchmove', e => {
        e.preventDefault(); // Prevent scrolling while playing
    }, {passive: false});
    
    grid.addEventListener('touchend', e => {
        if(over || (won && !hasKeptPlaying)) return;
        
        let touchEndX = e.changedTouches[0].screenX;
        let touchEndY = e.changedTouches[0].screenY;
        
        handleSwipe(touchStartX, touchStartY, touchEndX, touchEndY);
    }, {passive: false});

    // Mouse drag handling (for desktop interactivity)
    let isMouseDown = false;
    let mouseStartX = 0;
    let mouseStartY = 0;

    grid.addEventListener('mousedown', e => {
        isMouseDown = true;
        mouseStartX = e.screenX;
        mouseStartY = e.screenY;
        grid.style.cursor = 'grabbing';
    });

    window.addEventListener('mouseup', e => {
        if (!isMouseDown) return;
        isMouseDown = false;
        grid.style.cursor = 'grab';
        
        if(over || (won && !hasKeptPlaying)) return;
        
        let mouseEndX = e.screenX;
        let mouseEndY = e.screenY;
        
        handleSwipe(mouseStartX, mouseStartY, mouseEndX, mouseEndY);
    });

    grid.addEventListener('mousemove', e => {
        if (isMouseDown) {
            e.preventDefault();
        }
    });
    
    grid.style.cursor = 'grab';
}

function handleSwipe(startX, startY, endX, endY) {
    let dx = endX - startX;
    let dy = endY - startY;
    
    if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 30) move(1, 0); // Right
        else if (dx < -30) move(-1, 0); // Left
    } else {
        if (dy > 30) move(0, 1); // Down
        else if (dy < -30) move(0, -1); // Up
    }
}

function handleKey(e) {
    if(over || (won && !hasKeptPlaying)) return;
    
    let moved = false;
    switch(e.key) {
        case 'ArrowUp': moved = move(0, -1); break;
        case 'ArrowDown': moved = move(0, 1); break;
        case 'ArrowLeft': moved = move(-1, 0); break;
        case 'ArrowRight': moved = move(1, 0); break;
        default: return; // ignore other keys
    }
    
    if (moved) {
        e.preventDefault(); // Prevent scrolling
    }
}

function addRandomTile() {
    let emptyCells = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === 0) emptyCells.push({r, c});
        }
    }
    if (emptyCells.length > 0) {
        let {r, c} = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        board[r][c] = Math.random() < 0.9 ? 2 : 4;
        
        // Directly inject HTML for the new tile so it animates nicely
        renderTile(r, c, board[r][c], true);
    }
}

function move(dc, dr) {
    if(over || (won && !hasKeptPlaying)) return false;
    initAudio();

    let moved = false;
    let scoreIncrease = 0;
    let hasMerged = false;
    
    // Deep copy to check if moved
    let prevBoard = JSON.parse(JSON.stringify(board));
    let merged = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(false));
    
    let processOrder = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            processOrder.push({r, c});
        }
    }
    
    // Sort process order based on direction
    if (dc === 1) processOrder.sort((a, b) => b.c - a.c); // Right
    if (dc === -1) processOrder.sort((a, b) => a.c - b.c); // Left
    if (dr === 1) processOrder.sort((a, b) => b.r - a.r); // Down
    if (dr === -1) processOrder.sort((a, b) => a.r - b.r); // Up

    for (let pos of processOrder) {
        if (board[pos.r][pos.c] === 0) continue;
        
        let r = pos.r;
        let c = pos.c;
        let val = board[r][c];
        
        let nextR = r + dr;
        let nextC = c + dc;
        
        while (nextR >= 0 && nextR < BOARD_SIZE && nextC >= 0 && nextC < BOARD_SIZE) {
            if (board[nextR][nextC] === 0) {
                // Slide
                board[nextR][nextC] = val;
                board[r][c] = 0;
                r = nextR;
                c = nextC;
                moved = true;
            } else if (board[nextR][nextC] === val && !merged[nextR][nextC]) {
                // Merge
                board[nextR][nextC] = val * 2;
                board[r][c] = 0;
                merged[nextR][nextC] = true;
                scoreIncrease += val * 2;
                moved = true;
                hasMerged = true;
                
                // Confetti for high tiers
                if (val * 2 >= 128 && window.confetti) {
                    confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
                }
                
                if (val * 2 === 2048 && !won) {
                    won = true;
                    if (window.confetti) {
                        confetti({ particleCount: 200, spread: 120, origin: { y: 0.6 } });
                    }
                }
                break; // Stop sliding this tile
            } else {
                break; // Hit different tile or already merged tile
            }
            nextR += dr;
            nextC += dc;
        }
    }
    
    if (moved) {
        if (hasMerged) playSound('merge');
        else playSound('slide');

        score += scoreIncrease;
        if (scoreIncrease > 0) showScoreAddition(scoreIncrease);
        updateScore();
        
        // Full re-render to handle positions and merges
        renderBoard(merged);
        
        setTimeout(() => {
            addRandomTile();
            checkGameState();
        }, 150);
    }
    return moved;
}

function renderBoard(mergedMask = null) {
    const container = document.getElementById('tile-container');
    container.innerHTML = '';
    
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] > 0) {
                let isMerged = mergedMask && mergedMask[r][c];
                renderTile(r, c, board[r][c], false, isMerged);
            }
        }
    }
}

function renderTile(r, c, val, isNew = false, isMerged = false) {
    const container = document.getElementById('tile-container');
    const tile = document.createElement('div');
    
    // Positioning
    const gridStyle = getComputedStyle(document.getElementById('grid-container'));
    const padding = parseFloat(gridStyle.padding);
    const gap = parseFloat(gridStyle.gap) || 15;
    const cw = document.querySelector('.grid-cell').offsetWidth;
    const ch = document.querySelector('.grid-cell').offsetHeight;
    
    let x = padding + c * (cw + gap);
    let y = padding + r * (ch + gap);
    
    tile.className = `tile tile-${val}`;
    if (isNew) tile.classList.add('tile-new');
    if (isMerged) tile.classList.add('tile-merged');
    
    tile.style.transform = `translate(${x}px, ${y}px)`;
    
    // Content based on tier
    let tierData = TIER_MAP[val];
    if (tierData) {
        // Use sprite for specific ones if we defined it in CSS
        if ([2, 8, 64, 2048].includes(val)) {
            tile.innerHTML = `<div><div class="pixel-sprite sprite-${val}"></div><span style="font-size: 11px">${tierData.name}</span></div>`;
        } else {
            tile.innerHTML = `<div>${tierData.emoji}<br><span style="font-size: 11px">${tierData.name}</span></div>`;
        }
    } else {
        tile.textContent = val;
    }
    
    container.appendChild(tile);
}

function updateScore() {
    document.getElementById('score').textContent = score;
    if (isTimeAttack) {
        if (score > bestScoreTimeAttack) {
            bestScoreTimeAttack = score;
            localStorage.setItem('mutualFunBestTime', bestScoreTimeAttack);
            document.getElementById('best-score').textContent = bestScoreTimeAttack;
        }
    } else {
        if (score > bestScoreClassic) {
            bestScoreClassic = score;
            localStorage.setItem('mutualFunBestClassic', bestScoreClassic);
            document.getElementById('best-score').textContent = bestScoreClassic;
        }
    }
}

function showScoreAddition(val) {
    const addition = document.createElement('div');
    addition.className = 'score-addition';
    addition.textContent = '+' + val;
    document.querySelector('.score-box').appendChild(addition);
    
    setTimeout(() => {
        addition.remove();
    }, 600);
}

function checkGameState() {
    // Check win
    if (won && !hasKeptPlaying) {
        playSound('win');
        showOverlay('You Reached the Throne!', 'Welcome to the Mutual Fun.', true);
        if (timerInterval) clearInterval(timerInterval);
        return;
    }
    
    // Check game over
    let canMove = false;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === 0) canMove = true;
            if (c < BOARD_SIZE - 1 && board[r][c] === board[r][c+1]) canMove = true;
            if (r < BOARD_SIZE - 1 && board[r][c] === board[r+1][c]) canMove = true;
        }
    }
    
    if (!canMove) {
        over = true;
        showOverlay('Game Over!', 'No more seats available.', false);
    }
}

function showOverlay(title, desc, isWin) {
    const overlay = document.getElementById('game-message');
    document.getElementById('message-title').textContent = title;
    document.getElementById('message-desc').textContent = desc;
    
    const keepPlayingBtn = document.getElementById('keep-playing-btn');
    const retryBtn = document.getElementById('retry-btn');
    
    if (isWin) {
        overlay.style.background = 'rgba(237, 194, 46, 0.73)';
        document.getElementById('message-title').style.color = 'white';
        keepPlayingBtn.style.display = 'inline-block';
        retryBtn.style.display = 'none';
    } else {
        overlay.style.background = 'rgba(238, 228, 218, 0.73)';
        document.getElementById('message-title').style.color = 'var(--text-color)';
        keepPlayingBtn.style.display = 'none';
        retryBtn.style.display = 'inline-block';
    }
    
    overlay.style.display = 'flex';
}

function renderLegend() {
    const legendGrid = document.getElementById('legend-grid');
    const values = [2, 4, 8, 16, 32, 64, 128, 2048];
    
    values.forEach(val => {
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `
            <div class="legend-swatch tile-${val}">
                ${TIER_MAP[val] ? TIER_MAP[val].emoji : val}
            </div>
            <div class="legend-name">${TIER_MAP[val] ? TIER_MAP[val].name : val}</div>
        `;
        legendGrid.appendChild(item);
    });
}
