const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const R2_BASE_URL = 'https://pub-51aead7da52e45cfa58719a4912f8490.r2.dev';
const ACCOUNT_ID  = 'd969d8be72f45907bb7cdbe0665b0308';
const BUCKET      = 'random-images';
const API_TOKEN   = 'cfut_PqPJNcHHxrSRPNnSwSi4aAFyN5ZKxh2ZW8olsLiA3a65599b';
const IMAGE_EXTS  = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

const mime = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp',
  '.html': 'text/html', '.js': 'application/javascript',
};

// Cache de lista de imágenes (se actualiza cada 5 min)
let imageCache = [];
let lastFetch = 0;

function fetchImageList() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.cloudflare.com',
      path: `/client/v4/accounts/${ACCOUNT_ID}/r2/buckets/${BUCKET}/objects?per_page=1000`,
      headers: { 'Authorization': `Bearer ${API_TOKEN}` }
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const files = (json.result?.objects || [])
            .map(o => o.key)
            .filter(k => IMAGE_EXTS.includes(path.extname(k).toLowerCase()));
          resolve(files);
        } catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function getImageList() {
  const now = Date.now();
  if (imageCache.length === 0 || now - lastFetch > 5 * 60 * 1000) {
    imageCache = await fetchImageList();
    lastFetch = now;
  }
  return imageCache;
}

const server = http.createServer(async (req, res) => {
  const url = decodeURIComponent(req.url);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Endpoint: lista de imágenes
  if (url === '/api/images') {
    try {
      const files = await getImageList();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(files));
    } catch(e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'No se pudo obtener la lista de imágenes' }));
    }
    return;
  }

  // Servir archivos estáticos (HTML)
  let filePath = (url === '/' || url === '/index.html') ? 'random-images.html' : url.slice(1);
  filePath = path.join(__dirname, filePath);
  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ✓ Servidor corriendo en http://localhost:' + PORT);
  console.log('  ✓ Imágenes servidas desde Cloudflare R2');
  console.log('');
});
