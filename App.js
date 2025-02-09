const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const port = 80;
const heatmap = {};
const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.raw({
    type: 'application/octet-stream',
  }));

app.get('/', (req, res) => {
    res.json({ message: "Ok" });
});

app.get('/dig-it/heatmap', (req, res) => {
    res.sendFile(path.join(__dirname, 'Heatmap.html'));
});

app.get('/dig-it/heatmap/data', (req, res) => {
    res.json(heatmap);
});

app.post('/dig-it/heatmap/submit'
, (req, res) => {
    const data = Buffer.from(Object.keys(req.body)[0]);
    console.log(data);

    for (let i = 0; i < data.length; i += 12) {
        const playerId = data.readDoubleLE(i);
        const x = data.readInt16LE(i + 8);
        const z = data.readInt16LE(i + 10);

        console.log(playerId, x, z);
        heatmap[playerId] = { x, z };
    }

    res.json({ message: "Ok" });
});

app.post('/dig-it/heatmap/remove'
, (req, res) => {
    const data = req.body;
    const playerId = data.readDoubleLE(0);
    delete heatmap[playerId];
    res.json({ message: "Ok" });
});

app.listen(port, '45.143.196.245', () => {
    console.log(`Server is running on http://localhost:${port}`);
});