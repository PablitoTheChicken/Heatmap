const express = require('express');
const bodyParser = require('body-parser');
const { exec } = require("child_process");
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const WebSocket = require('ws');
const fetch = require('node-fetch');
const { glob } = require("glob");

const { v4: uuidv4 } = require('uuid');
const tmpDownloads = new Map();

const app = express();
app.use(express.raw());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

const port = 80;
const AUTH_KEY = 'UiSmorbElekNERCITisIVArpArdea';

const heatmap = new Map();
const merchantFeed = [];
let flagsState = require('./flagsState.json');

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.json({ message: "Ok" });
});

app.get("/tmp/:id", (req, res) => {
    const { id } = req.params;
    const fileEntry = tmpDownloads.get(id);
  
    if (!fileEntry) {
      return res.status(404).send("Download expired or not found.");
    }
  
    const { path: filePath, filename } = fileEntry;
  
    res.download(filePath, filename, (err) => {
      if (err) {
        console.error("Download failed:", err);
        return;
      }
  
      // Cleanup after download
      fs.unlink(filePath, () => {
        console.log(`🧹 Deleted temp file: ${filePath}`);
      });
  
      tmpDownloads.delete(id);
    });
  });  

app.post("/download", (req, res) => {
    const { url, resolution, format } = req.body;
    let cmd;
  
    const isMp3 = format === "mp3";
    const outputName = isMp3 ? "audio.%(ext)s" : "video.%(ext)s";
  
    if (isMp3) {
      cmd = `yt-dlp -x --audio-format mp3 -o "${outputName}" "${url}"`;
    } else {
        let ytFormat = "best";
        if (resolution === "1080")
          ytFormat = "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/best";
        else if (resolution === "720")
          ytFormat = "bv*[height<=720][ext=mp4]+ba[ext=m4a]/best";
        else if (resolution === "480")
          ytFormat = "bv*[height<=480][ext=mp4]+ba[ext=m4a]/best";
        
        cmd = `yt-dlp -f "${ytFormat}" -o "${outputName}" --merge-output-format mp4 "${url}"`;        
    }
  
    console.log(`⏬ Running: ${cmd}`);
  
    exec(cmd, async (err, stdout, stderr) => {
      if (err) {
        console.error("yt-dlp error:", stderr);
        return res.status(500).send("Download failed.");
      }
  
      try {
        const pattern = isMp3 ? "audio.mp3" : "video.*";
        const files = await glob(pattern);
  
        if (!files.length) {
          return res.status(500).send("No output file found.");
        }
  
        const fullPath = path.join(__dirname, files[0]);
        const id = uuidv4();
        const filename = path.basename(fullPath);
        const tmpPath = path.join(__dirname, "tmp", `${id}-${filename}`);
  
        // Ensure /tmp exists
        fs.mkdirSync(path.join(__dirname, "tmp"), { recursive: true });
  
        // Move the file to tmp/
        fs.renameSync(fullPath, tmpPath);
  
        tmpDownloads.set(id, { path: tmpPath, filename });
  
        res.json({ downloadUrl: `http://www.cahoots.gg/tmp/${id}` });
      } catch (e) {
        console.error("Error during file handling:", e);
        return res.status(500).send("Internal server error.");
      }
    });
  });  
  

app.get('/dig-it', (req, res) => {
    // Redirect to URL
    res.redirect('https://www.roblox.com/games/76455837887178/Dig-it-RELICA');
});

app.get('/dig-it/heatmap', (req, res) => {
    res.sendFile(path.join(__dirname, 'Heatmap.html'));
});

app.get('/dig-it/datastore', (req, res) => {
    res.sendFile(path.join(__dirname, 'DatastoreViewer.html'));
});

app.get('/dig-it/flags', (req, res) => {
    res.sendFile(path.join(__dirname, 'Flags.html'));
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
    const authKey = req.headers.authorization;
    if (authKey !== AUTH_KEY) {
        return res.status(403).json({ message: "Forbidden" });
    }
    const newFlags = req.body;
    flagsState = { ...flagsState, ...newFlags };
    fs.writeFileSync(path.join(__dirname, 'flagsState.json'), JSON.stringify(flagsState, null, 2));
    res.json({ message: "Flags updated" });
});

app.post('/dig-it/flags/remove', (req, res) => {
    const authKey = req.headers.authorization;
    if (authKey !== AUTH_KEY) {
        return res.status(403).json({ message: "Forbidden" });
    }
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

// Proxy endpoint to fetch data from Roblox Datastore API
app.post('/fetchData', async (req, res) => {
    const { authKey, entryKey } = req.body;

    if (authKey !== "DIGITSTAFFAUTH") {
        return res.status(403).json({ message: "Forbidden" });
    }

    const url = 'https://apis.roblox.com/datastores/v1/universes/6705549208/standard-datastores/datastore/entries/entry';
    const params = new URLSearchParams({
        datastoreName: 'PROFILE_0',
        entryKey: entryKey
    });

    try {
        const response = await fetch(`${url}?${params.toString()}`, {
            method: 'GET',
            headers: {
                'x-api-key': 'yoz1WvylaU2AuKwIuVHc5H1lj6Lcmjq1rhkpxkUBZ92+a57tZXlKaGJHY2lPaUpTVXpJMU5pSXNJbXRwWkNJNkluTnBaeTB5TURJeExUQTNMVEV6VkRFNE9qVXhPalE1V2lJc0luUjVjQ0k2SWtwWFZDSjkuZXlKaVlYTmxRWEJwUzJWNUlqb2llVzk2TVZkMmVXeGhWVEpCZFV0M1NYVldTR00xU0RGc2FqWk1ZMjFxY1RGeWFHdHdlR3RWUWxvNU1pdGhOVGQwSWl3aWIzZHVaWEpKWkNJNklqRTFPVFF4TXpNeElpd2lZWFZrSWpvaVVtOWliRzk0U1c1MFpYSnVZV3dpTENKcGMzTWlPaUpEYkc5MVpFRjFkR2hsYm5ScFkyRjBhVzl1VTJWeWRtbGpaU0lzSW1WNGNDSTZNVGMwTURZNE5ERTFOeXdpYVdGMElqb3hOelF3Tmpnd05UVTNMQ0p1WW1ZaU9qRTNOREEyT0RBMU5UZDkuWmhNdWZsbnRrb2I0bGE5MEJqeDBNTGd1V0lGY3ZuamFWSUFnZkNkWXFQQXZ6OUgtaXpfVkRKX3RXbWVQVEdhOHFOemdnVUY3SVVzMF8xcDZKVUx3RlZvcDlYZFRlNlk2d2Z6ampJOUVkbXdfTnVobHMxX2YzU1U5dnpYNmtQWWE2a2h2OUktWDAwSE5PaE9yN2FGWVdXZ2dXYlo0M0Jrald4Zm9kNVhVOHVZcVVfMGg4UXpKMGN6SGlrdm1EX1ZPWmIwdG1ZMXZyTTRUa25OdkNsRzlvQXd1akFiRzdCVGx1TWRTZ0xZbFdWNVVkOHVTM1BDZGhITXhUSHlsRklORzNkNGRsd3BaaVl1WkV5eGY4djRwRlNUbXE0THNiMGlqdFFpSm0zZFF3LTRUYmxHZkdJSDZsc1AtTXVQcXlBQm8yeWQ3a0g3OC1zQmpCTERNaTdmNUVn'
            }
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
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