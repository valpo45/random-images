const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const IMAGES_DIR = path.join(__dirname, 'images');
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

const mime = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp',
  '.html': 'text/html', '.js': 'application/javascript',
  '.css': 'text/css'
};

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url);

  // Endpoint: lista de imágenes
  if (url === '/api/images') {
    try {
      const files = fs.readdirSync(IMAGES_DIR).filter(f =>
        IMAGE_EXTS.includes(path.extname(f).toLowerCase())
      );
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify(files));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'No se pudo leer la carpeta images/' }));
    }
    return;
  }

  // Servir imágenes
  if (url.startsWith('/images/')) {
    const filePath = path.join(__dirname, url);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404); res.end('Not found');
    }
    return;
  }

  // Servir archivos estáticos (HTML, etc.)
  let filePath = (url === '/' || url === '/index.html') ? 'random-images.html' : url.slice(1);
  filePath = path.join(__dirname, filePath);
  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404); res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ✓ Servidor corriendo en http://localhost:' + PORT);
  console.log('  ✓ Leyendo imágenes de la carpeta: images/');
  console.log('');
  console.log('  Abrí tu navegador en: http://localhost:' + PORT);
  console.log('  Presioná Ctrl+C para detener el servidor.');
  console.log('');
});
