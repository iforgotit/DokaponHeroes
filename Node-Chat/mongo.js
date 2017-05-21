module.exports = {
    insertUser: function(user, callbackx) {
        var MongoClient = require('mongodb').MongoClient,
            assert = require('assert');

        // Connection URL
        var url = 'mongodb://localhost:27017/dkmmc';
        // Use connect method to connect to the server
        MongoClient.connect(url, function(err, db) {
            assert.equal(null, err);
            console.log("Connected successfully to server");

            insertDocuments(db, function() {
                    db.close();
                }, user);

            function insertDocuments(db, callback, user) {
                // Get the documents collection
                var collection = db.collection('users');
                // Insert some documents
                collection.insertMany([user], function(err, result) {
                    assert.equal(err, null);
                    assert.equal(1, result.result.n);
                    assert.equal(1, result.ops.length);
                    console.log("Inserted 1 user into the collection");
                    callback(result);
                    callbackx();
                });
            }
        });
    }
}