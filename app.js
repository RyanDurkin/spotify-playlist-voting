var express = require("express"); 
var request = require("request"); 
var cors = require("cors");
var querystring = require("querystring");
var cookieParser = require("cookie-parser");

const admin = require("firebase-admin");
let serviceAccount = require("./firebaseServiceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
let db = admin.firestore();

let spotifyApiDetails = require("./spotifyApiDetails.json");

var redirect_uri = "http://localhost:8888/callback";

var port = process.env.PORT || 8888;

if(port != 8888) {
    redirect_uri = spotifyApiDetails.callback_url;
}

var generateRandomString = function (length) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return text;
};

var stateKey = "spotify_auth_state";

var app = express();

app.use(express.static(__dirname + "/public"))
    .use(cors())
    .use(cookieParser())
    .use(express.json());

app.get("/login", function (req, res) {
    var state = generateRandomString(16);
    res.cookie(stateKey, state);

    var scope = "user-read-private playlist-read-private playlist-modify-public playlist-read-collaborative playlist-modify-private";
    res.redirect("https://accounts.spotify.com/authorize?" +
        querystring.stringify({
            response_type: "code",
            client_id: spotifyApiDetails.client_id,
            scope: scope,
            redirect_uri: redirect_uri,
            state: state
        }));
});

app.get("/callback", function (req, res) {
    var code = req.query.code || null;
    var state = req.query.state || null;
    var storedState = req.cookies ? req.cookies[stateKey] : null;

    if (state === null || state !== storedState) {
        res.redirect("/#" +
            querystring.stringify({
                error: "state_mismatch"
            }));
    } else {
        res.clearCookie(stateKey);
        var authOptions = {
            url: "https://accounts.spotify.com/api/token",
            form: {
                code: code,
                redirect_uri: redirect_uri,
                grant_type: "authorization_code"
            },
            headers: {
                "Authorization": "Basic " + (Buffer.from(spotifyApiDetails.client_id + ":" + spotifyApiDetails.client_secret).toString("base64"))
            },
            json: true
        };

        request.post(authOptions, function (error, response, body) {
            if (!error && response.statusCode === 200) {
                var access_token = body.access_token;
                var refresh_token = body.refresh_token;
                res.redirect("/#" +
                    querystring.stringify({
                        access_token: access_token,
                        refresh_token: refresh_token
                    }));
            } else {
                res.redirect("/#" +
                    querystring.stringify({
                        error: "invalid_token"
                    }));
            }
        });
    }
});

app.get("/refresh_token", function (req, res) {
    var refresh_token = req.query.refresh_token;
    var authOptions = {
        url: "https://accounts.spotify.com/api/token",
        headers: { "Authorization": "Basic " + (Buffer.from(spotifyApiDetails.client_id + ":" + spotifyApiDetails.client_secret).toString("base64")) },
        form: {
            grant_type: "refresh_token",
            refresh_token: refresh_token
        },
        json: true
    };

    request.post(authOptions, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            var access_token = body.access_token;
            res.send({
                "access_token": access_token
            });
        }
    });
});

app.get("/tracks", function (req, res) {
    var playlistId = req.query.playlistId;
    var votes = [];

    db.collection("playlist-" + playlistId)
    .get()
    .then(snapshot => {
        var options = {
            url: "https://api.spotify.com/v1/playlists/" + playlistId + "/tracks",
            headers: { "Authorization": "Bearer " + req.query.token },
            json: true
        };

        if (!snapshot.empty) {
            snapshot.forEach(doc => {
                votes.push(doc.data());
            });

            request.get(options, function (error, response, body) {
                if (!error && response.statusCode === 200) {
                    body.items.forEach(function(item) {
                        var likes = [];
                        var dislikes = [];
        
                        votes.forEach(function(vote){
                            if(vote.trackId == item.track.id) {
                                if(vote.like) {
                                    likes.push(vote);
                                }
                                else {
                                    dislikes.push(vote);
                                }
                            }
                        })
        
                        item.track.likes = getCountAndUserIds(likes);
                        item.track.dislikes = getCountAndUserIds(dislikes);
                    });
        
                    res.send(body);
                } else {
                    console.log("Error getting playlist tracks from Spotify 1");
                    console.log(error);
                    res.send("error");
                }
            });
        } else {
            request.get(options, function (error, response, body) {
                if (!error && response.statusCode === 200) {
                    body.items.forEach(function(item) {      
                        item.track.likes = 0;
                        item.track.dislikes = 0;
                    });
                    res.send(body);
                } else {
                    console.log("Error getting playlist tracks from Spotify 2");
                    console.log(error);
                    res.send("error");
                }
            })
        }
    })
    .catch(err => {
        console.log("Error getting documents", err);
    });
});

app.get("/mylikedtracks", function (req, res) {
    var playlistId = req.query.playlistId;
    var userId = req.query.userId;
    var likedTracks = [];

    db.collection("playlist-" + playlistId)
    .where("userId", "=", userId)
    .where("like", "=", true)
    .get()
    .then(snapshot => {
        if (!snapshot.empty) {
            snapshot.forEach(doc => {
                likedTracks.push("spotify:track:" + doc.data().trackId);
            }); 
        }
        res.send(likedTracks);
    })
    .catch(err => {
        console.log("Error getting liked tracks", err);
        res.send(likedTracks);
    });
});

app.get("/populartracks", function (req, res) {
    getPopularTracks(req.query.playlistId, function(popularTracks){
        res.send(popularTracks);
    });
});

function getPopularTracks(playlistId, callback){
    var popularTracks = [];
    var allLikes = [];
    var uniqueLikes = [];

    db.collection("playlist-" + playlistId)
    .get()
    .then(snapshot => {
        if (!snapshot.empty) {
            var allVotes = [];

            snapshot.forEach(votes => {
                var vote = votes.data();
                allVotes.push(vote);

                if(vote.like){
                    allLikes.push(vote);

                    if(uniqueLikes == []) {
                        uniqueLikes.push(vote.trackId);
                    } else {
                        var trackIdExists = false;
                        uniqueLikes.forEach(function(trackId){
                            if(!trackIdExists && vote.trackId == trackId) {
                                trackIdExists = true;
                            }
                        });

                        if(!trackIdExists) {
                            uniqueLikes.push(vote.trackId);
                        }
                    }
                }
            });

            uniqueLikes.forEach(function(trackId){
                //calculate how many unique voters voted for this track
                var uniqueVoters = [];
                allVotes.forEach(function(vote){
                    if(vote.trackId == trackId){
                        var voterExists = false;

                        if(uniqueVoters == []){
                            uniqueVoters.push(vote.userId);
                        } else {
                            uniqueVoters.forEach(function(voter){
                                if(!voterExists && voter == vote.userId) {
                                    voterExists = true;
                                }
                            });
        
                            if(!voterExists) {
                                uniqueVoters.push(vote.userId);
                            }
                        }
                    }
                });

                //calculate total likes
                var totalLikes = 0;
                allLikes.forEach(function(like){
                    if(like.trackId == trackId) {
                        totalLikes++;
                    }
                });

                //if this track has more than 50% of the vote then it"s popular
                if(totalLikes / uniqueVoters.length > 0.5){
                    popularTracks.push("spotify:track:" + trackId);
                }
            });
        }

        callback(popularTracks);
    })
    .catch(err => {
        console.log("Error getting popular tracks", err);
        callback(popularTracks);
    });
}

app.get("/voters", function (req, res) {
    getVoters(req.query.playlistId, function(voters){
        res.send(voters);
    });
});

function getVoters(playlistId, callback){
    var voters = [];
    
    db.collection("playlist-" + playlistId)
    .get()
    .then(snapshot => {
        if (!snapshot.empty) {
            snapshot.forEach(votes => {
                var vote = votes.data();
                var voterExists = false;

                if(voters == []){
                    voters.push(vote.userId);
                } else {
                    voters.forEach(function(voter){
                        if(!voterExists && voter == vote.userId) {
                            voterExists = true;
                        }
                    });

                    if(!voterExists) {
                        voters.push(vote.userId);
                    }
                }
            });
        }

        callback(voters);
    })
    .catch(err => {
        console.log("Error getting voters", err);
        callback(voters);
    });
}

function getCountAndUserIds(votes){
    if(votes.length == 0) {
        return "0";
    }

    var usernames = "";

    votes.forEach(function(vote){
        if(usernames == "") {
            usernames = vote.userId;
        }
        else {
            usernames = usernames + "," + vote.userId;
        }
    });

    return votes.length + " (" + usernames + ")";
}

app.post("/vote", function (req, res) {
    var documentId = req.body.userId + "-" + req.body.trackId;
    db.collection("playlist-" + req.body.playlistId)
    .doc(documentId)
    .set({
        userId: req.body.userId,
        trackId: req.body.trackId,
        like: req.body.like
      }).then(ref => {
        var votes = {};

        db.collection("playlist-" + req.body.playlistId)
        .where("trackId", "==", req.body.trackId).get()
        .then(snapshot => {
          if (!snapshot.empty) {
            var likes = [];
            var dislikes = [];
            snapshot.forEach(doc => {
              if(doc.data().like) {
                  likes.push(doc.data());
              } else {
                  dislikes.push(doc.data());
              }
            });
      
            votes.likes = getCountAndUserIds(likes);
            votes.dislikes = getCountAndUserIds(dislikes);
            res.send(votes);
          }
        })
        .catch(err => {
          console.log("Error getting documents", err);
          res.send(votes);
        });
      });
})

console.log("Listening on " + port);
app.listen(port);