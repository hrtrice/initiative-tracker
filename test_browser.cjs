const { chromium } = require('playwright');
const { fork } = require('child_process');

async function main() {
  const server = fork('dist/server/index.cjs', [], { stdio: 'pipe' });
  server.stdout.on('data', d => process.stdout.write(`[server] ${d}`));
  server.stderr.on('data', d => process.stderr.write(`[server] ${d}`));

  // Wait for server to start
  await new Promise(r => setTimeout(r, 3000));

  const browser = await chromium.launch({ headless: true });

  const page = await browser.newPage();
  
  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => logs.push(`[PAGE ERROR] ${err.message}`));

  try {
    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle', timeout: 10000 });
    const title = await page.title();
    const html = await page.content();
    const hasAppContent = html.includes('Initiative Tracker');
    
    console.log('\n=== RESULTS ===');
    console.log('Title:', title);
    console.log('Has "Initiative Tracker" text:', hasAppContent);
    console.log('\nConsole logs:');
    logs.forEach(l => console.log(' ', l));
    
    if (logs.length === 0) console.log('  (none)');
    
    // Take screenshot
    await page.screenshot({ path: 'test_screenshot.png', fullPage: true });
    console.log('\nScreenshot saved to test_screenshot.png');
    
  } catch (err) {
    console.error('Error:', err.message);
  }

  await browser.close();
  server.kill();
  process.exit(0);
}

main();
