import http from 'http';
import fs from 'fs';

let imageNumber = 0;

const server = http.createServer(function (req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Request-Method', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    console.log(`Writing file ${imageNumber}`);
    const fileOutputStream = fs.createWriteStream(`./images/img${('0000' + imageNumber).slice(-4)}.png`);
    imageNumber++;
    req.pipe(fileOutputStream);
    req.on('end', () => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ message: 'success' }));
    });
});

server.listen(3002);
console.log('Web server at port 3002 is running...');
