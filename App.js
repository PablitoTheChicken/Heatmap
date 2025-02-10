const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(express.raw());
app.use(bodyParser.urlencoded({ extended: true }));

const port = 80;

const heatmap = new Map();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.json({ message: "Ok" });
});

app.get('/dig-it/heatmap', (req, res) => {
    res.sendFile(path.join(__dirname, 'Heatmap.html'));
});

app.get('/dig-it/heatmap/data', (req, res) => {
    res.json(
        Object.fromEntries(heatmap.entries())
    );
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

            heatmap.set(playerId, { x, z });
        }

        console.log(heatmap);

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

        console.log(heatmap);

        res.json({ message: "Ok" });
    });
});

app.listen(port, '45.143.196.245', () => {
    console.log(`Server is running on http://localhost:${port}`);
});