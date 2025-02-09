const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const port = 3000;

const heatmap = {};

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.json({ message: "Ok" });
});

app.get('/heatmap', (req, res) => {
    res.json(heatmap);
});

app.get('/heatmap-view', (req, res) => {
    res.sendFile(path.join(__dirname, 'Heatmap.html'));
});

app.post('/submit', (req, res) => {
    const heatmapCollection = req.body;
    console.log(heatmapCollection);
    for (let i = 0; i < heatmapCollection.length; i++) {
        const playerData = heatmapCollection[i];
        const playerId = playerData.id;
        heatmap[playerId] = { x: playerData.x, z: playerData.z };
    }

    res.json({ message: "Ok" });
});

app.delete('/remove', (req, res) => {
    const playerId = req.body.id;
    if (heatmap[playerId]) {
        delete heatmap[playerId];
        res.json({ message: `Player ${playerId} removed from heatmap` });
    } else {
        res.status(404).json({ message: `Player ${playerId} not found in heatmap` });
    }
});

app.listen(port, '45.143.196.245', () => {
    console.log(`Server is running on http://localhost:${port}`);
});