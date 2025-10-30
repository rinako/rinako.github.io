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
  this.inputManager.on("saveGame", this.exportGame.bind(this)); // 改为导出游戏
  this.inputManager.on("loadGameFromFile", this.loadFromFile.bind(this)); // 从文件加载
  this.inputManager.on("showMessage", this.showMessage.bind(this));
  this.inputManager.on("resetGame", this.resetGame.bind(this)); // 添加resetGame事件

  this.setup();
}


// 其余方法保持不变...
// (showSaveManager, hideSaveManager, exportGame等)

// 导出游戏为文件
GameManager.prototype.exportGame = function () {
  var gameState = this.getGameState();
  
  try {
    // 创建Blob对象
    var blob = new Blob([JSON.stringify(gameState, null, 2)], {type: "application/json"});
    
    // 创建下载链接
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    
    // 生成文件名，包含日期和时间
    var date = new Date();
    var filename = "131072_save_" + 
                  date.getFullYear() + 
                  ("0" + (date.getMonth() + 1)).slice(-2) + 
                  ("0" + date.getDate()).slice(-2) + "_" + 
                  ("0" + date.getHours()).slice(-2) + 
                  ("0" + date.getMinutes()).slice(-2) + 
                  ".json";
    
    a.download = filename;
    
    // 触发下载
    document.body.appendChild(a);
    a.click();
    
    // 清理
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

// 从文件加载游戏
GameManager.prototype.loadFromFile = function (gameState) {
  try {
    this.loadFromState(gameState);
    this.actuate();
    this.showMessage("Game loaded");
    
    // 同时保存到本地存储
    this.saveToLocalStorage();
  } catch (e) {
    console.error("Game loading failed:", e);
    this.showMessage("Game loading failed");
  }
};

// 获取游戏状态
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

// 保存到本地存储
GameManager.prototype.saveToLocalStorage = function () {
  try {
    localStorage.setItem(this.saveKey, JSON.stringify(this.getGameState()));
  } catch (e) {
    console.error("Saving to file failed:", e);
  }
};

// 从本地存储加载
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

// 序列化网格状态
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

// 从状态加载游戏
GameManager.prototype.loadFromState = function (state) {
  this.grid = new Grid(this.size);
  this.score = state.score || 0;
  this.over = state.over || false;
  this.won = state.won || false;
  this.keepPlaying = state.keepPlaying || false;
  this.maxTile = state.maxTile || 2;

  // 重建网格
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

// 修改restart方法，清除本地存储
GameManager.prototype.restart = function () {
  try {
    localStorage.removeItem(this.saveKey);
  } catch (e) {
    console.error("Local storage deleting failed:", e);
  }
  this.actuator.continue();
  this.setup();
};

// 添加resetGame方法
GameManager.prototype.resetGame = function () {
  try {
    // 清除本地存储
    localStorage.removeItem(this.saveKey);
    // 清除最高分
    this.scoreManager.set(0);
    // 重置游戏状态
    this.grid = new Grid(this.size);
    this.score = 0;
    this.over = false;
    this.won = false;
    this.keepPlaying = false;
    this.maxTile = 2;
    
    // 添加初始方块
    this.addStartTiles();
    
    // 更新界面
    this.actuate();
    
    this.showMessage("Game reseted");
  } catch (e) {
    console.error("Game reseting failed:", e);
    this.showMessage("Game reseting failed");
  }
};

// 修改setup方法，尝试加载本地存储的存档
GameManager.prototype.setup = function () {
  // 尝试加载本地存储的存档，如果失败则创建新游戏
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

// 修改move方法，在移动后自动保存到本地存储
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
          
          // 更新最大方块
          if (merged.value > self.maxTile) {
            self.maxTile = merged.value;
          }

          // 检查是否达到131072
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
    // 移动后自动保存到本地存储
    this.saveToLocalStorage();
    this.actuate();
  }
};

// 显示消息
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
    var value = 2; // 只添加2
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