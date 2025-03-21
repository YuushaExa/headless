const fs = require('fs').promises;
const path = require('path');
const https = require('https');

// Constants
const DATA_URL = 'https://raw.githubusercontent.com/YuushaExa/testapi/refs/heads/main/merged.json';
const OUTPUT_DIR = './public';
const POSTS_PER_PAGE = 10;

// Paths
const POSTS_PATH = 'vn/posts';

// Track total number of generated files
let totalFilesGenerated = 0;

// Utility function to write JSON files with consistent formatting
async function writeJsonFile(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// Fetch JSON data from a URL
async function fetchData(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) reject(new Error(`Failed to fetch data. Status code: ${res.statusCode}`));
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

// Paginate items into chunks
function paginateItems(items, pageSize) {
  const pages = [];
  for (let i = 0; i < items.length; i += pageSize) {
    pages.push(items.slice(i, i + pageSize));
  }
  return pages;
}

// Generate pagination links
function generatePaginationLinks(currentPage, totalPages, basePath) {
  const nextPage = currentPage < totalPages ? `${basePath}/page/${currentPage + 1}.json` : null;
  const previousPage = currentPage > 1 ? (currentPage === 2 ? 'index.json' : `${basePath}/page/${currentPage - 1}.json`) : null;

  return { currentPage, totalPages, nextPage, previousPage };
}

// Generate paginated files for a given type
async function generatePaginatedFiles({ items, pageSize, basePath, itemMapper, pageMapper }) {
  const baseDir = path.join(OUTPUT_DIR, basePath);
  await fs.mkdir(baseDir, { recursive: true });

  // Generate individual item files
  await Promise.all(
    items.map(async (item, index) => {
      const filePath = path.join(baseDir, `${item.id}.json`);
      await writeJsonFile(filePath, itemMapper(item));

      totalFilesGenerated++;
      if (totalFilesGenerated <= 3) console.log(`Generated item file: ${filePath}`);
    })
  );

  // Paginate items and generate index files
  const paginatedItems = paginateItems(items, pageSize);
  await generatePaginatedIndex(paginatedItems, baseDir, pageMapper);
}

// Generate paginated index files
async function generatePaginatedIndex(paginatedItems, baseDir, pageMapper) {
  const pageDir = path.join(baseDir, 'page');
  await fs.mkdir(pageDir, { recursive: true });

  await Promise.all(
    paginatedItems.map(async (page, index) => {
      const pageNumber = index + 1;
      const filePath = pageNumber === 1 ? path.join(baseDir, 'index.json') : path.join(pageDir, `${pageNumber}.json`);
      await writeJsonFile(filePath, pageMapper(page, pageNumber, paginatedItems.length));

      totalFilesGenerated++;
      if (index < 3) console.log(`Generated paginated file: ${filePath}`);
    })
  );
}

// Main function
async function main() {
  try {
    console.time('File generation time');

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
      basePath: POSTS_PATH,
      itemMapper: (post) => ({
        id: post.id,
        title: post.title,
        developers: post.developers?.map((developer) => ({
          name: developer.name,
          id: developer.id,
        })),
        aliases: post.aliases || [],
        description: post.description || null,
        image: post.image || null,
        link: `${POSTS_PATH}/${post.id}.json`,
      }),
      pageMapper: (pagePosts, currentPage, totalPages) => ({
        posts: pagePosts.map((post) => ({
          id: post.id,
          title: post.title,
          image: post.image || null,
          link: `${POSTS_PATH}/${post.id}.json`,
        })),
        pagination: generatePaginationLinks(currentPage, totalPages, POSTS_PATH),
      }),
    });

    console.timeEnd('File generation time');
    console.log(`Generated ${totalFilesGenerated} files in total.`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
