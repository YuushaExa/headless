const fs = require('fs');
const path = require('path');
const https = require('https'); // For fetching remote JSON

// Remote JSON URL
const dataUrl = 'https://raw.githubusercontent.com/YuushaExa/testapi/refs/heads/main/merged.json';

// Output directory
const outputDir = './public';
if (!fs.existsSync(path.join(outputDir, 'index'))) {
  fs.mkdirSync(path.join(outputDir, 'index'), { recursive: true });
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

    // Generate individual post files
    posts.forEach(post => {
      const postFilePath = path.join(outputDir, 'posts', `${post.id}.json`);
      fs.writeFileSync(postFilePath, JSON.stringify(post, null, 2));
    });

    // Generate paginated index files
    const totalPages = paginatedPosts.length;
    const paginationData = paginatedPosts.map((pagePosts, pageIndex) => {
      const pageFileName = `${pageIndex + 1}.json`;
      const indexPath = path.join(outputDir, 'index', pageFileName);

      // Write the paginated posts for this index page to a file
      fs.writeFileSync(indexPath, JSON.stringify(pagePosts, null, 2));

      return {
        currentPage: pageIndex + 1,
        totalPages: totalPages,
        nextPage: pageIndex + 2 <= totalPages ? `index/${pageIndex + 2}.json` : null,
        previousPage: pageIndex > 0 ? `index/${pageIndex}.json` : null,
        posts: pagePosts.map(post => ({
          id: post.id,
          title: post.title,
          link: `posts/${post.id}.json`
        }))
      };
    });

    // Save pagination.json
    const paginationPath = path.join(outputDir, 'pagination.json');
    fs.writeFileSync(paginationPath, JSON.stringify(paginationData, null, 2));

    console.log('JSON generation complete!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1); // Exit with an error code
  }
}
