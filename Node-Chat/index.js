var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;
var MongoClient = require('mongodb').MongoClient,
  assert = require('assert');
var bcrypt = require('bcrypt');

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

  socket.on('createUser', function (user) {

    var url = 'mongodb://localhost:27017/dkmmc';
    // Use connect method to connect to the server
    MongoClient.connect(url, function (err, db) {
      assert.equal(null, err);
      console.log("Connected correctly to server");

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
        console.log("Found the following records");
        console.log(eUser);
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
        console.log("Inserted user into the collection");
        callback(result);
      });
    });
  };

  socket.on('authenticate', function (user) {

    var url = 'mongodb://localhost:27017/dkmmc';
    // Use connect method to connect to the server
    MongoClient.connect(url, function (err, db) {
      assert.equal(null, err);
      console.log("Connected correctly to server");

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
            socket.emit('userJSON', user[0]);
          } else {
            socket.emit('unsuccessful');
          }
        } else {
          socket.emit('unsuccessful');
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

  socket.on('startGame', function () {
    lobbynsp.emit('ggTimer', 'Fuck you Rick');
  });

  var t = setInterval(lobbyStatus, 1000);

  function lobbyStatus() {
    var status;

    if (numUsersLobby == 0) {
      status = "Dead";
      waitformore = 0;
    } else if (numUsersLobby == 1) {
      status = "Not Enough Players (" + numUsersLobby + ")";
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