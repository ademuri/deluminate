import { test as base, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const test = base.extend({
  context: async ({ }, use) => {
    const pathToExtension = path.resolve(__dirname, '..');
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--headless=new`,
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });

    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [background] = context.serviceWorkers();
    if (!background)
      background = await context.waitForEvent('serviceworker');

    const extensionId = background.url().split('/')[2];
    await use(extensionId);
  },
  server: async ({ }, use) => {
    const server = http.createServer((req, res) => {
      // Prevent directory traversal
      const safePath = path.normalize(req.url).replace(/^(\.{2}[/\\])+/, '');
      const filePath = path.join(__dirname, 'fixtures', safePath === '/' ? 'index.html' : safePath);
      
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        const ext = path.extname(filePath);
        const mime = {
           '.html': 'text/html',
           '.css': 'text/css',
           '.js': 'text/javascript',
           '.png': 'image/png',
           '.jpg': 'image/jpeg'
        }[ext] || 'text/plain';
        res.writeHead(200, { 'Content-Type': mime });
        res.end(data);
      });
    });
    
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    await use(`http://127.0.0.1:${port}`);
    server.close();
  },
});
export const expect = base.expect;