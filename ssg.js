const fs = require('fs');
const path = require('path');
const https = require('https'); // For fetching remote JSON

// Base URL for GitHub Pages (update this if needed)
const baseurl = '/'; // Change to your GitHub Pages base URL if necessary

// Remote JSON URL
const dataUrl = 'https://raw.githubusercontent.com/YuushaExa/testapi/refs/heads/main/merged.json';

// Output directory
const outputDir = './public';

// Ensure the output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Function to fetch JSON data from the remote URL
function fetchData(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch data. Status code: ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', (chunk) => {
        data += chunk; // Append each chunk of data
      });

      res.on('end', () => {
        try {
          resolve(JSON.parse(data)); // Parse the fetched data as JSON
        } catch (error) {
          reject(new Error(`Error parsing JSON: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`Error fetching data: ${error.message}`));
    });
  });
}

// Main function to process the JSON data
async function main() {
  try {
    // Fetch the JSON data
    const data = await fetchData(dataUrl);

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
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1); // Exit with an error code
  }
}
