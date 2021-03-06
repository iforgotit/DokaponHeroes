var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;
var MongoClient = require('mongodb').MongoClient,
  assert = require('assert');
var ObjectId = require('mongodb').ObjectID;
var bcrypt = require('bcrypt');

var numUsersLobby = 0;
var url = 'mongodb://localhost:27017/dkmmc';
var tourneyMode = false;

var WaitForMore = Date.now() + 1000;

function setWaitForMore() {
  WaitForMore = Date.now() + 1000;
}

function getWaitforMore() {
  return WaitForMore;
}

http.listen(80, function () {
  console.log('listening on *:80');
});

//sets default page
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/public/index.html');
});

//sets file repository
app.use(express.static('public'));

//opens root socket connection
io.on('connection', function (socket) {

  socket.on('createUser', function (user) {
    // Use connect method to connect to the server
    MongoClient.connect(url, function (err, db) {
      assert.equal(null, err);

      searchUserCreate(db, user, function () {
        db.close();
      });
    });
  });

  var searchUserCreate = function (db, user, callback) {
    // Get the documents collection
    var collection = db.collection('users');
    // Find some documents
    collection.find({
      'email': user.email
    }).toArray(function (err, eUser) {
      assert.equal(err, null);
      if (!eUser[0]) {
        insertUser(db, user, function () {
          db.close();
        });
      } else {
        socket.emit('createFailure');
        callback(eUser);
      }

    });
  }
  var insertUser = function (db, user, callback) {
    // Get the documents collection
    var collection = db.collection('users');
    // Insert some documents
    bcrypt.hash(user.password, 10, function (err, hash) {
      collection.insert({
        'email': user.email,
        'dname': user.dName,
        'password': hash
      }, function (err, result) {
        assert.equal(err, null);
        socket.emit('createSuccess');
        callback(result);
      });
    });
  };

  socket.on('authenticate', function (user) {

    // Use connect method to connect to the server
    MongoClient.connect(url, function (err, db) {
      assert.equal(null, err);

      findUser(db, user, function () {
        db.close();
      });
    });

    var findUser = function (db, iUser, callback) {
      // Get the users collection
      var collection = db.collection('users');
      // Find some user
      collection.find({
        'email': iUser.email
      }).toArray(function (err, user) {
        assert.equal(err, null);
        if (user[0]) {
          if (bcrypt.compareSync(iUser.password, user[0].password)) {
            userJSON = {
              '_id': user[0]._id,
              'dName': user[0].dname,
              'email': user[0].email
            }
            socket.emit('userJSON', userJSON);
          } else {
            socket.emit('unsuccessful');
          }
        } else {
          socket.emit('unsuccessful');
        }
        callback();
      });
    };
  });

  socket.on('saveSettings', function (settingsJSON) {
    tourneyMode = settingsJSON.tourneyMode;
    socket.emit('saved');
  });

  socket.on('permissions', function (userID) {

    // Use connect method to connect to the server
    MongoClient.connect(url, function (err, db) {
      assert.equal(null, err);

      findUserPermissions(db, userID, function () {
        db.close();
      });
    });

    var findUserPermissions = function (db, iUserID, callback) {
      // Get the users collection
      var collection = db.collection('users');
      // Find some user
      collection.find({
        _id: ObjectId(iUserID)
      }).toArray(function (err, user) {
        assert.equal(err, null);
        socket.emit('permission', user[0]);
        callback();
      });
    };
  });

  socket.on('newUser', function () {
    io.emit('attendance');
  });

  socket.on('checkin', function (dName) {
    io.emit('buildUser', dName);
  });

  socket.on('disconnect', function () {
    io.emit('attendance');
  });

  socket.on('msg', function (msg) {
    io.emit('chat', msg);
  });
});

//opens lobby namespace
var lobbynsp = io.of('/lobby');
var roleSelected = new Object();

lobbynsp.on('connection', function (socket) {

  var t = setInterval(lobbyStatus, 1000);

  numUsersLobby++;
  console.log('User count : ' + numUsersLobby);

  socket.on('newUser', function () {
    lobbynsp.emit('attendance');
  });

  socket.on('checkAdmin', function (userID) {

    // Use connect method to connect to the server
    MongoClient.connect(url, function (err, db) {
      assert.equal(null, err);

      findUserPermissions(db, userID, function () {
        db.close();
      });
    });

    var findUserPermissions = function (db, iUserID, callback) {
      // Get the users collection
      var collection = db.collection('users');
      // Find some user
      collection.find({
        _id: ObjectId(iUserID)
      }).toArray(function (err, user) {
        assert.equal(err, null);
        if (user[0].isAdmin == "true") {
          socket.emit("admin");
        }
        callback();
      });
    };
  });

  socket.on('checkin', function (dName, role) {
    var userString = "";
    if (role != false) {
      userString = dName + " - " + role;
      lobbynsp.emit('buildUser', userString);
      roleSelected[socket.id] = true;
    } else {
      lobbynsp.emit('buildUser', dName);
      roleSelected[socket.id] = false;
    }
  });

  socket.on('disconnect', function () {
    lobbynsp.emit('attendance');
    delete roleSelected[socket.id];
    numUsersLobby--;
    clearInterval(t);
    if (numUsersLobby == 0) {
      setWaitForMore();
    }
  });

  socket.on('msg', function (msg) {
    lobbynsp.emit('chat', msg);
  });

  socket.on('killTimer', function () {
    //This kills the timer that would reenable the start button
    clearInterval(t);
  });

  socket.on('roleCall', function (pJSON) {

    switch (pJSON.pClass) {
      case "Magii":
        pJSON.hp = 20;
        pJSON.strength = 1;
        pJSON.magic = 3;
        pJSON.cunning = 1;
        break;
      case "Warrior":
        pJSON.hp = 20;
        pJSON.strength = 3;
        pJSON.magic = 1;
        pJSON.cunning = 1;
        break;
      case "Rogue":
        pJSON.hp = 20;
        pJSON.strength = 2;
        pJSON.magic = 2;
        pJSON.cunning = 2;
        break;
      default:
        pJSON.hp = 0;
        pJSON.strength = 0;
        pJSON.magic = 0;
        pJSON.cunning = 0;
    }

    pJSON.attackActions = ["Reckless Attack", "Defensive Attack", "Magic Missile", "Focus"];

    pJSON.defenseActions = ["Counter Attack", "Block", "Resist", "Retreat"];

    MongoClient.connect(url, function (err, db) {
      assert.equal(null, err);
      addPlayer(db, pJSON, function () {
        db.close();
      });
    });

    var addPlayer = function (db, pJSON, callback) {
      // Get the game collection
      var collection = db.collection('game');
      // Update game with players passing roleClass
      collection.update({
          _id: ObjectId(pJSON.gID)
        }, {
          $push: {
            players: {
              pID: pJSON.pID,
              dName: pJSON.dName,
              "pClass": pJSON.pClass,
              "hp": pJSON.hp,
              "strength": pJSON.strength,
              "magic": pJSON.magic,
              "cunning": pJSON.cunning,
              "attackActions": pJSON.attackActions,
              "defenseActions": pJSON.defenseActions,
              "focusDecay": [],
              "isDead": false,
              "star": [],
              x: (Math.floor((Math.random() * pJSON.size))),
              y: (Math.floor((Math.random() * pJSON.size))),
              loaded: false
            }
          }
        },
        function (err, result) {
          assert.equal(err, null);
          callback();
        });
    };
  });

  socket.on('startGame', function () {
    clearInterval(t);

    lobbynsp.emit('ggTimer');

    // Use connect method to connect to the server
    MongoClient.connect(url, function (err, db) {
      assert.equal(null, err);
      createGame(db, function (gameData) {
        db.close();
        gameThread(gameData);
      });
    });

    var createGame = function (db, callback) {
      var playerCount = 0;
      for (let i = 0; i < (Object.keys(roleSelected).length); i++) {
        var r = Object.keys(roleSelected)[i];
        let rS = roleSelected[r];
        if (rS != false) {
          playerCount++;
        }
      }
      var gridSize = Math.ceil(Math.sqrt(playerCount * 6));
      // Get the game collection
      var collection = db.collection('game');
      // Insert new game
      collection.insert({
        'startTime': Date.now(),
        'size': gridSize
      }, function (err, result) {
        assert.equal(err, null);
        gameData = {
          '_id': result.ops[0]._id,
          'startTime': result.ops[0].startTime,
          'size': result.ops[0].size
        }
        lobbynsp.emit('gameID', gameData);
        callback(gameData);
      });
    };
  });

  function lobbyStatus() {
    var status;
    var timeLeft = Math.round((getWaitforMore() - Date.now()) / 1000);

    if (tourneyMode == true) {
      status = "Tournament Mode Enabled Wait for Administrator";
    } else if (numUsersLobby == 0) {
      status = "Dead";
    } else if (numUsersLobby == 1) {
      status = "Not Enough Players (" + numUsersLobby + ")";
    } else if (Date.now() < getWaitforMore()) {
      status = "Wait " + timeLeft + " seconds for some more players";
    } else {
      status = "Start Game";
    }
    lobbynsp.emit('status', status);
  }
});

var ingame = io.of('/ingame');

function gameThread(gameData) {

  var gameID = ObjectId(gameData._id).toString();
  var gameTime = gameData.startTime;

  function getGameID() {
    return gameID;
  }

  function getGameTime() {
    return gameTime;
  }

  function setGameTime(iGameTime) {
    gameTime = iGameTime + 15000;
  }

  var loading = setInterval(checkPlayers, 1000);
  var timeOut = 0;

  function checkPlayers() {
    timeOut++;

    MongoClient.connect(url, function (err, db) {
      assert.equal(null, err);
      getGameInit(db, getGameID(), function (gameData) {
        db.close();
        let playersStatus = gameData.players;
        let gridSize = gameData.size;
        var readyCheck = true;

        for (let i = 0; i < playersStatus.length; i++) {
          if (playersStatus[i].loaded == false) {
            readyCheck = false;
          }
        }

        if (readyCheck == true || timeOut > 120) {
          ingame.in(gameData._id).emit("allLoaded");
          gamePlay(playersStatus, gridSize);
          clearInterval(loading);
        }

      });
    });

    var getGameInit = function (db, iGameID, callback) {
      // Get the turn collection
      var collection = db.collection('game');
      // Find turn
      collection.find({
        _id: ObjectId(iGameID)
      }).toArray(function (err, result) {
        assert.equal(err, null);
        callback(result[0]);
      });
    }
  }

  function gamePlay(players, size) {

    var t = setInterval(turnTime, 1000);
    var c = 5;
    var turnCount = 0;
    var inactive = 0;
    var starGrid;

    function setStarGrid(iStarGrid) {
      starGrid = iStarGrid;
    }

    function findPlayer(value) {
      for (let i = 0; i < players.length; i++) {
        if (players[i].pID == value) {
          return i;
        }
      }
    }

    function findPlayerInit(value) {
      for (let i = 0; i < players.length; i++) {
        if (players[i].pID == value) {
          if (players[i].initiative) {
            return players[i].initiative;
          } else {
            return 1;
          }

        }
      }
    }

    function createStars() {
      let starCount = players.length * 2;
      let pLoc = new Array();

      //create a grid array
      let grid = [];
      for (let j = 0; j < size; j++) {
        let row = [];
        for (let r = 0; r < size; r++) {
          row[r] = {
            star: new Array()
          };
        }
        grid[j] = row;
      }

      for (let i = 0; i < players.length; i++) {
        grid[players[i].x][players[i].y].player = true;
      }

      for (let i = 0; i < starCount; i++) {
        let starX = Math.floor((Math.random() * size))
        let starY = Math.floor((Math.random() * size))
        if (!grid[starX][starY].player && grid[starX][starY].star.length == 0) {
          let starVar = {
            'x': starX,
            'y': starY,
            'id': i
          };
          grid[starX][starY].star.push(i);

          ingame.in(gameData._id).emit('objective', starVar);

          //staggers star generation should not exceed 2 second
          let emitWait;
          if (i == 0) {
            emitWait = 0;
          } else {
            emitWait = (2 - (1 / i)) * 1000;
          }

          setTimeout(function () {
            ingame.in(gameData._id).emit('newStar', starVar);
          }, emitWait)

        } else {
          i--;
        }
      }
      setStarGrid(grid);
    }

    function gameResults() {
      let alive = new Array();
      let starGoal = (((players.length * 2) / 4) * 3);

      for (let i = 0; i < players.length; i++) {
        let player = players[i];
        if (player.star.length >= starGoal) {
          return player.dName + " wins!";
        }
        if (player.isDead == false) {
          alive.push(player.dName);
        }
      }

      if (alive.length > 1) {
        return false;
      } else if (alive.length == 1) {
        return alive[0] + " wins!";
      } else {
        return "draw";
      }
    }

    function updatePlayerMoves(moveTurn) {
      for (let i = 0; i < moveTurn.length; i++) {
        let player = players[findPlayer(moveTurn[i].playerID)];
        player.x = moveTurn[i].target.x;
        player.y = moveTurn[i].target.y;
      }
      ingame.in(gameData._id).emit('move', moveTurn);
    }

    function setDefense(iDefense) {
      //for each player
      for (let i = 0; i < players.length; i++) {
        //check the defense array
        players[i].defense = undefined;
        for (let j = 0; j < iDefense.length; j++) {
          //if that player is in the defense array
          if (players[i].pID == iDefense[j].playerID) {
            //if that array is not empty
            if (iDefense[j].defense != undefined) {
              players[i].defense = players[i].defenseActions[iDefense[j].defense];
            }
          }
        }
      }
    }

    function performAttack(attackARAY) {
      let i = 0;

      singleCombat();

      function singleCombat() {
        let playerIndex = findPlayer(attackARAY[i].playerID)
        let player = players[playerIndex];
        let advsIndex = findPlayer(attackARAY[i].advs);
        let advs = players[advsIndex];

        let playerAttack = player.attackActions[attackARAY[i].attackAction];
        let advsDefense = advs.defense;
        let combat;
        let damage;
        let dodge = advs.cunning - player.cunning;
        let attackType;

        if (dodge < 0) {
          dodge = 0
        } else {
          dodge = ((dodge * 5) + 5);
        }

        let hitchance = Math.floor((Math.random() * 100) + 1);

        if (player.isDead == false && (advs.isDead == false || playerAttack == "Focus")) {
          if (playerAttack == "Focus") {
            let focusPower = player.magic;

            players[playerIndex].focusDecay[turnCount + 3] = focusPower;

            players[playerIndex].strength += focusPower;
            players[playerIndex].magic += focusPower;
            players[playerIndex].cunning += focusPower;
            damage = "";
            attackType = "focus";
            combat = player.dName + " reflects on himself. Why is he so angry all the time?";
          } else if (player.initiative < advs.initiative && advsDefense == "Retreat") {
            damage = "";
            attackType = "runaway";
            combat = advs.dName + " ran away";
          } else {
            switch (playerAttack) {
              case "Reckless Attack":
                damage = player.strength * 3;
                dodge = dodge * 1.2;
                if (advs.defense == "Counter Attack") {
                  combat = "OMG you just played yourself! " + advs.dName + " does " + damage + " to " + player.dName;
                  players[playerIndex].hp -= damage;
                  attackType = "riposte";
                } else {
                  if (hitchance > dodge) {
                    if (advs.defense == "Block") {
                      damage = damage / 1.6;
                    }
                    damage = Math.ceil(damage);
                    combat = player.dName + "'s " + playerAttack + " does " + damage + " to " + advs.dName;
                    players[advsIndex].hp -= damage;
                    attackType = "physical";
                  } else {
                    combat = advs.dName + " put on his juke shoes and dodged " + player.dName + "'s attack";
                    damage = 0;
                    attackType = "dodge";
                  }
                }
                break;
              case "Defensive Attack":
                damage = player.strength;
                if (hitchance > dodge) {
                  if (advs.defense == "Block") {
                    damage = damage / 2;
                  }
                  damage = Math.ceil(damage);
                  combat = player.dName + "'s " + playerAttack + " does " + damage + " to " + advs.dName;
                  players[advsIndex].hp -= damage;
                  attackType = "physical";
                } else {
                  combat = advs.dName + " put on his juke shoes and dodged " + player.dName + "'s attack";
                  damage = 0;
                  attackType = "dodge";
                }
                break;
              case "Magic Missile":
                damage = player.magic * 2;
                if (advs.defense == "Resist") {
                  damage = damage - advs.magic;
                }
                damage = Math.ceil(damage);
                combat = player.dName + "'s " + playerAttack + " does " + damage + " to " + advs.dName;
                players[advsIndex].hp -= damage;
                attackType = "magical";
                break;
              default:
                combat = "Something went wrong idk"
                break;
            }
          }

          if (players[playerIndex].hp <= 0) {
            dead(playerIndex);
            pDied = true;
          }
          if (players[advsIndex].hp <= 0) {
            dead(advsIndex);
            aDied = true;
          }
          let pJSON = {
            "dName": player.dName,
            "pClass": player.pClass,
            x: player.x,
            y: player.y
          }
          let aJSON = {
            "dName": advs.dName,
            "pClass": advs.pClass,
            x: advs.x,
            y: advs.y
          }
          ingame.in(gameData._id).emit('attack', combat, pJSON, aJSON, damage, attackType);
        } else {
          i++;
          if (i >= (attackARAY.length)) {
            t = setInterval(turnTime, 1000);
            return;
          } else {
            singleCombat();
            return;
          }
        }
        i++;
        if (i >= (attackARAY.length)) {
          setTimeout(function () {
            t = setInterval(turnTime, 1000);
          }, 5500);
        } else {
          setTimeout(singleCombat, 5500);
        }
      }
    }

    function dead(playerIndex) {
      players[playerIndex].isDead = true;
      let rip = players[playerIndex].dName + " is no longer with us";
      ingame.in(gameData._id).emit('died', rip, players[playerIndex].pID);
      players[playerIndex].inCombat = [];
      removeFromCombat(players[playerIndex].pID);
      let starCount = players[playerIndex].star.length;
      for (let i = 0; i < starCount; i++) {
        dropStar(playerIndex);
      };
    }

    function removeFromCombat(playerID) {
      //loop through players
      for (let i = 0; i < players.length; i++) {
        //if they are alive
        if (players[i].isDead == false) {
          //loop through combat array
          for (let j = 0; j < players[i].inCombat.length; j++) {
            if (players[i].inCombat[j] == playerID) {
              players[i].inCombat.splice(j, 1);
              j--;
            };
          };
        };
      };
    }

    function checkForCombat() {
      for (let n = 0; n < players.length; n++) {
        let pX = players[n];
        let pXID = players[n].pID;

        if (pX.focusDecay[turnCount] != undefined) {
          players[n].strength -= pX.focusDecay[turnCount];
          players[n].magic -= pX.focusDecay[turnCount];
          players[n].cunning -= pX.focusDecay[turnCount];
        }

        pX.inCombat = new Array();

        if (pX.isDead == false) {
          for (let i = 0; i < players.length; i++) {
            if (i != n) {
              let pY = players[i];
              let pYID = players[i].pID;
              if (pY.isDead == false) {
                if (pX.x == pY.x && pX.y == pY.y) {
                  pX.inCombat.push(pYID);
                };
              };
            };
          };
          if (pX.inCombat) {
            pX.initiative = Math.random() + pX.cunning;
          };
        };
      };
    }

    function checkStar() {
      for (let n = 0; n < players.length; n++) {
        let pX = players[n];
        let starCheck = starGrid[pX.x][pX.y].star;
        let starCount = starCheck.length;
        if (pX.inCombat.length == 0 && starCount != 0 && pX.isDead == false) {
          for (let i = 0; i < starCount; i++) {
            let iStar = starGrid[pX.x][pX.y].star.shift();
            ingame.in(gameData._id).emit('getStar', iStar);
            players[n].star.push(iStar);
          }
        }
      }
    }

    function dropStar(playerIndex) {
      let pLocX = players[playerIndex].x;
      let pLocY = players[playerIndex].y;
      let iStar = players[playerIndex].star.shift();
      starGrid[pLocX][pLocY].star.push(iStar);
      let starVar = {
        'x': pLocX,
        'y': pLocY,
        'id': iStar
      };
      ingame.in(gameData._id).emit('dropStar', starVar);
    }

    function determineOrder(pData, aData) {
      let cArray = new Array();

      cArray.push({
        'pID': pData.pID,
        'init': findPlayerInit(pData.pID)
      })

      for (let i = 0; i < aData.length; i++) {
        cArray.push({
          'pID': aData[i],
          'init': findPlayerInit(aData[i])
        })
      }

      var sortedCArray = cArray.sort(function (a, b) {
        return parseFloat(b.init) - parseFloat(a.init);
      });

      return sortedCArray.findIndex(f => f.pID === pData.pID);
    }

    function stringifyNumber(n) {
      var special = ['Zeroth', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelvth', 'Thirteenth', 'Fourteenth', 'Fifteenth', 'Sixteenth', 'Seventeenth', 'Eighteenth', 'Nineteenth'];
      var deca = ['Twent', 'Thirt', 'Fourt', 'Fift', 'Sixt', 'Sevent', 'Eight', 'Ninet'];
      if (n < 20) return special[n];
      if (n % 10 === 0) return deca[Math.floor(n / 10) - 2] + 'ieth';
      return deca[Math.floor(n / 10) - 2] + 'y-' + special[n % 10];
    }

    function gameStateSave(turnCount) {
      let gameState = new Object();

      gameState.turnCount = turnCount;
      gameState.players = players;
      // Use connect method to connect to the server
      MongoClient.connect(url, function (err, db) {
        assert.equal(null, err);
        saveGameState(db, gameState, function () {
          db.close();
        });
      });
    };

    var saveGameState = function (db, gameState, callback) {
      // Get the game collection
      var collection = db.collection('game');
      // Update game with players passing roleClass
      collection.update({
          _id: ObjectId(getGameID())
        }, {
          $push: {
            gameState
          }
        },
        function (err, result) {
          assert.equal(err, null);
          callback();
        });
    }


    function turnTime() {
      c--;
      if (c < 0) {
        c = 16;

        ingame.in(gameData._id).emit('endTurn');

        MongoClient.connect(url, function (err, db) {
          assert.equal(null, err);

          getTurn(db, function (turnDB) {
            db.close();
            //turnCount++;
            if (turnDB.length != 0) {
              let moveARAY = new Array();
              let attackARAY = new Array();
              let defendARAY = new Array();

              for (let i = 0; i < turnDB.length; i++) {
                switch (turnDB[i].actionType) {
                  case "move":
                    moveARAY.push({
                      'playerID': turnDB[i].playerID,
                      'stageX': turnDB[i].stageX,
                      'target': turnDB[i].target
                    });
                    break;
                  case "attack":
                    attackARAY.push({
                      'playerID': turnDB[i].playerID,
                      'attackAction': turnDB[i].aAction,
                      'advs': turnDB[i].advsID,
                      'initiative': findPlayerInit(turnDB[i].playerID)
                    });
                    break;
                  case "defend":
                    defendARAY.push({
                      'playerID': turnDB[i].playerID,
                      'defense': turnDB[i].dAction
                    });
                    break;
                  case "retreat":
                    let xRetreat = Math.floor((Math.random() * turnDB[i].gridSize));
                    let yRetreat = Math.floor((Math.random() * turnDB[i].gridSize));
                    let playerIndex = findPlayer(turnDB[i].playerID);
                    if (players[playerIndex].star.length >= 1) {
                      dropStar(playerIndex);
                    };
                    defendARAY.push({
                      'playerID': turnDB[i].playerID,
                      'defense': turnDB[i].dAction
                    });
                    moveARAY.push({
                      'playerID': turnDB[i].playerID,
                      'stageX': xRetreat * 100,
                      'target': {
                        'x': xRetreat,
                        'y': yRetreat
                      }
                    });
                    break;
                  default:
                    break;
                }
              }

              setDefense(defendARAY);

              if (attackARAY.length != 0) {
                clearInterval(t);
                attackARAY.sort(function (a, b) {
                  return b.initiative - a.initiative;
                });
                performAttack(attackARAY);
              }

              if (moveARAY.length != 0) {
                updatePlayerMoves(moveARAY);
              }

              checkForCombat();
              inactive = 0;
              turnCount++;

              ingame.in(gameData._id).emit('gameTime', 'Taking turn now');
            } else {
              inactive++;
              if (inactive > 3) {
                clearInterval(t);
                ingame.in(gameData._id).emit('gameTime', 'GAME OVER!');
                ingame.in(gameData._id).emit('result', 'Draw!');
              }
            }
            gameStateSave(turnCount);
          });
        });

      } else if (c > 15) {
        ingame.in(gameData._id).emit('gameTime', 'Taking turn now');
      } else if (c == 15) {
        ingame.in(gameData._id).emit('gameTime', c);

        checkStar();

        let gridData = new Array();

        for (let i = 0; i < players.length; i++) {
          let t1 = players[i];
          let t2;

          t2 = {
            'x': t1.x,
            'y': t1.y
          }

          var order = 0;
          var cardOrder = "";

          if (t1.inCombat.length > 0) {
            order = (determineOrder(t1, t1.inCombat) + 1);
            cardOrder = stringifyNumber(order);
          }

          t1.order = order;

          let combatin = new Array();

          for (let a = 0; a < t1.inCombat.length; a++) {
            let advs = players[findPlayer(t1.inCombat[a])];
            if (advs.isDead == false) {
              let advsData = {
                'pID': advs.pID,
                'dName': advs.dName,
                'hp': advs.hp,
                'strength': advs.strength,
                'magic': advs.magic,
                'cunning': advs.cunning
              }
              combatin.push(advsData);
            }
          }

          gridData.push({
            'playerID': t1.pID,
            'dName': t1.dName,
            'hp': t1.hp,
            'strength': t1.strength,
            'magic': t1.magic,
            'cunning': t1.cunning,
            'star': t1.star.length,
            'target': t2,
            //'order': order,
            //'initiative':t1.initiative,
            'cardinal': cardOrder,
            'inCombat': combatin,
            'isDead': t1.isDead
          });
        }
        var winner = gameResults();

        if (winner == false) {
          ingame.in(gameData._id).emit('setTurn', turnCount, gridData);
        } else {
          clearInterval(t);
          ingame.in(gameData._id).emit('setTurn', turnCount, gridData);
          ingame.in(gameData._id).emit('gameTime', 'GAME OVER!');
          ingame.in(gameData._id).emit('result', winner);
        }

      } else if (turnCount == 0) {
        ingame.in(gameData._id).emit('gameTime', 'Setting up game');
        if (c == 3) {
          createStars();
        };
      } else {
        ingame.in(gameData._id).emit('gameTime', c);
      }
    }

    var getTurn = function (db, callback) {
      // Get the turn collection
      var collection = db.collection('turn');
      // Find turn
      collection.find({
        gameID: getGameID(),
        turn: turnCount
      }).toArray(function (err, turnDB) {
        assert.equal(err, null);
        callback(turnDB);
      });
    }
  }
}


ingame.on('connection', function (socket) {

  var gameID;
  var turnComplete = 0;

  function getGameID() {
    return gameID;
  }

  function setGameID(iGameID) {
    gameID = iGameID;
  }

  socket.on('disconnect', function () {});

  socket.on('gameID', function (iGameID, pID) {
    setGameID(iGameID);
    socket.join(iGameID);

    // Use connect method to connect to the server
    MongoClient.connect(url, function (err, db) {
      assert.equal(null, err);

      setLoaded(db, iGameID, pID, function () {
        db.close();
      });
    });

    var setLoaded = function (db, iGameID, iPID, callback) {
      // Get the game collection
      var collection = db.collection('game');
      // Find game      
      if (ObjectId.isValid(iGameID)) {
        collection.findAndModify({
            _id: ObjectId(iGameID),
            "players.pID": iPID
          }, {
            size: 1
          }, {
            "$set": {
              "players.$.loaded": true
            }
          },
          function (err, result) {
            assert.equal(err, null);
            if (result) {
              var game = result.value;
              var gameJSON = {
                "size": game.size,
                "players": game.players
              }
              socket.emit('gameJSON', gameJSON)
            } else {
              socket.emit('invalidGame');
            }
            callback();
          });
      } else {
        socket.emit('invalidGame');
      }
    };
  });

  socket.on('turnData', function (turnEvent) {
    turnEvent.gameID = getGameID();
    // Use connect method to connect to the server
    MongoClient.connect(url, function (err, db) {
      assert.equal(null, err);
      addPlayerTurn(db, turnEvent, function (turnWeight) {
        db.close();
        turnComplete += turnWeight;
      });
    });
  });

  var addPlayerTurn = function (db, turnEvent, callback) {
    // Get the turn collection
    var collection = db.collection('turn');
    // Update turn with most recent data
    collection.update({
        'gameID': turnEvent.gameID,
        'turn': turnEvent.turn,
        'playerID': turnEvent.playerID,
        'actionType': turnEvent.actionType
      }, turnEvent, {
        upsert: true
      },
      function (err, result) {
        assert.equal(err, null);
        assert.equal(1, result.result.n);
        callback(turnEvent.weight);
      });
  }
});