const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const port = 80;

const heatmap = {};

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.json({ message: "Ok" });
});

app.get('/dig-it/heatmap', (req, res) => {
    res.sendFile(path.join(__dirname, 'Heatmap.html'));
});

app.get('/dig-it/heatmap/data', (req, res) => {
    res.json(heatmap);
});

app.post('/submit', (req, res) => {
    let body = Buffer.alloc(0);

    req.on('data', (chunk) => {
        body = Buffer.concat([body, chunk]);
    });

    console.log(body);

    req.on('end', () => {
        for (let i = 0; i < body.length; i += 12) {
            const playerId = body.readDoubleLE(i);
            const x = body.readInt16LE(i + 8);
            const z = body.readInt16LE(i + 10);
            console.log(playerId, x, z);
            heatmap[playerId] = { x, z };
        }

        res.json({ message: "Ok" });
    });
});

app.post('/remove', (req, res) => {
    let body = Buffer.alloc(0);
    
    req.on('data', (chunk) => {
        body = Buffer.concat([body, chunk]);
    });

    req.on('end', () => {
        const playerId = body.readDoubleLE(0);
        delete heatmap[playerId];
        res.json({ message: "Ok" });
    });
});

app.listen(port, '45.143.196.245', () => {
    console.log(`Server is running on http://localhost:${port}`);
});