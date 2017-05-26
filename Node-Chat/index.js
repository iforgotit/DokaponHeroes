var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;
var mongodb = require('./mongo');
var MongoClient = require('mongodb').MongoClient,
  assert = require('assert');

var numUsersLobby = 0;
var waitformore = 0;

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

  console.log('a user connected');

  socket.on('user', function (user) {

    var url = 'mongodb://localhost:27017/dkmmc';
    // Use connect method to connect to the server
    MongoClient.connect(url, function (err, db) {
      assert.equal(null, err);
      console.log("Connected correctly to server");

      findDocuments(db, user.email, function () {
        db.close();
      });
    });

    var findDocuments = function (db, email, callback) {
      // Get the documents collection
      var collection = db.collection('users');
      // Find some documents
      collection.find({
        'email': email
      }).toArray(function (err, docs) {
        assert.equal(err, null);
        if (docs[0]) {
          console.log("4 : " + docs[0]._id);
          socket.emit('userJSON', docs[0]);
          callback(docs[0]._id);
        } else {
          console.log("1 : " + JSON.stringify(user));
          typeof mongodb.insertUser(user, function () {
            console.log("2 : " + JSON.stringify(user));
            findDocuments(db, user.email, function () {
              console.log("3 : " + user.email);
              db.close();
            });
          });
        }
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
    console.log('user disconnected');
    io.emit('attendance');
  });

  socket.on('msg', function (msg) {
    console.log(msg);
    io.emit('chat', msg);
  });
});

//opens lobby namespace
var lobbynsp = io.of('/lobby');

lobbynsp.on('connection', function (socket) {

  console.log('user connected lobby');
  numUsersLobby++;
  console.log('User count : ' + numUsersLobby);

  socket.on('newUser', function () {
    lobbynsp.emit('attendance');
  });

  socket.on('checkin', function (dname) {
    console.log("that just happened");
    lobbynsp.emit('buildUser', dname);
  });

  socket.on('disconnect', function () {
    console.log('User count : ' + numUsersLobby);
    lobbynsp.emit('attendance');
    numUsersLobby--;
  });

  socket.on('msg', function (msg) {
    console.log(msg);
    lobbynsp.emit('chat', msg);
  });

  socket.on('startGame',function () {
    lobbynsp.emit('ggTimer', 'Fuck you Rick');
  });

  var t = setInterval(lobbyStatus, 1000);

  function lobbyStatus() {
    var status;

    if (numUsersLobby == 0) {
      status = "Dead";
      waitformore = 0;
    } else if (numUsersLobby == 1) {
      status = "Not Enough Players (" + numUsersLobby +")";
      waitformore++;
    } else if (waitformore <= 15) {
      status = "Wait " + waitformore + " seconds for some more players";
      waitformore++;
    } else {
      status = "Start Game : " + waitformore;
    }
    console.log(status);
    lobbynsp.emit('status', status);
  }
});

