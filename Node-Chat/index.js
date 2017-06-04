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

var WaitForMore = Date.now() + 15000;

function setWaitForMore() {
  WaitForMore = Date.now() + 15000;
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

  console.log('a user connected to root');

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

  console.log('user connected to lobby');
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
              startX: (Math.floor((Math.random() * 4)) * 100),
              startY: (Math.floor((Math.random() * 4)) * 100),
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
      createGame(db, function () {
        db.close();
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
        callback(result);
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

ingame.on('connection', function (socket) {

  var gameID;
  var gameTime = 0;

  function getGameID() {
    return gameID;
  }

  function setGameID(iGameID) {
    gameID = iGameID;
  }

  function getGameTime() {
    return gameTime;
  }

  function setGameTime(iGameTime) {
    gameTime = iGameTime + 15000;
  }

  socket.on('disconnect', function () {
    clearInterval(t);
  });

  socket.on('gameID', function (iGameID, pID) {
    setGameID(iGameID);
    socket.join(iGameID);

    // Use connect method to connect to the server
    MongoClient.connect(url, function (err, db) {
      assert.equal(null, err);

      getGameTimeDB(db, iGameID, pID, function () {
        db.close();
      });
    });

    var getGameTimeDB = function (db, iGameID, iPID, callback) {
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
              setGameTime(game.startTime);
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

  var t = setInterval(turnTime, 1000);

  socket.on('turnData', function (turnEvent) {
    turnEvent.endTime = getGameTime();
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
        endTime: getGameTime(),
        heroName: turnEvent.playerID
      }, turnEvent, {
        upsert: true
      },
      function (err, result) {
        assert.equal(err, null);
        assert.equal(1, result.result.n);
        callback();
      });
  }

  function turnTime() {
    var timeLeft = Math.round((getGameTime() - Date.now()) / 1000);

    if (timeLeft < 0) {
      MongoClient.connect(url, function (err, db) {
        assert.equal(null, err);

        getTurn(db, function () {
          db.close();
          setGameTime(getGameTime() + 3000);
        });
      });

    } else if (timeLeft > 15) {
      socket.emit('gameTime', 'Taking turn now');
    } else {
      socket.emit('gameTime', timeLeft);
    }

  }
  var getTurn = function (db, callback) {
    // Get the turn collection
    var collection = db.collection('turn');
    // Find turn
    collection.find({
      gameID: getGameID(),
      endTime: getGameTime()
    }).toArray(function (err, turnDB) {
      assert.equal(err, null);
      if (turnDB.length != 0) {
        var endTurnData = turnDB;
        socket.emit('endTurn', endTurnData);
      }
      callback();
    });
  }
});