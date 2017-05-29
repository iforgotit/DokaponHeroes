var MongoClient = require('mongodb').MongoClient
  , assert = require('assert');
var ObjectId = require('mongodb').ObjectID;

// Connection URL
var url = 'mongodb://localhost:27017/dkmmc';
// Use connect method to connect to the server
MongoClient.connect(url, function(err, db) {
  assert.equal(null, err);
  console.log("Connected correctly to server");

    findDocuments(db, function() {
      db.close();
    });
});


var findDocuments = function(db, callback) {
  // Get the documents collection
  var collection = db.collection('game');
  // Find some documents
  collection.find({_id:ObjectId("592b8d51bcf10301d0a09b60"),
      turn: {endTime: "1496026464522"}}).toArray(function(err, docs) {
    assert.equal(err, null);
    console.log("Found the following records");
    console.log(JSON.stringify(docs));
    callback(docs);
  });      
}