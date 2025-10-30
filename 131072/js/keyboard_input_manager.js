function KeyboardInputManager() {
  this.events = {};

  if (window.navigator.msPointerEnabled) {
    //Internet Explorer 10 style
    this.eventTouchstart    = "MSPointerDown";
    this.eventTouchmove     = "MSPointerMove";
    this.eventTouchend      = "MSPointerUp";
  } else {
    this.eventTouchstart    = "touchstart";
    this.eventTouchmove     = "touchmove";
    this.eventTouchend      = "touchend";
  }

  this.listen();
}

KeyboardInputManager.prototype.on = function (event, callback) {
  if (!this.events[event]) {
    this.events[event] = [];
  }
  this.events[event].push(callback);
};

KeyboardInputManager.prototype.emit = function (event, data) {
  var callbacks = this.events[event];
  if (callbacks) {
    callbacks.forEach(function (callback) {
      callback(data);
    });
  }
};

KeyboardInputManager.prototype.listen = function () {
  var self = this;

  var map = {
    38: 0, // Up
    39: 1, // Right
    40: 2, // Down
    37: 3, // Left
    75: 0, // vim keybindings
    76: 1,
    74: 2,
    72: 3,
    87: 0, // W
    68: 1, // D
    83: 2, // S
    65: 3  // A
  };

  document.addEventListener("keydown", function (event) {
    var modifiers = event.altKey || event.ctrlKey || event.metaKey ||
                    event.shiftKey;
    var mapped    = map[event.which];

    if (!modifiers) {
      if (mapped !== undefined) {
        event.preventDefault();
        self.emit("move", mapped);
      }

      if (event.which === 32) self.restart.bind(self)(event); // �ո�����¿�ʼ
      // �Ƴ���Ctrl+S��Ctrl+L��ݼ����������������ͻ
    }
  });

  var retry = document.querySelector(".retry-button");
  retry.addEventListener("click", this.restart.bind(this));
  retry.addEventListener("touchend", this.restart.bind(this));

  // ��Ӵ浵��ť�¼�����
  var saveBtn = document.querySelector(".save-button");
  if (saveBtn) {
    saveBtn.addEventListener("click", function() {
      self.emit("saveGame");
    });
  }
  
  var loadBtn = document.querySelector(".load-button");
  if (loadBtn) {
    loadBtn.addEventListener("click", function() {
      // �������ص��ļ�����Ԫ��
      document.getElementById('file-input').click();
    });
  }
  
  // ���Reset��ť�¼�����
  var resetBtn = document.querySelector(".reset-button");
  if (resetBtn) {
    resetBtn.addEventListener("click", function() {
      if (confirm("Reset game will delete local storage.")) {
        self.emit("resetGame");
      }
    });
  }
  
  // �ļ�����仯�¼�
  var fileInput = document.getElementById('file-input');
  if (fileInput) {
    fileInput.addEventListener('change', function(event) {
      var file = event.target.files[0];
      if (file) {
        var reader = new FileReader();
        reader.onload = function(e) {
          try {
            var gameState = JSON.parse(e.target.result);
            self.emit("loadGameFromFile", gameState);
          } catch (error) {
            console.error("File loading failed:", error);
            self.emit("showMessage", "�浵�ļ���ʽ����");
          }
        };
        reader.readAsText(file);
      }
      // �����ļ����룬����ѡ��ͬһ�ļ�
      event.target.value = '';
    });
  }

  // Listen to swipe events
  var touchStartClientX, touchStartClientY;
  var gameContainer = document.getElementsByClassName("game-container")[0];

  gameContainer.addEventListener("touchstart", function (event) {
    if (event.touches.length > 1) return;

    touchStartClientX = event.touches[0].clientX;
    touchStartClientY = event.touches[0].clientY;
    event.preventDefault();
  });

  gameContainer.addEventListener("touchmove", function (event) {
    event.preventDefault();
  });

  gameContainer.addEventListener("touchend", function (event) {
    if (event.touches.length > 0) return;

    var dx = event.changedTouches[0].clientX - touchStartClientX;
    var absDx = Math.abs(dx);

    var dy = event.changedTouches[0].clientY - touchStartClientY;
    var absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) > 10) {
      // (right : left) : (down : up)
      self.emit("move", absDx > absDy ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
    }
  });
};

KeyboardInputManager.prototype.restart = function (event) {
  event.preventDefault();
  this.emit("restart");
};