const fs = require('fs').promises;
const path = require('path');
const https = require('https');

// Constants
const DATA_URL = 'https://raw.githubusercontent.com/YuushaExa/testapi/refs/heads/main/merged.json';
const OUTPUT_DIR = './public';
const POSTS_PER_PAGE = 10;

// Track total number of generated files
let totalFilesGenerated = 0;

// Utility function to write JSON files with consistent formatting
async function writeJsonFile(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// Ensure directory exists
async function ensureDirectoryExists(dir) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
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
  return Array.from({ length: Math.ceil(items.length / pageSize) }, (_, i) =>
    items.slice(i * pageSize, (i + 1) * pageSize)
  );
}

// Generate pagination links
function generatePaginationLinks(currentPage, totalPages, basePath) {
  return {
    currentPage,
    totalPages,
    nextPage:
      currentPage < totalPages
        ? currentPage === 1
          ? `${basePath}/page/2.json`
          : `${basePath}/page/${currentPage + 1}.json`
        : null,
    previousPage:
      currentPage > 1
        ? currentPage === 2
          ? 'index.json'
          : `${basePath}/page/${currentPage - 1}.json`
        : null,
  };
}

// Generate paginated files for a given type
async function generatePaginatedFiles({
  items,
  pageSize,
  basePath,
  itemMapper,
  pageMapper,
  fileNameGenerator = (item) => `${item.id}.json`,
}) {
  const baseDir = path.join(OUTPUT_DIR, basePath);
  await ensureDirectoryExists(baseDir);

  // Generate individual item files
  await Promise.all(
    items.map(async (item, index) => {
      const filePath = path.join(baseDir, fileNameGenerator(item));
      await writeJsonFile(filePath, itemMapper(item));

      totalFilesGenerated++;
      if (index < 3) console.log(`Generated item file: ${filePath}`);
    })
  );

  // Paginate items and generate index files
  const paginatedItems = paginateItems(items, pageSize);
  await generatePaginatedIndex(paginatedItems, baseDir, pageMapper);
}

// Generate paginated index files
async function generatePaginatedIndex(paginatedItems, baseDir, pageMapper) {
  await ensureDirectoryExists(path.join(baseDir, 'page'));

  await Promise.all(
    paginatedItems.map(async (page, index) => {
      const pageNumber = index + 1;
      const filePath =
        pageNumber === 1
          ? path.join(baseDir, 'index.json')
          : path.join(baseDir, 'page', `${pageNumber}.json`);
      await writeJsonFile(filePath, pageMapper(page, pageNumber, paginatedItems.length));

      totalFilesGenerated++;
      if (index < 3) console.log(`Generated paginated file: ${filePath}`);
    })
  );
}

// Extract related entities (e.g., developers, publishers)
function extractRelatedEntities(items, entityKey, idKey, linkGenerator) {
  const entityMap = new Map();

  items.forEach((item) => {
    item[entityKey]?.forEach((entity) => {
      if (!entityMap.has(entity[idKey])) {
        entityMap.set(entity[idKey], { ...entity, items: [] });
      }
      entityMap.get(entity[idKey]).items.push({
        id: item.id,
        title: item.title,
        image: item.image || null,
        link: linkGenerator(item),
      });
    });
  });

  return Array.from(entityMap.values());
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
      basePath: 'vn',
      itemMapper: (post) => ({
        id: post.id,
        title: post.title,
 developers: (post.developers || []).map((developer) => ({
    name: developer.name,
    id: developer.id,
    link: `vn/developers/${developer.id}.json`,
  })),
        aliases: post.aliases || [],
        description: post.description || null,
        image: post.image || null,
      }),
      pageMapper: (pagePosts, currentPage, totalPages) => ({
        posts: pagePosts.map((post) => ({
          id: post.id,
          title: post.title,
          image: post.image || null,
          link: `vn/posts/${post.id}.json`,
        })),
        pagination: generatePaginationLinks(currentPage, totalPages, 'vn'),
      }),
    });

    // Generate paginated files for developers
    const developers = extractRelatedEntities(
      data,
      'developers',
      'id',
      (post) => `vn/${post.id}.json`
    );

    await generatePaginatedFiles({
      items: developers,
      pageSize: POSTS_PER_PAGE,
      basePath: 'vn/developers',
      itemMapper: (developer) => ({
        name: developer.name,
        id: developer.id,
        posts: developer.items,
        link: `vn/developers/${developer.id}.json`,
      }),
      pageMapper: (pageDevelopers, currentPage, totalPages) => ({
        developers: pageDevelopers.map((dev) => ({
          name: dev.name,
          id: dev.id,
          link: `vn/developers/${dev.id}.json`,
        })),
        pagination: generatePaginationLinks(currentPage, totalPages, 'vn/developers'),
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
