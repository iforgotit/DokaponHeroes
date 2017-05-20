var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;
var mongodb = require('./mongo');

app.get('/', function(req, res){
  res.sendFile(__dirname + '/public/index.html');
});

app.use(express.static('public'));

io.on('connection', function(socket){

  console.log('a user connected');

  socket.on('email', function(email){
    console.log('email: ' + email);
  });

  socket.on('user', function(user){
    console.log('JSONuser' + user);
    //typeof mongodb.insertUser(user);
    console.log("what" + typeof mongodb.findUser(user));
    //io.emit('id', typeof mongodb.findUser(user));
  });

  socket.on('dname', function(dname){
    console.log('Display Name: ' + dname);
  });

  socket.on('disconnect', function(){
    console.log('user disconnected');
  });
  
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});
