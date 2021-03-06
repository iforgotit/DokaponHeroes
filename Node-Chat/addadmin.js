var MongoClient = require('mongodb').MongoClient,
  assert = require('assert');
var ObjectId = require('mongodb').ObjectID;

// Connection URL
var url = 'mongodb://localhost:27017/dkmmc';
// Use connect method to connect to the server
MongoClient.connect(url, function (err, db) {
  assert.equal(null, err);
  console.log("Connected correctly to server");

  findDocuments(db, function () {
    db.close();
  });
});


var findDocuments = function (db, callback) {
  // Get the documents collection
  var collection = db.collection('users');
  // Find some documents
  collection.update({
    email: "nmorales@flourishdev.com"
  }, {
    $set: {
      isAdmin: "true"
    }
  })
}