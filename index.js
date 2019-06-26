const SpotifyWebApi = require('spotify-web-api-node');
const express = require("express");
const uuid = require('uuid/v4');

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

const scopes = ['user-read-private', 'playlist-modify-public'],
    redirectUri = 'http://localhost:8080/callback',
    state = uuid();

// Setting credentials can be done in the wrapper's constructor, or using the API object's setters.

console.log(clientId)

// Create the authorization URL

const credentials = {};

const app = express();
app.use(require('body-parser').urlencoded({ extended: true }));

app.get('/login', (req, res) => {
    const spotifyApi = new SpotifyWebApi({
        redirectUri: redirectUri,
        clientId: clientId
    });
    const authorizeURL = spotifyApi.createAuthorizeURL(scopes, state);
    console.log(authorizeURL);
    res.redirect(authorizeURL);
});

app.get('/callback', async (req, res) => {
    const id = req.query.state;
    const spotifyApi = new SpotifyWebApi({
        clientId,
        clientSecret,
        redirectUri
    });

    try {
        credentials[id] = (await spotifyApi.authorizationCodeGrant(req.query.code)).body;
    } catch (e) {
        console.log(e);
    }

    console.log(credentials[id]);

    res.redirect(`/?id=${id}`);
});

app.get('/', async (req, res) => {
    const id = req.query.id;

    const spotifyApi = new SpotifyWebApi({
        clientId,
        clientSecret,
        redirectUri,
        accessToken: credentials[id].access_token
    });

    const me = (await spotifyApi.getMe()).body;
    res.send(`
<html>
<body>
Hello, ${me.display_name}!
<form action="/createPlaylist?id=${id}" method="post">
<textarea name="tracks">
</textarea>
<br/>
<input type="submit">
</form>
</body>
</html>
    `)
});

app.post('/createPlaylist', async (req, res) => {
    const id = req.query.id;

    const spotifyApi = new SpotifyWebApi({
        clientId,
        clientSecret,
        redirectUri,
        accessToken: credentials[id].access_token
    });

    try {
        const tracks = req.body.tracks.split('\n').filter(t => t.trim() != '');
        console.log(tracks);
    
        const me = (await spotifyApi.getMe()).body;
        const playlist = (await spotifyApi.createPlaylist(me.id, "New playlist", {description: 'Nastya rocks'})).body;
        const trackIds = await Promise.all(tracks.map(async t => {
            const res = (await spotifyApi.searchTracks(t, {limit: 1})).body.tracks.items;
            console.log(res);
            return res[0].uri;
        }));

        console.log(trackIds);
        console.log(playlist.id);
        await spotifyApi.addTracksToPlaylist(playlist.id, trackIds);
    } catch (e) {
        console.log(e)
    }
    res.send({'status': 'ok'});
});

app.listen(8080);
