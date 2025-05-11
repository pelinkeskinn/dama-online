const socket = io();

let currentPlayerColor = null;
let selectedPiece = null;
let currentTurn = "red";
const room = "room1";
let mustContinue = false;

// Renk seçimi formu gönderildiğinde
document.getElementById("colorForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const selectedColor = document.querySelector('input[name="color"]:checked').value;
  currentPlayerColor = selectedColor;

  socket.emit("join", {
    username: username,
    room: room,
    color: currentPlayerColor
  });
});

// Renk atanması cevabı
socket.on("assign_color", (color) => {
  if (color === "rejected") {
    alert("Bu renk zaten seçilmiş. Lütfen başka bir renk seçin.");
    location.reload();
    return;
  }

  currentPlayerColor = color;
  document.getElementById("board").style.display = "grid";
  document.getElementById("colorForm").style.display = "none";

  console.log("Seçilen renk:", currentPlayerColor);
});

socket.on("move_made", (data) => {
  const fromIndex = data.fromRow * boardSize + data.fromCol;
  const toIndex = data.toRow * boardSize + data.toCol;
  const cells = document.querySelectorAll(".cell");
  const fromCell = cells[fromIndex];
  const toCell = cells[toIndex];
  const piece = fromCell.querySelector(".piece");

  if (piece) {
    piece.dataset.row = data.toRow;
    piece.dataset.col = data.toCol;
    toCell.appendChild(piece);

    if (data.capturedIndex !== undefined) {
      const capturedCell = cells[data.capturedIndex];
      const capturedPiece = capturedCell.querySelector(".piece");
      if (capturedPiece) capturedCell.removeChild(capturedPiece);
    }

    // Vezir kontrolü
    // Vezir bilgisi sunucudan geldiyse uygula
if (data.becameQueen && piece) {
    piece.classList.add("queen");
  }
  

    if (data.mustContinue) {
      selectedPiece = piece;
      mustContinue = true;
      return;
    } else {
      mustContinue = false;
      selectedPiece = null;
    }
  }
});

socket.on("turn_update", (nextTurn) => {
  currentTurn = nextTurn;
  console.log("Yeni sıra:", currentTurn);
});

const board = document.getElementById("board");
const boardSize = 8;
const cellSize = 60;

for (let row = 0; row < boardSize; row++) {
  for (let col = 0; col < boardSize; col++) {
    const cell = document.createElement("div");
    cell.classList.add("cell");
    if ((row + col) % 2 === 0) {
      cell.classList.add("light");
    } else {
      cell.classList.add("dark");
    }
    cell.style.width = `${cellSize}px`;
    cell.style.height = `${cellSize}px`;
    board.appendChild(cell);
  }
}

socket.on("player_joined", (players) => {
  const listDiv = document.getElementById("playerList");
  if (!listDiv) return;

  listDiv.innerHTML = "<h3>Oyuncular</h3>";

  const entries = Object.entries(players);

  entries.forEach(([name, color]) => {
    const renk = color === "red" ? "Kırmızı" : "Siyah";
    const item = document.createElement("div");
    item.textContent = `${name} (${renk})`;
    listDiv.appendChild(item);
  });
});

function showMessage(msg) {
  const box = document.getElementById("messageBox");
  if (!box) return;

  box.textContent = msg;
  box.style.display = "block";

  setTimeout(() => {
    box.style.display = "none";
    box.textContent = "";
  }, 3000);
}

board.style.gridTemplateColumns = `repeat(${boardSize}, ${cellSize}px)`;
board.style.width = `${boardSize * cellSize}px`;
board.style.margin = "auto";

function addPieces() {
  const cells = document.querySelectorAll(".cell");
  cells.forEach((cell, index) => {
    const row = Math.floor(index / boardSize);
    const col = index % boardSize;
    if ((row + col) % 2 === 1) {
      if (row < 3) {
        const piece = document.createElement("div");
        piece.classList.add("piece", "black");
        piece.dataset.row = row;
        piece.dataset.col = col;
        cell.appendChild(piece);
      }
      if (row > 4) {
        const piece = document.createElement("div");
        piece.classList.add("piece", "red");
        piece.dataset.row = row;
        piece.dataset.col = col;
        cell.appendChild(piece);
      }
    }
  });
}

addPieces();

function getDirections(piece) {
  return piece.classList.contains("queen") ? [-1, 1] : (piece.classList.contains("red") ? [-1] : [1]);
}

function canCaptureAgain(piece) {
  const row = parseInt(piece.dataset.row);
  const col = parseInt(piece.dataset.col);
  const directions = getDirections(piece);
  const cells = document.querySelectorAll(".cell");

  for (let dir of directions) {
    const targets = [
      { r: row + dir * 2, c: col + 2 },
      { r: row + dir * 2, c: col - 2 }
    ];

    for (let t of targets) {
      if (t.r < 0 || t.r >= boardSize || t.c < 0 || t.c >= boardSize) continue;

      const midR = row + dir;
      const midC = (col + t.c) / 2;
      if (!Number.isInteger(midC)) continue;

      const midIndex = midR * boardSize + midC;
      const targetIndex = t.r * boardSize + t.c;

      const midCell = cells[midIndex];
      const targetCell = cells[targetIndex];
      if (!midCell || !targetCell) continue;

      const midPiece = midCell.querySelector(".piece");
      const targetPiece = targetCell.querySelector(".piece");

      if (midPiece && !midPiece.classList.contains(currentPlayerColor) && !targetPiece) {
        return true;
      }
    }
  }

  return false;
}

function mustCapture(color) {
  const cells = document.querySelectorAll(".cell");
  const mustCapturePieces = [];

  for (let i = 0; i < cells.length; i++) {
    const piece = cells[i].querySelector(".piece");
    if (!piece || !piece.classList.contains(color)) continue;

    const row = parseInt(piece.dataset.row);
    const col = parseInt(piece.dataset.col);
    const directions = getDirections(piece);

    for (let dir of directions) {
      const targets = [
        { r: row + dir * 2, c: col + 2 },
        { r: row + dir * 2, c: col - 2 }
      ];

      for (let t of targets) {
        const midR = row + dir;
        const midC = (col + t.c) / 2;
        if (
          t.r >= 0 && t.r < boardSize &&
          t.c >= 0 && t.c < boardSize &&
          midR >= 0 && midR < boardSize &&
          midC >= 0 && midC < boardSize &&
          Number.isInteger(midC)
        ) {
          const midIndex = midR * boardSize + midC;
          const targetIndex = t.r * boardSize + t.c;

          const midCell = cells[midIndex];
          const targetCell = cells[targetIndex];
          if (!midCell || !targetCell) continue;

          const midPiece = midCell.querySelector(".piece");
          const targetPiece = targetCell.querySelector(".piece");

          if (midPiece && !midPiece.classList.contains(color) && !targetPiece) {
            mustCapturePieces.push(piece);
          }
        }
      }
    }
  }

  return mustCapturePieces;
}
document.querySelectorAll(".cell").forEach((cell, index) => {
    cell.addEventListener("click", () => {
      if (!currentPlayerColor || currentTurn !== currentPlayerColor) return;
  
      const piece = cell.querySelector(".piece");
      const row = Math.floor(index / boardSize);
      const col = index % boardSize;
      const mustList = mustCapture(currentPlayerColor);
  
      // Taş seçimi
      if (piece && piece.classList.contains(currentPlayerColor)) {
        const isInMustList = mustList.some(p => parseInt(p.dataset.row) === row && parseInt(p.dataset.col) === col);
        if (mustList.length > 0 && !isInMustList && !mustContinue) {
          showMessage("Yeme zorunlu! Sadece yiyebilecek taşlarla oynayabilirsiniz.");
          return;
        }
        if (!mustContinue || (selectedPiece && selectedPiece === piece)) {
          selectedPiece = piece;
          piece.classList.add("selected");
        }
        return;
      }
  
      // Hamle yapılması
      if (selectedPiece && !piece) {
        const fromRow = parseInt(selectedPiece.dataset.row);
        const fromCol = parseInt(selectedPiece.dataset.col);
        const toRow = row;
        const toCol = col;
        const rowDiff = toRow - fromRow;
        const colDiff = toCol - fromCol;
        const direction = getDirections(selectedPiece)[0]; // vezir destekli
  
        let isValid = false;
        let capturedIndex = undefined;
  
        if (Math.abs(rowDiff) === 1 && Math.abs(colDiff) === 1 && !mustContinue && !selectedPiece.classList.contains("queen")) {
          isValid = true;
        } else if (Math.abs(rowDiff) === 2 && Math.abs(colDiff) === 2) {
          const midRow = (fromRow + toRow) / 2;
          const midCol = (fromCol + toCol) / 2;
          const midIndex = midRow * boardSize + midCol;
          const midCell = document.querySelectorAll(".cell")[midIndex];
          const midPiece = midCell.querySelector(".piece");
  
          if (midPiece && !midPiece.classList.contains(currentPlayerColor)) {
            isValid = true;
            capturedIndex = midIndex;
            midCell.removeChild(midPiece);
          }
        }
  
        if (mustList.length > 0 && capturedIndex === undefined) {
          showMessage("Yeme zorunlu! Bu hamle geçerli değil.");
          selectedPiece.classList.remove("selected");
          selectedPiece = null;
          return;
        }
  
        if (isValid) {
          selectedPiece.dataset.row = toRow;
          selectedPiece.dataset.col = toCol;
          cell.appendChild(selectedPiece);
  
          const willContinue = capturedIndex !== undefined && canCaptureAgain(selectedPiece);
  
          socket.emit("make_move", {
            room,
            fromRow,
            fromCol,
            toRow,
            toCol,
            capturedIndex,
            color: currentPlayerColor,
            mustContinue: willContinue
          });
  
          if (!willContinue) {
            selectedPiece.classList.remove("selected");
            selectedPiece = null;
          }
        } else {
          selectedPiece.classList.remove("selected");
          selectedPiece = null;
        }
      }
    });
  });
  