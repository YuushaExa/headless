const fs = require('fs');
const path = require('path');
const https = require('https'); // For fetching remote JSON

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

    // Validate the 'posts' array
    if (!Array.isArray(data.posts)) {
      throw new Error("The 'posts' field is missing or not an array in the fetched JSON.");
    }

    const posts = data.posts;

    if (posts.length === 0) {
      console.warn('Warning: The "posts" array is empty. No files will be generated.');
      return;
    }

    // Initialize an array to store metadata for the index file
    const indexData = [];

    // Process each post
    posts.forEach((post) => {
      // Add metadata to the index file
      indexData.push({
        id: post.id,
        title: post.title,
        link: `posts/${post.id}.json`, // Relative path to the post's JSON file
      });

      // Save the post as a small JSON file
      const postFilePath = path.join(outputDir, 'posts', `${post.id}.json`);
      fs.writeFileSync(postFilePath, JSON.stringify(post, null, 2));
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

// Run the main function
main();
