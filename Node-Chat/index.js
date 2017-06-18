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
        'dname': user.dname,
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
              'dname': user[0].dname,
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

  socket.on('newUser', function () {
    io.emit('attendance');
  });

  socket.on('checkin', function (dname) {
    io.emit('buildUser', dname);
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

lobbynsp.on('connection', function (socket) {

  var t = setInterval(lobbyStatus, 1000);

  numUsersLobby++;
  console.log('User count : ' + numUsersLobby);

  socket.on('newUser', function () {
    lobbynsp.emit('attendance');
  });

  socket.on('checkin', function (dname) {
    lobbynsp.emit('buildUser', dname);
  });

  socket.on('disconnect', function () {
    lobbynsp.emit('attendance');
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
        pJSON.might = 1;
        pJSON.magic = 3;
        pJSON.cunning = 1;
        break;
      case "Warrior":
        pJSON.hp = 20;
        pJSON.might = 3;
        pJSON.magic = 1;
        pJSON.cunning = 1;
        break;
      case "Rogue":
        pJSON.hp = 20;
        pJSON.might = 2;
        pJSON.magic = 2;
        pJSON.cunning = 2;
        break;
      default:
        pJSON.hp = 0;
        pJSON.might = 0;
        pJSON.magic = 0;
        pJSON.cunning = 0;
    }

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
              pClass: pJSON.pClass,
              "hp": pJSON.hp,
              "might": pJSON.might,
              "magic": pJSON.magic,
              "cunning": pJSON.cunning,
              x: (Math.floor((Math.random() * 4))),
              y: (Math.floor((Math.random() * 4))),
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
      // Get the game collection
      var collection = db.collection('game');
      // Insert new game
      collection.insert({
        'startTime': Date.now()
      }, function (err, result) {
        assert.equal(err, null);
        gameData = {
          '_id': result.ops[0]._id,
          'startTime': result.ops[0].startTime
        }
        lobbynsp.emit('gameID', gameData);
        callback(gameData);
      });
    };
  });

  function lobbyStatus() {
    var status;
    var timeLeft = Math.round((getWaitforMore() - Date.now()) / 1000);

    if (numUsersLobby == 0) {
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

  function checkPlayers() {

    MongoClient.connect(url, function (err, db) {
      assert.equal(null, err);
      getGameInit(db, getGameID(), function (playersStatus) {
        db.close();
        var readyCheck = true;

        for (let i = 0; i < playersStatus.length; i++) {
          if (playersStatus[i].loaded == false) {
            readyCheck = false;
          }
        }

        if (readyCheck == true) {
          ingame.in(gameData._id).emit("allLoaded");
          gamePlay(playersStatus);
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
        callback(result[0].players);
      });
    }
  }

  function gamePlay(players) {

    var t = setInterval(turnTime, 1000);
    var c = 5;
    var turnCount = 0;
    var inactive = 0;

    function findPlayer(value) {
      for (let i = 0; i < players.length; i++) {
        if (players[i].pID == value) {
          return i;
        }
      }
    }

    function turnTime() {

      if (c < 0) {
        MongoClient.connect(url, function (err, db) {
          assert.equal(null, err);

          getTurn(db, function (turnDB) {
            db.close();
            turnCount++;
            ingame.in(gameData._id).emit('endTurn', turnDB, turnCount);

            if (turnDB.length != 0) {
              for (let i = 0; i <= (turnDB.length - 1); i++) {
                switch (turnDB[i].actionType) {
                  case "move":
                    players[findPlayer(turnDB[i].playerID)].x = turnDB[i].target.x;
                    players[findPlayer(turnDB[i].playerID)].y = turnDB[i].target.y;
                    break;
                  default:
                    break;
                }


                // for (let i = 0; i <= (turnDB.length - 1); i++) {

                //   switch (turnDB[i].actionType) {
                //     case "move":
                //       movePlayer(endTurnData[i]);
                //       if (endTurnData[i].playerID == sessionStorage.id) {
                //         availableGrids(endTurnData[i].target);
                //       };
                //       break;
                //     case "init":
                //       if (endTurnData[i].playerID == sessionStorage.id) {
                //         availableGrids(playerLocation[sessionStorage.id]);
                //       };
                //       break;
                //     default:
                //       break;
                //  }
                //}
              }
            }

            if (turnDB.length == 0) {
              inactive++;
              if (inactive > 3) {
                clearInterval(t);
                ingame.in(gameData._id).emit('gameTime', 'GAME OVER!');
              }
            } else {
              inactive = 0;
            }
            c = 16;
          });
        });
      } else if (c > 15) {
        ingame.in(gameData._id).emit('gameTime', 'Taking turn now');
      } else {
        ingame.in(gameData._id).emit('gameTime', c);
      }
      c--;
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
            startTime: 1
          }, {
            "$set": {
              "players.$.loaded": true
            }
          },
          function (err, result) {
            assert.equal(err, null);
            if (result) {
              var game = result.value;
              var gridSize = game.players.length;
              gridSize = Math.ceil(Math.sqrt(gridSize * 6));
              var gameJSON = {
                "size": gridSize,
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
      updateGameWithTurn(db, turnEvent, function () {
        db.close();
      });
    });
  });

  var updateGameWithTurn = function (db, turnEvent, callback) {
    // Get the turn collection
    var collection = db.collection('turn');
    // Update turn with most recent data
    collection.update({
        gameID: ObjectId(getGameID()),
        turn: turnEvent.turn,
        playerID: turnEvent.playerID
      }, turnEvent, {
        upsert: true
      },
      function (err, result) {
        assert.equal(err, null);
        assert.equal(1, result.result.n);
        callback();
      });
  }
});