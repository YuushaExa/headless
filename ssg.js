const fs = require('fs').promises; // Use promises for async file operations
const path = require('path');
const https = require('https');

// Constants
const DATA_URL = 'https://raw.githubusercontent.com/YuushaExa/testapi/refs/heads/main/merged.json';
const OUTPUT_DIR = './public';
const POSTS_PER_PAGE = 10;

// Ensure directory exists
async function ensureDirectoryExists(dir) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

// Fetch JSON data from a URL using native https
async function fetchData(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch data. Status code: ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error(`Error parsing JSON: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`Error fetching data: ${error.message}`));
    });
  });
}

// Paginate items into chunks
function paginateItems(items, pageSize) {
  return Array.from({ length: Math.ceil(items.length / pageSize) }, (_, i) =>
    items.slice(i * pageSize, (i + 1) * pageSize)
  );
}

// Generate individual item files
async function generateItemFiles(items, baseDir, itemMapper) {
  await Promise.all(
    items.map(async (item) => {
      const filePath = path.join(baseDir, `${item.id}.json`);
      const itemData = itemMapper(item);
      await fs.writeFile(filePath, JSON.stringify(itemData, null, 2));
    })
  );
}

// Generate paginated index files
async function generatePaginatedIndex(paginatedItems, baseDir, pageMapper) {
  await Promise.all(
    paginatedItems.map(async (page, index) => {
      const pageNumber = index + 1;
      const filePath = path.join(baseDir, `${pageNumber}.json`);
      const pageData = pageMapper(page, pageNumber, paginatedItems.length);
      await fs.writeFile(filePath, JSON.stringify(pageData, null, 2));
    })
  );
}

// Generate paginated files for a given type
async function generatePaginatedFiles(config) {
  const { items, pageSize, basePath, itemMapper, pageMapper } = config;
  const baseDir = path.join(OUTPUT_DIR, basePath);

  await ensureDirectoryExists(baseDir);

  // Generate individual item files
  await generateItemFiles(items, baseDir, itemMapper);

  // Paginate items and generate index files
  const paginatedItems = paginateItems(items, pageSize);
  await generatePaginatedIndex(paginatedItems, baseDir, pageMapper);
}

// Extract developers from posts
function extractDevelopers(posts) {
  const developersMap = new Map();

  posts.forEach((post) => {
    post.developers?.forEach((developer) => {
      if (!developersMap.has(developer.id)) {
        developersMap.set(developer.id, {
          ...developer,
          posts: [],
        });
      }
      developersMap.get(developer.id).posts.push({
        id: post.id,
        title: post.title,
        image: post.image || null,
        link: `posts/${post.id}.json`,
      });
    });
  });

  return Array.from(developersMap.values());
}

// Main function
async function main() {
  try {
    // Fetch and validate data
    const data = await fetchData(DATA_URL);
    if (!Array.isArray(data)) throw new Error('Fetched data is not an array.');
    if (data.length === 0) {
      console.warn('Warning: No data found. Exiting.');
      return;
    }

    // Generate paginated files for posts
    await generatePaginatedFiles({
      items: data,
      pageSize: POSTS_PER_PAGE,
      basePath: 'posts',
      itemMapper: (post) => ({
        id: post.id,
        title: post.title,
        developers: post.developers || [],
        aliases: post.aliases || [],
        description: post.description || null,
        image: post.image || null,
      }),
      pageMapper: (pagePosts, currentPage, totalPages) => ({
        currentPage,
        totalPages,
        nextPage: currentPage < totalPages ? `${currentPage + 1}.json` : null,
        previousPage: currentPage > 1 ? `${currentPage - 1}.json` : null,
        posts: pagePosts.map((post) => ({
          id: post.id,
          title: post.title,
          image: post.image || null,
          link: `posts/${post.id}.json`,
        })),
      }),
    });

    // Generate paginated files for developers
    const developers = extractDevelopers(data);
    await generatePaginatedFiles({
      items: developers,
      pageSize: POSTS_PER_PAGE,
      basePath: 'developers',
      itemMapper: (developer) => ({
        name: developer.name,
        id: developer.id,
        posts: developer.posts,
        link: `developers/${developer.id}.json`,
      }),
      pageMapper: (pageDevelopers, currentPage, totalPages) => ({
        currentPage,
        totalPages,
        nextPage: currentPage < totalPages ? `${currentPage + 1}.json` : null,
        previousPage: currentPage > 1 ? `${currentPage - 1}.json` : null,
        developers: pageDevelopers.map((dev) => ({
          name: dev.name,
          id: dev.id,
          link: `developers/${dev.id}.json`,
        })),
      }),
    });

    console.log('JSON generation complete!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
