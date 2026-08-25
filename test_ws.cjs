const { chromium } = require('playwright');
const { fork } = require('child_process');
const path = require('path');

async function main() {
  const server = fork(path.join(__dirname, 'dist/server/index.cjs'), [], {
    stdio: 'pipe',
    env: { ...process.env, PORT: '3002' }
  });
  server.stdout.on('data', d => process.stdout.write(`[server] ${d}`));
  server.stderr.on('data', d => process.stderr.write(`[server] ${d}`));

  await new Promise(r => setTimeout(r, 3000));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => console.log(`[PAGE ERROR] ${err.message}`));

  // Capture WebSocket events
  page.on('websocket', ws => {
    console.log(`[WS] created: ${ws.url()}`);
    ws.on('framesent', frame => console.log(`[WS] >> ${frame.payload}`));
    ws.on('framereceived', frame => console.log(`[WS] << ${frame.payload}`));
    ws.on('close', () => console.log(`[WS] closed`));
  });

  await page.goto('http://127.0.0.1:3002/', { waitUntil: 'networkidle' });
  console.log('\n=== Page loaded ===');
  
  // Check initial state
  let text = await page.evaluate(() => document.body.innerText);
  console.log('Initial text:', JSON.stringify(text));

  // Click "Create New Session"
  const createBtn = page.locator('button:has-text("Create New Session")');
  console.log('Create button found:', await createBtn.isVisible());
  await createBtn.click();
  
  // Wait for UI to update
  await page.waitForTimeout(2000);
  
  text = await page.evaluate(() => document.body.innerText);
  console.log('After create text:', JSON.stringify(text.substring(0, 500)));
  
  // Check connection status
  const disconnected = await page.locator('text=Disconnected').isVisible();
  const reconnecting = await page.locator('text=Reconnecting').isVisible();
  console.log('Disconnected visible:', disconnected);
  console.log('Reconnecting visible:', reconnecting);
  
  // Click Next
  const nextBtn = page.locator('button:has-text("Next")');
  if (await nextBtn.isVisible()) {
    console.log('Clicking Next...');
    await nextBtn.click();
    await page.waitForTimeout(500);
    const errorBanner = await page.locator('.error-banner').isVisible();
    console.log('Error banner visible:', errorBanner);
    if (errorBanner) {
      const errText = await page.locator('.error-banner span').textContent();
      console.log('Error text:', errText);
    }
  }

  await page.screenshot({ path: 'test_ws.png', fullPage: true });
  console.log('\nScreenshot saved');

  await browser.close();
  server.kill();
  process.exit(0);
}

main();
