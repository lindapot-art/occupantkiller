const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
const bust = '?v=20260429';
// Add cache buster to script src and link href (skip those already having ?)
html = html.replace(/<script src="([^"?]+)"/g, (m, p1) => '<script src="' + p1 + bust + '"');
html = html.replace(/<link rel="stylesheet" href="([^"?]+)"/g, (m, p1) => '<link rel="stylesheet" href="' + p1 + bust + '"');
fs.writeFileSync('index.html', html);
console.log('Cache bust added to all assets');
