const fs = require('fs').promises;
const path = require('path');
const https = require('https');

// Constants
const DATA_URL = 'https://raw.githubusercontent.com/YuushaExa/testapi/refs/heads/main/merged.json';
const OUTPUT_DIR = './public';
const POSTS_PER_PAGE = 10;

// Track total number of generated files
let totalFilesGenerated = 0;

// Ensure directory exists
async function ensureDirectoryExists(dir) {
  await fs.mkdir(dir, { recursive: true }).catch(() => {});
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

// Generate files in parallel
async function generateFiles(items, baseDir, fileMapper, filePrefix = '') {
  await ensureDirectoryExists(baseDir);
  await Promise.all(items.map(async (item, index) => {
    const filePath = path.join(baseDir, `${filePrefix}${item.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(fileMapper(item)));
    totalFilesGenerated++; // Count each individual file
    if (index < 3) console.log(`Generated file: ${filePath}`);
  }));
}

// Generate paginated index files
async function generatePaginatedIndex(paginatedItems, baseDir, pageMapper) {
  await ensureDirectoryExists(path.join(baseDir, 'page'));
  await Promise.all(paginatedItems.map(async (page, index) => {
    const pageNumber = index + 1;
    const filePath = pageNumber === 1
      ? path.join(baseDir, 'index.json')
      : path.join(baseDir, 'page', `${pageNumber}.json`);
    await fs.writeFile(filePath, JSON.stringify(pageMapper(page, pageNumber, paginatedItems.length)));
    totalFilesGenerated++; // Count each paginated file
    if (index < 3) console.log(`Generated paginated file: ${filePath}`);
  }));
}

// Extract developers from posts
function extractDevelopers(posts) {
  const developersMap = new Map();
  posts.forEach((post) => {
    post.developers?.forEach((developer) => {
      if (!developersMap.has(developer.id)) {
        developersMap.set(developer.id, { ...developer, posts: [] });
      }
      developersMap.get(developer.id).posts.push({
        id: post.id,
        title: post.title,
        image: post.image || null,
        link: `vn/${post.id}.json`,
      });
    });
  });
  return Array.from(developersMap.values());
}

// Main function
async function main() {
  try {
    console.time('File generation time');

    const data = await fetchData(DATA_URL);
    if (!Array.isArray(data) || data.length === 0) throw new Error('Invalid or empty data.');

    // Generate paginated files for posts
    const postMapper = (post) => ({
      id: post.id,
      title: post.title,
      developers: post.developers || [],
      aliases: post.aliases || [],
      description: post.description || null,
      image: post.image || null,
    });

    const postPageMapper = (pagePosts, currentPage, totalPages) => ({
      posts: pagePosts.map((post) => ({
        id: post.id,
        title: post.title,
        image: post.image || null,
        link: `vn/${post.id}.json`,
      })),
      pagination: {
        currentPage,
        totalPages,
        nextPage: currentPage < totalPages
          ? currentPage === 1 ? 'vn/page/2.json' : `vn/page/${currentPage + 1}.json`
          : null,
        previousPage: currentPage > 1
          ? currentPage === 2 ? 'index.json' : `vn/page/${currentPage - 1}.json`
          : null,
      },
    });

    await generateFiles(data, path.join(OUTPUT_DIR, 'vn'), postMapper);
    await generatePaginatedIndex(paginateItems(data, POSTS_PER_PAGE), path.join(OUTPUT_DIR, 'vn'), postPageMapper);

    // Generate paginated files for developers
    const developers = extractDevelopers(data);
    const devMapper = (developer) => ({
      name: developer.name,
      id: developer.id,
      posts: developer.posts,
      link: `vn/developers/${developer.id}.json`,
    });

    const devPageMapper = (pageDevelopers, currentPage, totalPages) => ({
      developers: pageDevelopers.map((dev) => ({
        name: dev.name,
        id: dev.id,
        link: `vn/developers/${dev.id}.json`,
      })),
      pagination: {
        currentPage,
        totalPages,
        nextPage: currentPage < totalPages
          ? currentPage === 1 ? 'vn/developers/page/2.json' : `vn/developers/page/${currentPage + 1}.json`
          : null,
        previousPage: currentPage > 1
          ? currentPage === 2 ? 'vn/developers.json' : `vn/developers/page/${currentPage - 1}.json`
          : null,
      },
    });

    await generateFiles(developers, path.join(OUTPUT_DIR, 'vn/developers'), devMapper);
    await generatePaginatedIndex(paginateItems(developers, POSTS_PER_PAGE), path.join(OUTPUT_DIR, 'vn/developers'), devPageMapper);

    console.timeEnd('File generation time');
    console.log(`Generated ${totalFilesGenerated} files in total.`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
