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
  collection.find(ObjectId("594996d31ef50411549f7b76")).toArray(function(err, docs) {
    assert.equal(err, null);
    console.log("Found the following records");
    console.log(JSON.stringify(docs));
    callback(docs);
  });      
}