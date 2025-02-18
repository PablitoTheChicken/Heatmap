const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');

const app = express();
app.use(express.raw());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const port = 80;

const heatmap = new Map();
const merchantFeed = [];
let flagsState = require('./flagsState.json');

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.json({ message: "Ok" });
});

app.get('/dig-it/heatmap', (req, res) => {
    res.sendFile(path.join(__dirname, 'Heatmap.html'));
});

app.get('/dig-it/flags', (req, res) => {
    res.sendFile(path.join(__dirname, 'Flags.html'));
});

app.get('/dig-it/flag/:flag', (req, res) => {
    res.json({ flag: req.params.flag, state: flagsState[req.params.flag] });
});

app.get('/dig-it/merchant/feed', (req, res) => {
    res.sendFile(path.join(__dirname, 'MerchantFeed.html'));
});

app.get('/dig-it/heatmap/data', (req, res) => {
    res.json(
        Object.fromEntries(heatmap.entries())
    );
});

app.get('/dig-it/flags/data', (req, res) => {
    res.json(flagsState);
});

app.post('/dig-it/flags/update', (req, res) => {
    const newFlags = req.body;
    flagsState = { ...flagsState, ...newFlags };
    fs.writeFileSync(path.join(__dirname, 'flagsState.json'), JSON.stringify(flagsState, null, 2));
    res.json({ message: "Flags updated" });
});

app.post('/dig-it/flags/remove', (req, res) => {
    const { flag } = req.body;
    delete flagsState[flag];
    fs.writeFileSync(path.join(__dirname, 'flagsState.json'), JSON.stringify(flagsState, null, 2));
    res.json({ message: "Flag removed" });
});

app.post('/dig-it/merchant/feed/update', (req, res) => {
    let body = req.body;

    const playerId = body[0];
    const valueSold = body[1];

    // Add to merchant feed
    merchantFeed.push({ playerId, valueSold, timestamp: new Date() });
    if (merchantFeed.length > 200) {
        merchantFeed.shift(); // Keep only the 200 most recent interactions
    }

    // Broadcast to WebSocket clients
    const message = JSON.stringify({ playerId, valueSold, timestamp: new Date() });
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });

    res.json({ message: "Ok" });
});

app.post('/dig-it/heatmap/update', (req, res) => {
    let body = Buffer.alloc(0);

    req.on('data', (chunk) => {
        body = Buffer.concat([body, chunk]);
    });

    req.on('end', () => {
        for (let i = 0; i < body.length; i += 12) {
            const playerId = body.readDoubleLE(i);
            const x = body.readInt16LE(i + 8);
            const z = body.readInt16LE(i + 10);
            //const state = body.readUint8(i + 12);

            heatmap.set(playerId, { x, z });
        }

        //console.log(heatmap);

        res.json({ message: "Ok" });
    });
});

app.post('/dig-it/heatmap/remove', (req, res) => {
    let body = Buffer.alloc(0);
    
    req.on('data', (chunk) => {
        body = Buffer.concat([body, chunk]);
    });

    req.on('end', () => {
        for (let i = 0; i < body.length; i += 8) {
            const playerId = body.readDoubleLE(i);
            heatmap.delete(playerId);
        }

       // console.log(heatmap);

        res.json({ message: "Ok" });
    });
});

const server = app.listen(port, '45.143.196.245', () => {
    console.log(`Server is running on Cahoots.gg`);
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('Client connected');
    ws.send(JSON.stringify(merchantFeed)); // Send the current feed to the new client

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});