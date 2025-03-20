const fs = require('fs').promises;
const path = require('path');
const https = require('https');

// Constants
const DATA_URLS = {
  vn: 'https://raw.githubusercontent.com/YuushaExa/testapi/refs/heads/main/merged.json',
  movies: 'https://example.com/movies-data.json', // Example URL for movies data
};
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

// Generate individual item files
async function generateItemFiles(items, baseDir, itemMapper) {
  const writePromises = items.map(async (item, index) => {
    const filePath = path.join(baseDir, `${item.id}.json`);
    const itemData = itemMapper(item);
    await writeJsonFile(filePath, itemData);

    totalFilesGenerated++;
    if (index < 3) console.log(`Generated item file: ${filePath}`);
  });

  await Promise.all(writePromises); // Write all files in parallel
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
      const pageData = pageMapper(page, pageNumber, paginatedItems.length);
      await writeJsonFile(filePath, pageData);

      totalFilesGenerated++;
      if (index < 3) console.log(`Generated paginated file: ${filePath}`);
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

    // Fetch and process VN data
    const vnData = await fetchData(DATA_URLS.vn);
    if (!Array.isArray(vnData) || vnData.length === 0) throw new Error('Invalid or empty VN data.');

    // Process VN posts
    await generatePaginatedFiles({
      items: vnData,
      pageSize: POSTS_PER_PAGE,
      basePath: 'vn',
      itemMapper: (post) => ({
        id: post.id,
        title: post.title,
        developers: post.developers || [],
        aliases: post.aliases || [],
        description: post.description || null,
        image: post.image || null,
      }),
      pageMapper: (pagePosts, currentPage, totalPages) => ({
        posts: pagePosts.map((post) => ({
          id: post.id,
          title: post.title,
          image: post.image || null,
          link: `vn/${post.id}.json`,
        })),
        pagination: generatePaginationLinks(currentPage, totalPages, 'vn'),
      }),
    });

    // Process VN developers
    const vnDevelopers = extractRelatedEntities(
      vnData,
      'developers',
      'id',
      (post) => `vn/${post.id}.json`
    );

    await generatePaginatedFiles({
      items: vnDevelopers,
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

    // Fetch and process Movies data
    const moviesData = await fetchData(DATA_URLS.movies);
    if (!Array.isArray(moviesData) || moviesData.length === 0) throw new Error('Invalid or empty Movies data.');

    // Process Movies
    await generatePaginatedFiles({
      items: moviesData,
      pageSize: POSTS_PER_PAGE,
      basePath: 'movies',
      itemMapper: (movie) => ({
        id: movie.id,
        title: movie.title,
        director: movie.director || null,
        year: movie.year || null,
        genres: movie.genres || [],
        poster: movie.poster || null,
      }),
      pageMapper: (pageMovies, currentPage, totalPages) => ({
        movies: pageMovies.map((movie) => ({
          id: movie.id,
          title: movie.title,
          poster: movie.poster || null,
          link: `movies/${movie.id}.json`,
        })),
        pagination: generatePaginationLinks(currentPage, totalPages, 'movies'),
      }),
    });

    // Process Movies directors
    const moviesDirectors = extractRelatedEntities(
      moviesData,
      'directors',
      'id',
      (movie) => `movies/${movie.id}.json`
    );

    await generatePaginatedFiles({
      items: moviesDirectors,
      pageSize: POSTS_PER_PAGE,
      basePath: 'movies/directors',
      itemMapper: (director) => ({
        name: director.name,
        id: director.id,
        movies: director.items,
        link: `movies/directors/${director.id}.json`,
      }),
      pageMapper: (pageDirectors, currentPage, totalPages) => ({
        directors: pageDirectors.map((dir) => ({
          name: dir.name,
          id: dir.id,
          link: `movies/directors/${dir.id}.json`,
        })),
        pagination: generatePaginationLinks(currentPage, totalPages, 'movies/directors'),
      }),
    });

    console.timeEnd('File generation time');
    console.log(`Generated ${totalFilesGenerated} files in total.`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
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

// Run the script
main();
