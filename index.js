const SpotifyWebApi = require('spotify-web-api-node');
const express = require('express');
const uuid = require('uuid/v4');
const _ = require('lodash');
const fs = require('fs');

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

const scopes = ['user-read-private', 'playlist-modify-public'],
    redirectUri = 'http://localhost:8080/callback',
    state = uuid();

const credentials = {};
const app = express();

function render(templateName, params) {
    return _.template(fs.readFileSync(`${__dirname}/templates/${templateName}.html`))(params);
}

app.use(require('body-parser').urlencoded({ extended: true }));

app.get('/login', (req, res) => {
    const spotifyApi = new SpotifyWebApi({
        redirectUri: redirectUri,
        clientId: clientId
    });
    const authorizeURL = spotifyApi.createAuthorizeURL(scopes, state);
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

    res.redirect(`/?id=${id}`);
});

app.get('/', async (req, res) => {
    const id = req.query.id;
    if (_.isEmpty(id) || _.isEmpty(credentials[id])) {
        return res.redirect('/login');
    }

    const spotifyApi = new SpotifyWebApi({
        clientId,
        clientSecret,
        redirectUri,
        accessToken: credentials[id].access_token
    });

    const me = (await spotifyApi.getMe()).body;
    res.send(render('index', {me, id}));
});

app.post('/createPlaylist', async (req, res) => {
    const { id } = req.query;
    if (_.isEmpty(credentials[id])) {
        return res.redirect('/login');
    }

    const spotifyApi = new SpotifyWebApi({
        clientId,
        clientSecret,
        redirectUri,
        accessToken: credentials[id].access_token
    });

    try {
        const tracks = req.body.tracks.split('\n').filter(t => t.trim() != '');
        console.log(tracks);
        const { playlistName, description } = req.body;
        console.log(playlistName, description);

        const me = (await spotifyApi.getMe()).body;
        const playlist = (await spotifyApi.createPlaylist(me.id, playlistName, {description: description})).body;

        const missingTracks = [];

        const trackIds = (await Promise.all(tracks.map(async t => {
            const res = (await spotifyApi.searchTracks(t, {limit: 1})).body.tracks.items;
            // console.log(res);
            if (_.size(res) == 0) {
                missingTracks.push(t);
                return;
            }
            return res[0].uri;
        }))).filter(t => !_.isEmpty(t));

        if (_.size(trackIds) > 0) {
            await spotifyApi.addTracksToPlaylist(playlist.id, trackIds);
        }
        return res.send(render('createPlaylist', { me, playlist, missingTracks }));
    } catch (e) {
        console.log(e)
        return res.send({status: 'error', error: e})
    }
});

app.listen(8080);
