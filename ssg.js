const fs = require('fs');
const path = require('path');

// Path to the input JSON file
const inputFilePath = './data.json'; // Large JSON file
const outputDir = './public'; // Directory to store generated JSON files

// Ensure the output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Read and parse the large JSON file
const data = JSON.parse(fs.readFileSync(inputFilePath, 'utf8'));

// Initialize an array to store metadata for the index file
const indexData = [];

// Process each subforum
data.subforums.forEach((subforum) => {
  // Process each post in the subforum
  subforum.posts.forEach((post) => {
    // Add metadata to the index file
    indexData.push({
      id: post.id,
      title: post.title,
      author: post.author,
      date: post.date,
      link: `posts/${post.id}.json`, // Relative path to the post's JSON file
    });

    // Save the post as a small JSON file
    const postFilePath = path.join(outputDir, 'posts', `${post.id}.json`);
    fs.writeFileSync(postFilePath, JSON.stringify(post, null, 2));
  });
});

// Save the index JSON file
const indexPath = path.join(outputDir, 'index.json');
fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2));

console.log('JSON generation complete!');
