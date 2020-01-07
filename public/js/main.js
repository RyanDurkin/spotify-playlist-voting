(function() {
function getHashParams() {
    var hashParams = {};
    var e, r = /([^&;=]+)=?([^&;]*)/g,
        q = window.location.hash.substring(1);
    while ( e = r.exec(q)) {
        hashParams[e[1]] = decodeURIComponent(e[2]);
    }
    return hashParams;
}

var userPlaylistsSource = document.getElementById("user-playlists-template").innerHTML,
    userPlaylistsTemplate = Handlebars.compile(userPlaylistsSource),
    userPlaylistsPlaceholder = document.getElementById("user-playlists");

var selectedPlaylistTracksSource = document.getElementById("selected-playlist-tracks-template").innerHTML,
    selectedPlaylistTracksTemplate = Handlebars.compile(selectedPlaylistTracksSource),
    selectedPlaylistTracksPlaceholder = document.getElementById("selected-playlist-tracks");

var params = getHashParams();

var access_token = params.access_token,
    error = params.error;

var userId = "";
var playlistId = "";
var playlistName = "";
var spotifyApiRoot = "https://api.spotify.com/v1";

if (error) {
    alert("There was an error during the authentication");
} else {
    if (access_token) {
    getPlaylistsFromSpotify();
    } else {
        $("#login").show();
        $("#loggedin").hide();
    }
}

function getPlaylistsFromSpotify() {
    $.ajax({
        url: spotifyApiRoot + "/me",
        headers: {
            "Authorization": "Bearer " + access_token
        },
        success: function(response) {
            userId = response.id;
            $("#login").hide();
            $("#loggedin").show();
        }
    });

    $.ajax({
        url: spotifyApiRoot + "/me/playlists?limit=50",
        headers: {
            "Authorization": "Bearer " + access_token
        },
        success: function(response) {
            userPlaylistsPlaceholder.innerHTML = userPlaylistsTemplate(response);
            $("#loggedin").show();
        }
    });
}

$(document).on("click",".btn-vote", function(e){
    e.preventDefault();

    $("#user-playlists").hide();
    $("#selected-playlist-container").show();

    playlistId = e.target.id;

    getTracksAndVotesForPlaylist();
    getStatsForPlaylist();
});

function getTracksAndVotesForPlaylist() {
    $.ajax({
        url: spotifyApiRoot + "/playlists/" + playlistId,
        headers: {
            "Authorization": "Bearer " + access_token
        },
        success: function(response) {
            playlistName = response.name;
            $(".selected-playlist-name").html(response.name);
        }
    });

    $.ajax({
        url: "/tracks?playlistId=" + playlistId + "&token=" + access_token,
        success: function(response) {
            selectedPlaylistTracksPlaceholder.innerHTML = selectedPlaylistTracksTemplate(response);
        }
    });
}

function getStatsForPlaylist() {
    $.ajax({
        url: "/populartracks?playlistId=" + playlistId,
        success: function(response) {
            $(".number-of-popular-tracks").html(response.length);
            $(".loader-popular").hide();
            $(".number-of-popular-tracks").show();
        }
    });

    $.ajax({
        url: "/mylikedtracks?playlistId=" + playlistId + "&userId=" + userId,
        success: function(response) {
            $(".number-of-liked-tracks").html(response.length);
            $(".loader-liked").hide();
            $(".number-of-liked-tracks").show();
        }
    });

    $.ajax({
        url: "/voters?playlistId=" + playlistId,
        success: function(response) {
            $(".number-of-voters").html(response.length);
            $(".loader-voters").hide();
            $(".number-of-voters").show();
        }
    });
}

$(document).on("click",".btn-like", function(e){
    e.preventDefault();
    vote(e.target.id, true);
});

$(document).on("click",".btn-dislike", function(e){
    e.preventDefault();
    vote(e.target.id, false);
});

function vote(id, like) {
    var trackId = id;
    var data = {
        "trackId": trackId,
        "userId": userId,
        "playlistId": playlistId,
        "like": like
    }

    $.ajax({
        type: "POST",
        url: "/vote",
        data: JSON.stringify(data),
        contentType: "application/json"
    }).done(function(data) {
        $("#likes-" + id).html(data.likes);
        $("#dislikes-" + id).html(data.dislikes);
        getStatsForPlaylist();
    });
}

$(document).on("click", ".back-to-playlists", function(e){
    e.preventDefault();
    $("#selected-playlist-container").hide();
    $("#user-playlists").show();
});

$(document).on("click", ".save-likes", function(e){
    e.preventDefault();
    createPlaylist("My liked tracks");
});

$(document).on("click", ".save-popular", function(e){
    e.preventDefault();
    createPlaylist("Popular tracks");
});

function createPlaylist(name) {
    var data = {
        name: playlistName + " - " + name, 
        public: false 
    }

    Swal.fire({
        title: "Creating your playlist", 
        allowEscapeKey: false,
        allowOutsideClick: false,
        onOpen: () => {
            swal.showLoading();
        }
    })

    $.ajax({
        type: "POST",
        url: spotifyApiRoot + "/users/" + userId + "/playlists",
        headers: {
            "Authorization": "Bearer " + access_token
        },
        contentType: "application/json",
        data: JSON.stringify(data),
        success: function(response) {
            id = response.id;
            addTracksToPlaylist(id, name);
        },
        error: function(){
            Swal.fire({
                title: "Playlist creation failed",
                icon: "error"
            })
        }
    });
}

function addTracksToPlaylist(id, type){
    var apiUrl = "";

    if (type == "My liked tracks"){
        apiUrl = "/mylikedtracks";
    } else if (type == "Popular tracks") {
        apiUrl = "/populartracks";
    }

    $.ajax({
        url: apiUrl + "?playlistId=" + playlistId + "&userId=" + userId,
        success: function(response) {
            if(response != []) {
            var trackIds = response;

            $.ajax({
                type: "POST",
                url: spotifyApiRoot + "/playlists/" + id + "/tracks",
                headers: {
                    "Authorization": "Bearer " + access_token
                },
                contentType: "application/json",
                data: JSON.stringify({uris: trackIds}),
                success: function() {
                    Swal.fire({
                        title: "Playlist created!",
                        icon: "success"
                    })
                },
                error: function(){
                    Swal.fire({
                        title: "Playlist creation failed",
                        icon: "error"
                    })
                }
            });
            }
            else {
                Swal.fire({
                    title: "Playlist created!",
                    icon: "success"
                })
            }
        }
    });
}
})();