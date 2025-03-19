const fs = require('fs');
const path = require('path');
const https = require('https');

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

// Function to split items into pages
function paginateItems(items, pageSize) {
  const paginated = [];
  for (let i = 0; i < items.length; i += pageSize) {
    paginated.push(items.slice(i, i + pageSize));
  }
  return paginated;
}

// Generic function to generate paginated index files and individual pages
async function generatePaginatedFiles(config) {
  const { type, items, pageSize, basePath, itemMetadataMapper, pageMetadataMapper } = config;

  // Ensure the base directory exists
  const baseDir = path.join(outputDir, basePath);
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  // Generate individual item files
  items.forEach(item => {
    const itemFilePath = path.join(baseDir, `${item.id}.json`);
    const itemMetadata = itemMetadataMapper(item);
    fs.writeFileSync(itemFilePath, JSON.stringify(itemMetadata, null, 2));
  });

  // Paginate the items
  const paginatedItems = paginateItems(items, pageSize);

  // Generate paginated index files
  paginatedItems.forEach((pageItems, pageIndex) => {
    const pageFileName = `${pageIndex + 1}.json`;
    const indexPath = path.join(baseDir, pageFileName);

    const pageMetadata = pageMetadataMapper(pageItems, pageIndex + 1, paginatedItems.length);
    fs.writeFileSync(indexPath, JSON.stringify(pageMetadata, null, 2));
  });
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
    const postsPerPage = 10;

    // Configuration for posts
    const postsConfig = {
      type: 'posts',
      items: posts,
      pageSize: postsPerPage,
      basePath: 'posts',
      itemMetadataMapper: (post) => ({
        id: post.id,
        title: post.title,
        developers: post.developers || [],
        aliases: post.aliases || [],
        description: post.description || null,
        image: post.image || null
      }),
      pageMetadataMapper: (pagePosts, currentPage, totalPages) => ({
        currentPage,
        totalPages,
        nextPage: currentPage + 1 <= totalPages ? `index/${currentPage + 1}.json` : null,
        previousPage: currentPage > 1 ? `index/${currentPage - 1}.json` : null,
        posts: pagePosts.map(post => ({
          id: post.id,
          title: post.title,
          image: post.image || null,
          link: `posts/${post.id}.json`
        }))
      })
    };

    // Generate paginated files for posts
    await generatePaginatedFiles(postsConfig);

    // Extract developers and map their posts
    const developersMap = {};
    posts.forEach(post => {
      if (Array.isArray(post.developers)) {
        post.developers.forEach(developer => {
          const devId = developer.id;
          if (!developersMap[devId]) {
            developersMap[devId] = {
              name: developer.name,
              id: developer.id,
              posts: []
            };
          }
          developersMap[devId].posts.push({
            id: post.id,
            title: post.title,
            image: post.image || null,
            link: `posts/${post.id}.json`
          });
        });
      }
    });

    // Configuration for developers
    const developersConfig = {
      type: 'developers',
      items: Object.values(developersMap),
      pageSize: postsPerPage,
      basePath: 'developers',
      itemMetadataMapper: (developer) => ({
        name: developer.name,
        id: developer.id,
        posts: developer.posts
      }),
      pageMetadataMapper: (pageDevelopers, currentPage, totalPages) => ({
        currentPage,
        totalPages,
        nextPage: currentPage + 1 <= totalPages ? `developers/${currentPage + 1}.json` : null,
        previousPage: currentPage > 1 ? `developers/${currentPage - 1}.json` : null,
        developers: pageDevelopers
      })
    };

    // Generate paginated files for developers
    await generatePaginatedFiles(developersConfig);

    console.log('JSON generation complete!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1); // Exit with an error code
  }
}

// Run the main function
main();
