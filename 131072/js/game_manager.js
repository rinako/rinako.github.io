function GameManager(size, InputManager, Actuator, ScoreManager) {
  this.size         = size;
  this.inputManager = new InputManager;
  this.scoreManager = new ScoreManager;
  this.actuator     = new Actuator;

  this.startTiles   = 2;
  this.maxPower     = 17; // 2^17 = 131072
  this.saveKey      = "131072_save";

  this.inputManager.on("move", this.move.bind(this));
  this.inputManager.on("restart", this.restart.bind(this));
  this.inputManager.on("keepPlaying", this.keepPlaying.bind(this));
  this.inputManager.on("saveGame", this.exportGame.bind(this)); // ��Ϊ������Ϸ
  this.inputManager.on("loadGameFromFile", this.loadFromFile.bind(this)); // ���ļ�����
  this.inputManager.on("showMessage", this.showMessage.bind(this));
  this.inputManager.on("resetGame", this.resetGame.bind(this)); // ���resetGame�¼�

  this.setup();
}


// ���෽�����ֲ���...
// (showSaveManager, hideSaveManager, exportGame��)

// ������ϷΪ�ļ�
GameManager.prototype.exportGame = function () {
  var gameState = this.getGameState();
  
  try {
    // ����Blob����
    var blob = new Blob([JSON.stringify(gameState, null, 2)], {type: "application/json"});
    
    // ������������
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    
    // �����ļ������������ں�ʱ��
    var date = new Date();
    var filename = "131072_save_" + 
                  date.getFullYear() + 
                  ("0" + (date.getMonth() + 1)).slice(-2) + 
                  ("0" + date.getDate()).slice(-2) + "_" + 
                  ("0" + date.getHours()).slice(-2) + 
                  ("0" + date.getMinutes()).slice(-2) + 
                  ".json";
    
    a.download = filename;
    
    // ��������
    document.body.appendChild(a);
    a.click();
    
    // ����
    setTimeout(function() {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
    
    this.showMessage("Game exported: " + filename);
  } catch (e) {
    console.error("Game exporting failed:", e);
    this.showMessage("Game exporting failed");
  }
};

// ���ļ�������Ϸ
GameManager.prototype.loadFromFile = function (gameState) {
  try {
    this.loadFromState(gameState);
    this.actuate();
    this.showMessage("Game loaded");
    
    // ͬʱ���浽���ش洢
    this.saveToLocalStorage();
  } catch (e) {
    console.error("Game loading failed:", e);
    this.showMessage("Game loading failed");
  }
};

// ��ȡ��Ϸ״̬
GameManager.prototype.getGameState = function () {
  return {
    grid: this.serializeGrid(),
    score: this.score,
    over: this.over,
    won: this.won,
    keepPlaying: this.keepPlaying,
    maxTile: this.maxTile,
    version: "1.0",
    timestamp: new Date().toISOString()
  };
};

// ���浽���ش洢
GameManager.prototype.saveToLocalStorage = function () {
  try {
    localStorage.setItem(this.saveKey, JSON.stringify(this.getGameState()));
  } catch (e) {
    console.error("Saving to file failed:", e);
  }
};

// �ӱ��ش洢����
GameManager.prototype.loadFromLocalStorage = function () {
  try {
    var savedState = localStorage.getItem(this.saveKey);
    if (savedState) {
      var gameState = JSON.parse(savedState);
      this.loadFromState(gameState);
      return true;
    }
  } catch (e) {
    console.error("File loading failed:", e);
  }
  return false;
};

// ���л�����״̬
GameManager.prototype.serializeGrid = function () {
  var gridState = [];
  for (var x = 0; x < this.size; x++) {
    var row = [];
    for (var y = 0; y < this.size; y++) {
      var tile = this.grid.cellContent({x: x, y: y});
      row.push(tile ? tile.value : null);
    }
    gridState.push(row);
  }
  return gridState;
};

// ��״̬������Ϸ
GameManager.prototype.loadFromState = function (state) {
  this.grid = new Grid(this.size);
  this.score = state.score || 0;
  this.over = state.over || false;
  this.won = state.won || false;
  this.keepPlaying = state.keepPlaying || false;
  this.maxTile = state.maxTile || 2;

  // �ؽ�����
  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      var value = state.grid[x][y];
      if (value !== null) {
        var tile = new Tile({x: x, y: y}, value);
        this.grid.insertTile(tile);
      }
    }
  }
};

// �޸�restart������������ش洢
GameManager.prototype.restart = function () {
  try {
    localStorage.removeItem(this.saveKey);
  } catch (e) {
    console.error("Local storage deleting failed:", e);
  }
  this.actuator.continue();
  this.setup();
};

// ���resetGame����
GameManager.prototype.resetGame = function () {
  try {
    // ������ش洢
    localStorage.removeItem(this.saveKey);
    // �����߷�
    this.scoreManager.set(0);
    // ������Ϸ״̬
    this.grid = new Grid(this.size);
    this.score = 0;
    this.over = false;
    this.won = false;
    this.keepPlaying = false;
    this.maxTile = 2;
    
    // ��ӳ�ʼ����
    this.addStartTiles();
    
    // ���½���
    this.actuate();
    
    this.showMessage("Game reseted");
  } catch (e) {
    console.error("Game reseting failed:", e);
    this.showMessage("Game reseting failed");
  }
};

// �޸�setup���������Լ��ر��ش洢�Ĵ浵
GameManager.prototype.setup = function () {
  // ���Լ��ر��ش洢�Ĵ浵�����ʧ���򴴽�����Ϸ
  if (!this.loadFromLocalStorage()) {
    this.grid = new Grid(this.size);
    this.score = 0;
    this.over = false;
    this.won = false;
    this.keepPlaying = false;
    this.maxTile = 2;

    this.addStartTiles();
  }
  this.actuate();
};

// �޸�move���������ƶ����Զ����浽���ش洢
GameManager.prototype.move = function (direction) {
  var self = this;
  if (this.isGameTerminated()) return;

  var cell, tile;
  var vector     = this.getVector(direction);
  var traversals = this.buildTraversals(vector);
  var moved      = false;

  this.prepareTiles();

  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {
      cell = { x: x, y: y };
      tile = self.grid.cellContent(cell);

      if (tile) {
        var positions = self.findFarthestPosition(cell, vector);
        var next      = self.grid.cellContent(positions.next);

        if (next && next.value === tile.value && !next.mergedFrom) {
          var merged = new Tile(positions.next, tile.value * 2);
          merged.mergedFrom = [tile, next];

          self.grid.insertTile(merged);
          self.grid.removeTile(tile);
          tile.updatePosition(positions.next);

          self.score += merged.value;
          
          // ������󷽿�
          if (merged.value > self.maxTile) {
            self.maxTile = merged.value;
          }

          // ����Ƿ�ﵽ131072
          if (merged.value === 131072) {
            self.won = true;
          }
        } else {
          self.moveTile(tile, positions.farthest);
        }

        if (!self.positionsEqual(cell, tile)) {
          moved = true;
        }
      }
    });
  });

  if (moved) {
    this.addRandomTile();
    if (!this.movesAvailable()) {
      this.over = true;
    }
    // �ƶ����Զ����浽���ش洢
    this.saveToLocalStorage();
    this.actuate();
  }
};

// ��ʾ��Ϣ
GameManager.prototype.showMessage = function (message) {
  this.actuator.showSaveMessage(message);
};

GameManager.prototype.keepPlaying = function () {
  this.keepPlaying = true;
  this.actuator.continue();
};

GameManager.prototype.isGameTerminated = function () {
  return this.over || (this.won && !this.keepPlaying);
};

GameManager.prototype.addStartTiles = function () {
  for (var i = 0; i < this.startTiles; i++) {
    this.addRandomTile();
  }
};

GameManager.prototype.addRandomTile = function () {
  if (this.grid.cellsAvailable()) {
    var value = 2; // ֻ���2
    var tile = new Tile(this.grid.randomAvailableCell(), value);
    this.grid.insertTile(tile);
  }
};

GameManager.prototype.actuate = function () {
  if (this.scoreManager.get() < this.score) {
    this.scoreManager.set(this.score);
  }

  this.actuator.actuate(this.grid, {
    score:      this.score,
    over:       this.over,
    won:        this.won,
    bestScore:  this.scoreManager.get(),
    terminated: this.isGameTerminated(),
    maxTile:    this.maxTile
  });
};

GameManager.prototype.prepareTiles = function () {
  this.grid.eachCell(function (x, y, tile) {
    if (tile) {
      tile.mergedFrom = null;
      tile.savePosition();
    }
  });
};

GameManager.prototype.moveTile = function (tile, cell) {
  this.grid.cells[tile.x][tile.y] = null;
  this.grid.cells[cell.x][cell.y] = tile;
  tile.updatePosition(cell);
};

GameManager.prototype.getVector = function (direction) {
  var map = {
    0: { x: 0,  y: -1 },
    1: { x: 1,  y: 0 },
    2: { x: 0,  y: 1 },
    3: { x: -1, y: 0 }
  };
  return map[direction];
};

GameManager.prototype.buildTraversals = function (vector) {
  var traversals = { x: [], y: [] };
  for (var pos = 0; pos < this.size; pos++) {
    traversals.x.push(pos);
    traversals.y.push(pos);
  }
  if (vector.x === 1) traversals.x = traversals.x.reverse();
  if (vector.y === 1) traversals.y = traversals.y.reverse();
  return traversals;
};

GameManager.prototype.findFarthestPosition = function (cell, vector) {
  var previous;
  do {
    previous = cell;
    cell     = { x: previous.x + vector.x, y: previous.y + vector.y };
  } while (this.grid.withinBounds(cell) && this.grid.cellAvailable(cell));
  return {
    farthest: previous,
    next: cell
  };
};

GameManager.prototype.movesAvailable = function () {
  return this.grid.cellsAvailable() || this.tileMatchesAvailable();
};

GameManager.prototype.tileMatchesAvailable = function () {
  var self = this;
  var tile;
  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      tile = this.grid.cellContent({ x: x, y: y });
      if (tile) {
        for (var direction = 0; direction < 4; direction++) {
          var vector = self.getVector(direction);
          var cell   = { x: x + vector.x, y: y + vector.y };
          var other  = self.grid.cellContent(cell);
          if (other && other.value === tile.value) {
            return true;
          }
        }
      }
    }
  }
  return false;
};

GameManager.prototype.positionsEqual = function (first, second) {
  return first.x === second.x && first.y === second.y;
};