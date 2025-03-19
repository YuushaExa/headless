const fs = require('fs');
const path = require('path');
const https = require('https'); // For fetching remote JSON

// Remote JSON URL
const dataUrl = 'https://raw.githubusercontent.com/YuushaExa/testapi/refs/heads/main/merged.json';

// Output directory
const outputDir = './public';

// Ensure the output directory and posts subdirectory exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}
if (!fs.existsSync(path.join(outputDir, 'posts'))) {
  fs.mkdirSync(path.join(outputDir, 'posts'), { recursive: true });
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

// Function to split posts into pages
function paginatePosts(posts, pageSize) {
  const paginated = [];
  for (let i = 0; i < posts.length; i += pageSize) {
    paginated.push(posts.slice(i, i + pageSize));
  }
  return paginated;
}

// Main function to process the JSON data
async function main() {
  try {
    // Fetch the JSON data
    const data = await fetchData(dataUrl);

    // Validate the input JSON
    if (!Array.isArray(data)) {
      throw new Error("The fetched data is not an array.");
    }

    const posts = data;

    if (posts.length === 0) {
      console.warn('Warning: The "posts" array is empty. No files will be generated.');
      return;
    }

    // Pagination settings
    const postsPerPage = 10; // Number of posts per page

    // Paginate the posts
    const paginatedPosts = paginatePosts(posts, postsPerPage);

    // Generate index.json
    const indexData = posts.map(post => ({
      id: post.id,
      title: post.title,
      link: `posts/${post.id}.json` // Relative path to the post's JSON file
    }));

    const indexPath = path.join(outputDir, 'index.json');
    fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2));

    // Generate individual post files
    posts.forEach(post => {
      const postFilePath = path.join(outputDir, 'posts', `${post.id}.json`);
      fs.writeFileSync(postFilePath, JSON.stringify(post, null, 2));
    });

    // Generate pagination.json
    const totalPages = paginatedPosts.length;
    const paginationData = paginatedPosts.map((pagePosts, pageIndex) => ({
      currentPage: pageIndex + 1,
      totalPages: totalPages,
      nextPage: pageIndex + 2 <= totalPages ? `page/${pageIndex + 2}.json` : null,
      previousPage: pageIndex > 0 ? `page/${pageIndex}.json` : null,
      posts: pagePosts.map(post => ({
        id: post.id,
        title: post.title,
        link: `posts/${post.id}.json`
      }))
    }));

    // Save pagination.json
    const paginationPath = path.join(outputDir, 'pagination.json');
    fs.writeFileSync(paginationPath, JSON.stringify(paginationData, null, 2));

    console.log('JSON generation complete!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1); // Exit with an error code
  }
}

// Run the main function
main();
