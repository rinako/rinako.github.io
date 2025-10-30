function HTMLActuator() {
  this.tileContainer    = document.querySelector(".tile-container");
  this.scoreContainer   = document.querySelector(".score-container");
  this.bestContainer    = document.querySelector(".best-container");
  this.messageContainer = document.querySelector(".game-message");
  this.score = 0;
}

HTMLActuator.prototype.actuate = function (grid, metadata) {
  var self = this;
  window.requestAnimationFrame(function () {
    self.clearContainer(self.tileContainer);
    grid.cells.forEach(function (column) {
      column.forEach(function (cell) {
        if (cell) {
          self.addTile(cell);
        }
      });
    });
    self.updateScore(metadata.score);
    self.updateBestScore(metadata.bestScore);
    if (metadata.terminated) {
      if (metadata.over) {
        self.message(false, metadata.maxTile);
      } else if (metadata.won) {
        self.message(true, metadata.maxTile);
      }
    }
  });
};

HTMLActuator.prototype.continue = function () {
  this.clearMessage();
};

HTMLActuator.prototype.clearContainer = function (container) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
};

HTMLActuator.prototype.addTile = function (tile) {
  var self = this;
  var wrapper = document.createElement("div");
  var inner = document.createElement("div");
  var position = tile.previousPosition || { x: tile.x, y: tile.y };
  var positionClass = this.positionClass(position);
  
  // 使用正确的CSS类
  var classes = ["tile", "tile-" + tile.value, positionClass];
  
  // 只为超过131072的数字添加tile-super类
  if (tile.value > 131072) classes.push("tile-super");
  
  this.applyClasses(wrapper, classes);
  
  inner.classList.add("tile-inner");
  inner.textContent = tile.value;
  
  if (tile.previousPosition) {
    window.requestAnimationFrame(function () {
      classes[2] = self.positionClass({ x: tile.x, y: tile.y });
      self.applyClasses(wrapper, classes);
    });
  } else if (tile.mergedFrom) {
    classes.push("tile-merged");
    this.applyClasses(wrapper, classes);
    tile.mergedFrom.forEach(function (merged) {
      self.addTile(merged);
    });
  } else {
    classes.push("tile-new");
    this.applyClasses(wrapper, classes);
  }
  
  wrapper.appendChild(inner);
  this.tileContainer.appendChild(wrapper);
};

HTMLActuator.prototype.applyClasses = function (element, classes) {
  element.setAttribute("class", classes.join(" "));
};

HTMLActuator.prototype.normalizePosition = function (position) {
  return { x: position.x + 1, y: position.y + 1 };
};

HTMLActuator.prototype.positionClass = function (position) {
  position = this.normalizePosition(position);
  return "tile-position-" + position.x + "-" + position.y;
};

HTMLActuator.prototype.updateScore = function (score) {
  var self = this;
  var difference = score - this.score;
  this.score = score;
  this.scoreContainer.textContent = this.score;
  
  // 如果分数有增加，显示加分动画
  if (difference > 0) {
    this.showScoreAddition(difference);
  }
};

// 显示加分动画
HTMLActuator.prototype.showScoreAddition = function (difference) {
  var addition = document.createElement("div");
  addition.classList.add("score-addition");
  addition.textContent = "+" + difference;
  
  // 将加分元素添加到分数容器中
  this.scoreContainer.appendChild(addition);
  
  // 动画结束后移除元素
  setTimeout(function() {
    if (addition.parentNode === self.scoreContainer) {
      self.scoreContainer.removeChild(addition);
    }
  }, 1000); // 动画持续1秒
};

HTMLActuator.prototype.updateBestScore = function (bestScore) {
  this.bestContainer.textContent = bestScore;
};

// 在HTMLActuator原型中添加存档状态提示方法
HTMLActuator.prototype.showSaveMessage = function (message) {
  // 可以在这里添加存档状态的视觉反馈
  console.log(message);
  // 可选：在界面上显示一个临时提示
  var hint = document.createElement("div");
  hint.className = "save-message";
  hint.textContent = message;
  hint.style.cssText = "position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: rgba(143, 122, 102, 0.9); color: white; padding: 10px; border-radius: 5px; z-index: 1000;";
  document.body.appendChild(hint);
  
  setTimeout(function() {
    if (document.body.contains(hint)) {
      document.body.removeChild(hint);
    }
  }, 2000);
};

HTMLActuator.prototype.message = function (won, maxTile) {
  var type = won ? "game-won" : "game-over";
  var message = this.getGameMessage(won, maxTile);
  
  this.messageContainer.classList.add(type);
  this.messageContainer.getElementsByTagName("p")[0].textContent = message;
};

HTMLActuator.prototype.getGameMessage = function (won, maxTile) {
  if (won) {
    if (maxTile >= 131072) return "天神下凡！";
    if (maxTile >= 65536) return "游戏圣手！";
    if (maxTile >= 32768) return "一代宗师！";
    return "恭喜！继续挑战吧！";
  } else {
    if (maxTile <= 64) return "继续加油！";
    if (maxTile <= 256) return "再接再厉！";
    if (maxTile <= 1024) return "干得漂亮！";
    if (maxTile <= 4096) return "真了不起！";
    if (maxTile <= 16384) return "大神求带！";
    return "传奇玩家！";
  }
};

HTMLActuator.prototype.clearMessage = function () {
  this.messageContainer.classList.remove("game-won");
  this.messageContainer.classList.remove("game-over");
};