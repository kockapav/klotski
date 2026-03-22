const COLS = 4;
const ROWS = 5;
const GOAL = { x: 1, y: 3 };

const START_LAYOUT = [
  { id: 'hero', label: 'Goal', x: 1, y: 0, width: 2, height: 2, colorClass: 'large' },
  { id: 'guard-left-top', label: 'A', x: 0, y: 0, width: 1, height: 2, colorClass: 'blue' },
  { id: 'guard-right-top', label: 'B', x: 3, y: 0, width: 1, height: 2, colorClass: 'green' },
  { id: 'bridge', label: 'C', x: 1, y: 2, width: 2, height: 1, colorClass: 'purple' },
  { id: 'guard-left-bottom', label: 'D', x: 0, y: 2, width: 1, height: 2, colorClass: 'teal' },
  { id: 'guard-right-bottom', label: 'E', x: 3, y: 2, width: 1, height: 2, colorClass: 'orange' },
  { id: 'small-left', label: 'F', x: 1, y: 3, width: 1, height: 1, colorClass: 'gold' },
  { id: 'small-right', label: 'G', x: 2, y: 3, width: 1, height: 1, colorClass: 'rose' },
  { id: 'runner-left', label: 'H', x: 0, y: 4, width: 1, height: 1, colorClass: 'indigo' },
  { id: 'runner-right', label: 'I', x: 3, y: 4, width: 1, height: 1, colorClass: 'sky' },
];

const board = document.getElementById('board');
const stepCount = document.getElementById('step-count');
const timeCount = document.getElementById('time-count');
const restartButton = document.getElementById('restart-button');
const playAgainButton = document.getElementById('play-again-button');
const victoryPanel = document.getElementById('victory-panel');
const victorySummary = document.getElementById('victory-summary');

let pieces = [];
let stepTotal = 0;
let startTime = 0;
let timerId = null;
let solved = false;
let activeDrag = null;

function cloneLayout() {
  return START_LAYOUT.map((piece) => ({ ...piece }));
}

function getCellSize() {
  return board.clientWidth / COLS;
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function updateTimer() {
  if (!startTime) return;
  timeCount.textContent = formatDuration(Date.now() - startTime);
}

function buildOccupancy(ignoreId) {
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  for (const piece of pieces) {
    if (piece.id === ignoreId) continue;
    for (let row = piece.y; row < piece.y + piece.height; row += 1) {
      for (let col = piece.x; col < piece.x + piece.width; col += 1) {
        grid[row][col] = piece.id;
      }
    }
  }
  return grid;
}

function getMovementRange(piece) {
  const grid = buildOccupancy(piece.id);
  let left = 0;
  while (piece.x - (left + 1) >= 0) {
    const targetCol = piece.x - (left + 1);
    let blocked = false;
    for (let row = piece.y; row < piece.y + piece.height; row += 1) {
      if (grid[row][targetCol]) {
        blocked = true;
        break;
      }
    }
    if (blocked) break;
    left += 1;
  }

  let right = 0;
  while (piece.x + piece.width + right < COLS) {
    const targetCol = piece.x + piece.width + right;
    let blocked = false;
    for (let row = piece.y; row < piece.y + piece.height; row += 1) {
      if (grid[row][targetCol]) {
        blocked = true;
        break;
      }
    }
    if (blocked) break;
    right += 1;
  }

  let up = 0;
  while (piece.y - (up + 1) >= 0) {
    const targetRow = piece.y - (up + 1);
    let blocked = false;
    for (let col = piece.x; col < piece.x + piece.width; col += 1) {
      if (grid[targetRow][col]) {
        blocked = true;
        break;
      }
    }
    if (blocked) break;
    up += 1;
  }

  let down = 0;
  while (piece.y + piece.height + down < ROWS) {
    const targetRow = piece.y + piece.height + down;
    let blocked = false;
    for (let col = piece.x; col < piece.x + piece.width; col += 1) {
      if (grid[targetRow][col]) {
        blocked = true;
        break;
      }
    }
    if (blocked) break;
    down += 1;
  }

  return { left, right, up, down };
}

function setPiecePosition(piece, immediate = false) {
  const cell = getCellSize();
  if (immediate) {
    piece.element.style.transition = 'none';
  } else {
    piece.element.style.transition = '';
  }
  piece.element.style.width = `${piece.width * cell - 12}px`;
  piece.element.style.height = `${piece.height * cell - 12}px`;
  piece.element.style.left = `${piece.x * cell + 6}px`;
  piece.element.style.top = `${piece.y * cell + 6}px`;
  if (immediate) {
    requestAnimationFrame(() => {
      piece.element.style.transition = '';
    });
  }
}

function renderBoard(immediate = false) {
  for (const piece of pieces) {
    if (!piece.element) {
      const node = document.createElement('div');
      node.className = `tile ${piece.colorClass}`;
      node.dataset.id = piece.id;
      node.innerHTML = `<span>${piece.label}</span>`;
      board.appendChild(node);
      node.addEventListener('pointerdown', (event) => startDrag(event, piece.id));
      piece.element = node;
    }
    setPiecePosition(piece, immediate);
  }
}

function incrementStep() {
  stepTotal += 1;
  stepCount.textContent = stepTotal;
}

function finishGame() {
  solved = true;
  clearInterval(timerId);
  const elapsed = Date.now() - startTime;
  victorySummary.textContent = `Solved in ${stepTotal} moves over ${formatDuration(elapsed)}.`;
  victoryPanel.classList.remove('hidden');
}

function checkVictory() {
  const hero = pieces.find((piece) => piece.id === 'hero');
  if (hero.x === GOAL.x && hero.y === GOAL.y) {
    finishGame();
  }
}

function endDrag(commitMove = false) {
  if (!activeDrag) return;
  const { piece, startX, startY, currentCellOffset } = activeDrag;
  piece.element.classList.remove('dragging');
  piece.element.releasePointerCapture?.(activeDrag.pointerId);

  if (commitMove && currentCellOffset !== 0) {
    if (activeDrag.axis === 'x') {
      piece.x = startX + currentCellOffset;
    } else {
      piece.y = startY + currentCellOffset;
    }
    setPiecePosition(piece);
    incrementStep();
    checkVictory();
  } else {
    piece.x = startX;
    piece.y = startY;
    setPiecePosition(piece);
  }

  activeDrag = null;
}

function handlePointerMove(event) {
  if (!activeDrag || solved) return;

  if (!activeDrag.axis) {
    const dx = event.clientX - activeDrag.startPointerX;
    const dy = event.clientY - activeDrag.startPointerY;
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;

    if (Math.abs(dx) >= Math.abs(dy) && activeDrag.horizontalFreedom) {
      activeDrag.axis = 'x';
      activeDrag.minCells = -activeDrag.range.left;
      activeDrag.maxCells = activeDrag.range.right;
    } else if (activeDrag.verticalFreedom) {
      activeDrag.axis = 'y';
      activeDrag.minCells = -activeDrag.range.up;
      activeDrag.maxCells = activeDrag.range.down;
    } else if (activeDrag.horizontalFreedom) {
      activeDrag.axis = 'x';
      activeDrag.minCells = -activeDrag.range.left;
      activeDrag.maxCells = activeDrag.range.right;
    }
  }

  if (!activeDrag.axis) return;

  const { axis, minCells, maxCells, startPointerX, startPointerY, piece } = activeDrag;
  const cell = getCellSize();
  const deltaPx = axis === 'x' ? event.clientX - startPointerX : event.clientY - startPointerY;
  const clampedPx = Math.max(minCells * cell, Math.min(maxCells * cell, deltaPx));
  const snappedCells = Math.round(clampedPx / cell);
  activeDrag.currentCellOffset = snappedCells;

  const baseLeft = activeDrag.startX * cell + 6;
  const baseTop = activeDrag.startY * cell + 6;
  piece.element.style.left = `${baseLeft}px`;
  piece.element.style.top = `${baseTop}px`;
  if (axis === 'x') {
    piece.element.style.left = `${baseLeft + clampedPx}px`;
  } else {
    piece.element.style.top = `${baseTop + clampedPx}px`;
  }
}

function startDrag(event, pieceId) {
  if (solved) return;
  const piece = pieces.find((item) => item.id === pieceId);
  const range = getMovementRange(piece);
  const horizontalFreedom = range.left + range.right;
  const verticalFreedom = range.up + range.down;

  if (!horizontalFreedom && !verticalFreedom) {
    return;
  }

  event.preventDefault();
  activeDrag = {
    piece,
    axis: null,
    minCells: 0,
    maxCells: 0,
    range,
    horizontalFreedom,
    verticalFreedom,
    startX: piece.x,
    startY: piece.y,
    startPointerX: event.clientX,
    startPointerY: event.clientY,
    currentCellOffset: 0,
    pointerId: event.pointerId,
  };

  piece.element.classList.add('dragging');
  piece.element.setPointerCapture?.(event.pointerId);
}

function resetGame() {
  clearInterval(timerId);
  victoryPanel.classList.add('hidden');
  board.innerHTML = '';
  pieces = cloneLayout();
  stepTotal = 0;
  stepCount.textContent = '0';
  solved = false;
  startTime = Date.now();
  timeCount.textContent = '00:00';
  renderBoard(true);
  timerId = setInterval(updateTimer, 1000);
}

board.addEventListener('pointermove', handlePointerMove);
board.addEventListener('pointerup', () => endDrag(true));
board.addEventListener('pointercancel', () => endDrag(false));
board.addEventListener('pointerleave', (event) => {
  if (activeDrag && event.buttons === 0) {
    endDrag(true);
  }
});
window.addEventListener('resize', () => renderBoard(true));
restartButton.addEventListener('click', resetGame);
playAgainButton.addEventListener('click', resetGame);
victoryPanel.addEventListener('click', (event) => {
  if (event.target === victoryPanel) {
    victoryPanel.classList.add('hidden');
  }
});

resetGame();
