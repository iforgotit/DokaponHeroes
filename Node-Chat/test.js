var MongoClient = require('mongodb').MongoClient,
    assert = require('assert');
var ObjectId = require('mongodb').ObjectID;
var url = 'mongodb://localhost:27017/dkmmc';

MongoClient.connect(url, function (err, db) {
    getGameTimeDB(db, function () {
        db.close();
    });
});

var getGameTimeDB = function (db, callback) {
    // Get the game collection
    var collection = db.collection('game');
    // Find game      
    collection.findAndModify(
            {_id : ObjectId("593321507f37c811905028a5"),"players.pID": "5929abd3c494db36f4fc5616"},
            {startTime:1},
            {"$set" : {"players.$.loaded": true}
            },
        function (err, game) {
            assert.equal(err, null);
            console.log(JSON.stringify(game));
            callback();
        }
    )
};