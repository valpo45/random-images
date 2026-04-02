process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const R2_BASE_URL = 'https://pub-51aead7da52e45cfa58719a4912f8490.r2.dev';
const ACCOUNT_ID  = 'd969d8be72f45907bb7cdbe0665b0308';
const BUCKET      = 'random-images';
const API_TOKEN   = 'cfat_VtkMTUFkG30QPo2NBWqa5a8kTUFLY6s8zHfkXLOsa5bac18d';
const IMAGE_EXTS  = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

const mime = {
  '.html': 'text/html',
  '.js': 'application/javascript',
};

let imageCache = [];
let lastFetch = 0;

function fetchPage(cursor) {
  return new Promise((resolve, reject) => {
    let urlPath = '/client/v4/accounts/' + ACCOUNT_ID + '/r2/buckets/' + BUCKET + '/objects?per_page=1000';
    if (cursor) urlPath += '&cursor=' + encodeURIComponent(cursor);

    const options = {
      hostname: 'api.cloudflare.com',
      path: urlPath,
      headers: { 'Authorization': 'Bearer ' + API_TOKEN }
    };

    const req = https.get(options, function(res) {
      let data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
  });
}

async function fetchAllImages() {
  let all = [];
  let cursor = null;

  while (true) {
    const json = await fetchPage(cursor);
    const objects = json.result || [];
    const files = objects
      .map(function(o) { return o.key; })
      .filter(function(k) { return IMAGE_EXTS.includes(path.extname(k).toLowerCase()); });
    all = all.concat(files);
    console.log('  Página cargada: ' + all.length + ' imágenes hasta ahora...');

    if (json.result_info && json.result_info.is_truncated && json.result_info.cursor) {
      cursor = json.result_info.cursor;
    } else {
      break;
    }
  }

  return all;
}

async function getImageList() {
  const now = Date.now();
  if (imageCache.length === 0 || now - lastFetch > 10 * 60 * 1000) {
    console.log('  Cargando imágenes desde R2...');
    imageCache = await fetchAllImages();
    lastFetch = now;
    console.log('  TOTAL: ' + imageCache.length + ' imagenes cargadas.');
  }
  return imageCache;
}

const server = http.createServer(async function(req, res) {
  const url = decodeURIComponent(req.url);
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (url.startsWith('/api/random')) {
    try {
      const files = await getImageList();
      if (files.length === 0) {
        res.writeHead(503);
        res.end(JSON.stringify({ error: 'Cargando imagenes, intenta en unos segundos' }));
        return;
      }
      const lastParam = new URL('http://x' + url).searchParams.get('last');
      let idx;
      do { idx = Math.floor(Math.random() * files.length); }
      while (files[idx] === lastParam && files.length > 1);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ filename: files[idx] }));
    } catch(e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (url === '/api/images') {
    try {
      const files = await getImageList();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(files));
    } catch(e) {
      console.error('Error:', e.message);
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  let filePath = (url === '/' || url === '/index.html') ? 'random-images.html' : url.slice(1);
  filePath = path.join(__dirname, filePath);
  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, async function() {
  console.log('');
  console.log('  Servidor corriendo en http://localhost:' + PORT);
  try {
    await getImageList();
    console.log('  Listo! Abri http://localhost:' + PORT + '/random-images.html');
  } catch(e) {
    console.error('  Error cargando imagenes:', e.message);
  }
  console.log('');
});
