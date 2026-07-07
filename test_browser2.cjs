const { chromium } = require('playwright');
const { fork } = require('child_process');
const path = require('path');

async function main() {
  const server = fork(path.join(__dirname, 'dist/server/index.cjs'), [], { 
    stdio: 'pipe', env: { ...process.env, PORT: '3001' }
  });
  server.stdout.on('data', d => process.stdout.write(`[server] ${d}`));
  server.stderr.on('data', d => process.stderr.write(`[server] ${d}`));

  await new Promise(r => setTimeout(r, 3000));

  const browser = await chromium.launch({ headless: true });

  const page = await browser.newPage();
  
  page.on('console', msg => {
    const stack = msg.stack ? msg.stack().split('\n').slice(0, 5).join('\n    ') : '(no stack)';
    console.log(`[${msg.type()}] ${msg.text()}\n    ${stack}`);
  });
  
  page.on('pageerror', err => {
    console.log(`[PAGE ERROR] ${err.message}`);
    console.log(`  Stack: ${err.stack.split('\n').slice(0, 6).join('\n    ')}`);
  });

  page.on('crash', () => console.log('[CRASH] Page crashed'));

  try {
    await page.goto('http://127.0.0.1:3001/', { waitUntil: 'load', timeout: 10000 });
    await page.waitForTimeout(2000);
    
    const title = await page.title();
    const content = await page.content();
    const hasInitiativeTracker = content.includes('Initiative Tracker');
    const visibleText = await page.evaluate(() => document.body.innerText);
    
    console.log('\n=== RESULTS ===');
    console.log('Title:', title);
    console.log('Has Initiative Tracker text:', hasInitiativeTracker);
    console.log('Visible text:', JSON.stringify(visibleText.substring(0, 200)));
    
    await page.screenshot({ path: 'test_screenshot.png', fullPage: true });
    console.log('Screenshot saved');
    
  } catch (err) {
    console.error('Error:', err.message);
  }

  await browser.close();
  server.kill();
  process.exit(0);
}

main();
