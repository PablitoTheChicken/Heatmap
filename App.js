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

app.post('/dig-it/heatmap/submit', express.raw({ type: '*/*' }), (req, res) => {
    const data = Buffer.from(req.body); // Ensure it's a Buffer

    console.log(data); // Debugging: check if it's a Buffer

    for (let i = 0; i < data.length; i += 12) {
        const playerId = data.readDoubleLE(i); // Reads a double (8 bytes)
        const x = data.readInt16LE(i + 8);     // Reads a short (2 bytes)
        const z = data.readInt16LE(i + 10);    // Reads a short (2 bytes)

        console.log(playerId, x, z);
        heatmap[playerId] = { x, z };
    }

    res.json({ message: "Ok" });
});

app.post('/dig-it/heatmap/remove', express.raw({ type: '*/*' }), (req, res) => {
    const playerId = req.body.readDoubleLE(0);
    delete heatmap[playerId];
    res.json({ message: "Ok" });
});

app.listen(port, '45.143.196.245', () => {
    console.log(`Server is running on http://localhost:${port}`);
});