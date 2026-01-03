// Initialize data files with empty objects
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const files = ['users.json', 'comments.json', 'videos.json', 'downloads.json', 'subscriptions.json'];

files.forEach(file => {
  const filePath = path.join(dataDir, file);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify({}, null, 2));
    console.log(`Created ${file}`);
  }
});

console.log('Data files initialized!');

