const fs = require('fs');
const path = require('path');

// Input JSON data (replace this with your actual JSON source)
const jsonData = [
  {
    id: "v50626",
    title: "This Never Happened",
    image: { url: "https://t.vndb.org/cv/54/75554.jpg" },
    developers: [{ id: "p21697", name: "Shitsumon Kai" }],
    aliases: [],
    description: "This is a short story about events of the relationship Flynn and Leo had in [url=/v18157]Echo[/url]."
  },
  {
    description: "Sisterly Camp is an immersive adult visual novel...",
    developers: [{ name: "InkandTease", id: "p21698" }],
    aliases: [],
    image: { url: "https://t.vndb.org/cv/55/75555.jpg" },
    title: "Sisterly Camp",
    id: "v50627"
  },
  {
    description: "I, Wolfe is a linear furry visual novel...",
    developers: [{ name: "KraajLanding", id: "p20222" }],
    aliases: [],
    title: "I, Wolfe",
    image: { url: "https://t.vndb.org/cv/56/75556.jpg" },
    id: "v50628"
  }
];

// Output directory
const outputDir = './public';

// Ensure the output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Pagination settings
const postsPerPage = 2; // Number of posts per page

// Function to split posts into pages
function paginatePosts(posts, pageSize) {
  const paginated = [];
  for (let i = 0; i < posts.length; i += pageSize) {
    paginated.push(posts.slice(i, i + pageSize));
  }
  return paginated;
}

// Main function to process the JSON data
function main() {
  try {
    // Validate the input JSON
    if (!Array.isArray(jsonData)) {
      throw new Error("The input data is not an array.");
    }

    const posts = jsonData;

    if (posts.length === 0) {
      console.warn('Warning: The "posts" array is empty. No files will be generated.');
      return;
    }

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
