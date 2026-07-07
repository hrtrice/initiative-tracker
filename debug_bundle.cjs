const fs = require('fs');
const code = fs.readFileSync('dist/assets/index-GpbpLP8N.js', 'utf-8');

console.log('Bundle size:', code.length, 'bytes');

// Check for getElementById calls
const matches = code.match(/getElementById\("[^"]+"\)/g);
console.log('getElementById calls:', matches);

// Check mount call
const mountIndex = code.indexOf('zs(jo,');
if (mountIndex > -1) {
  console.log('Mount call found at byte offset:', mountIndex);
  console.log('Prefix:', code.substring(Math.max(0, mountIndex - 300), mountIndex));
  let end = code.indexOf(');', mountIndex);
  console.log('Mount args:', code.substring(mountIndex, end + 2));
}

// Check for any error handlers
console.log('Has window.onerror:', code.includes('onerror'));
console.log('Has addEventListener:', code.includes('addEventListener(\"error\"') || code.includes("addEventListener('error'"));

// Check for SW register
const swIdx = code.indexOf('serviceWorker');
if (swIdx > -1) {
  console.log('SW register context:', code.substring(swIdx - 50, swIdx + 80));
}

// Check for potential issues - nullish coalescing
console.log('Has ?? operator:', code.includes('??'));

// Check if any functions throw
console.log('Has throw statements:', (code.match(/throw/g) || []).length);
