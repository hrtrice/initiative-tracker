const { chromium } = require('playwright');
const { fork } = require('child_process');
const path = require('path');

async function main() {
  const server = fork(path.join(__dirname, 'dist/server/index.cjs'), [], {
    stdio: 'pipe', env: { ...process.env, PORT: '3003' }
  });
  server.stdout.on('data', d => process.stdout.write(`[server] ${d}`));
  server.stderr.on('data', d => process.stderr.write(`[server] ${d}`));
  await new Promise(r => setTimeout(r, 3000));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Expose a function to check wsClient internal state
  await page.goto('http://127.0.0.1:3003/', { waitUntil: 'networkidle' });

  // Wait for app to mount, then inject a spy
  await page.waitForTimeout(1000);

  // Check what _status is by accessing the module's closure
  // We can use page.evaluate to check the DOM for WebSocket state
  // Let's monitor the connectionStatus by checking what the TurnIndicator shows

  // Click create
  await page.locator('button:has-text("Create New Session")').click();
  await page.waitForTimeout(1000);

  // Check what's visible
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('Body text:', JSON.stringify(bodyText));
  
  // Check if the reconnect banner exists and what it says
  const banners = await page.evaluate(() => {
    const divs = document.querySelectorAll('.reconnect-banner, .error-banner');
    return Array.from(divs).map(d => d.textContent);
  });
  console.log('Banners found:', JSON.stringify(banners));
  
  // Now let's hook into the WebSocket to see if onopen fires
  // We can monkey-patch WebSocket before it's used
  await browser.close();
  
  // Let's try a different approach - intercept WebSocket construction
  const browser2 = await chromium.launch({ headless: true });
  const page2 = await browser2.newPage();
  
  // Patch WebSocket to log events
  await page2.addInitScript(() => {
    const origWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
      console.log('[PATCH] WS constructor:', url);
      const ws = new origWebSocket(url, protocols);
      const origOpen = ws.onopen;
      Object.defineProperty(ws, 'onopen', {
        get() { return origOpen; },
        set(fn) {
          console.log('[PATCH] onopen setter called');
          const wrapped = function(e) {
            console.log('[PATCH] onopen FIRED');
            return fn.call(this, e);
          };
          return Object.defineProperty(ws, 'onopen', { value: wrapped, writable: true });
        }
      });
      return ws;
    };
    window.WebSocket.prototype = origWebSocket.prototype;
  });

  await page2.goto('http://127.0.0.1:3003/', { waitUntil: 'networkidle' });
  await page2.waitForTimeout(1000);
  
  page2.on('console', msg => {
    if (msg.text().includes('[PATCH]') || msg.text().includes('error') || msg.text().includes('Error'))
      console.log(`[${msg.type()}] ${msg.text()}`);
  });
  
  await page2.locator('button:has-text("Create New Session')").click();
  await page2.waitForTimeout(2000);

  const bodyText2 = await page2.evaluate(() => document.body.innerText);
  console.log('After create (patched):', JSON.stringify(bodyText2.substring(0, 300)));

  await page2.screenshot({ path: 'test_ws2.png', fullPage: true });
  
  await browser2.close();
  server.kill();
  process.exit(0);
}

main();
