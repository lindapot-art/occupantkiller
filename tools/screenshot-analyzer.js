// screenshot-analyzer.js
// KING: TensorFlow.js stub for gameplay screenshot enemy detection
// To be expanded with real model and training data


// Advanced: Use pure JS TensorFlow (tfjs) and COCO-SSD (browser version) for real object detection
const tf = require('@tensorflow/tfjs');
const cocoSsd = require('@tensorflow-models/coco-ssd');
const { createCanvas, loadImage } = require('canvas');
const { Jimp } = require('jimp');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

let model = null;
async function loadModel() {
  if (!model) model = await cocoSsd.load();
  return model;
}

async function detectEnemyInImage(imagePath) {
  try {
    await loadModel();
    const img = await loadImage(imagePath);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, img.width, img.height);
    const input = tf.browser.fromPixels(canvas);
    const predictions = await model.detect(input);
    input.dispose();
    // Look for 'person', 'bear', 'cat', 'dog', or any class that could be an enemy
    const enemyClasses = ['person', 'bear', 'cat', 'dog', 'bird', 'sheep', 'cow', 'horse'];
    const found = predictions.some(pred => enemyClasses.includes(pred.class) && pred.score > 0.4);
    console.log(`Analyzed: ${imagePath} | Objects: ${predictions.map(p=>p.class+':'+p.score.toFixed(2)).join(', ')} | Detected: ${found}`);
    return found;
  } catch (e) {
    // Fallback to Jimp color heuristic if model fails
    try {
      const image = await Jimp.read(imagePath);
      let enemyPixels = 0;
      const total = image.bitmap.width * image.bitmap.height;
      image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
        const r = this.bitmap.data[idx + 0];
        const g = this.bitmap.data[idx + 1];
        const b = this.bitmap.data[idx + 2];
        if (r > 180 && g < 100 && b < 100) enemyPixels++;
      });
      const found = (enemyPixels / total) > 0.001;
      console.log(`[FALLBACK] Analyzed: ${imagePath} | Enemy pixels: ${enemyPixels} / ${total} | Detected: ${found}`);
      return found;
    } catch (e2) {
      console.error('Error analyzing', imagePath, e2.message);
      return false;
    }
  }
}

async function analyzeScreenshots() {
  const files = fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png'));
  let withEnemy = 0, total = 0;
  for (const file of files) {
    const hasEnemy = await detectEnemyInImage(path.join(SCREENSHOT_DIR, file));
    if (hasEnemy) withEnemy++;
    total++;
  }
  console.log(`Screenshots with enemy detected: ${withEnemy} / ${total}`);
}

if (require.main === module) {
  analyzeScreenshots();
}
