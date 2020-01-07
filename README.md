# Spotify Playlist Voting Website

# Firebase Setup
- Create a free Spark Firebase Account at https://firebase.google.com/
- Create a Firebase Project
- Create a Cloud Firestore
- Create a service account that will be used by the API. Project settings -> Service accounts -> Click on "Manage service account permissions"
- Create a new private key file and save it in the root of the application named firebaseServiceAccountKey.json. The file contents should look like this:

```
{
  "type": "service_account",
  "project_id": "YOUR PROJECT ID HERE",
  "private_key_id": "YOUR PRIVATE KEY ID HERE",
  "private_key": "YOUR PRIVATE KEY HERE",
  "client_email": "YOUR CLIENT EMAIL HERE",
  "client_id": "YOUR CLIENT ID HERE",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "YOUR CERT URL HERE"
}
```

# Spotify Setup
- Login to https://developer.spotify.com/dashboard/login
- Create an App
- Create a new json file in the root of the application named spotifyApiDetails.json
- Add your App's client id, client secret and callback URL in the file in the following format:

```
{
    "client_id": "YOUR CLIENT ID",
    "client_secret": "YOUR CLIENT SECRET",
    "callback_url": "https://YOURWEBSITEDOMAIN/callback"
}
```

- When running locally the callback URL used will be http://localhost:8888/callback . When running on your web server, the url set in these settings will be used

# Build the application
- Run npm install
- Run node app.js and the site will be running on http://localhost:8888
