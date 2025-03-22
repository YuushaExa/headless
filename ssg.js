const fs = require('fs').promises;
const path = require('path');
const https = require('https');

// Constants
const OUTPUT_DIR = './public';
const POSTS_PER_PAGE = 10;
const TEMPLATES_DIR = path.join(__dirname, 'templates'); // Use absolute path

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

// Generate paginated files for a given type
async function generatePaginatedFiles({ items, pageSize, basePath, itemMapper, pageMapper, fileNameGenerator = (item) => `${item.id}.json` }) {
  const baseDir = path.join(OUTPUT_DIR, basePath);
  await fs.mkdir(baseDir, { recursive: true });

  // Generate individual item files
  await Promise.all(
    items.map(async (item, index) => {
      const filePath = path.join(baseDir, fileNameGenerator(item));
      await writeJsonFile(filePath, itemMapper(item));

      totalFilesGenerated++;
      if (index < 3) { // Log only the first 3 files
        console.log(`Generated item file: ${filePath}`);
      }
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

// Helper function to tokenize text
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove punctuation
    .split(/\s+/) // Split by whitespace
    .filter((word) => word.length > 2); // Ignore short words
}

// Define alphabetical ranges
const ranges = [
  { name: 'a-c', test: (word) => /^[a-c]/.test(word) },
  { name: 'd-f', test: (word) => /^[d-f]/.test(word) },
  { name: 'g-i', test: (word) => /^[g-i]/.test(word) },
  { name: 'j-l', test: (word) => /^[j-l]/.test(word) },
  { name: 'm-o', test: (word) => /^[m-o]/.test(word) },
  { name: 'p-s', test: (word) => /^[p-s]/.test(word) },
  { name: 't-v', test: (word) => /^[t-v]/.test(word) },
  { name: 'w-z', test: (word) => /^[w-z]/.test(word) }
];

// Function to generate a single search index for the full VN dataset
// Function to generate a single search index for the full VN dataset
async function generateSearchIndexes(data, basePath) {
  // Initialize inverted indexes for each range
  const rangeIndexes = {};
  ranges.forEach((range) => {
    rangeIndexes[range.name] = {};
  });

  // Metadata storage
  const metadata = {};

  data.forEach((doc) => {
    const id = doc.id;
    metadata[id] = doc;

    // Tokenize title and description
    const tokens = [...tokenize(doc.title), ...tokenize(doc.description || '')];

    tokens.forEach((word) => {
      // Add word to the appropriate range index
      const range = ranges.find((r) => r.test(word));
      if (range) {
        // Initialize as a Set if it doesn't exist
        if (!rangeIndexes[range.name][word]) {
          rangeIndexes[range.name][word] = new Set();
        }
        // Add the document ID to the Set
        rangeIndexes[range.name][word].add(id);
      }
    });
  });

  // Convert Sets to Arrays for JSON serialization
  for (const range of ranges) {
    for (const word in rangeIndexes[range.name]) {
      rangeIndexes[range.name][word] = Array.from(rangeIndexes[range.name][word]);
    }
  }

  // Create a directory for the full VN search index
  const searchIndexDir = path.join(OUTPUT_DIR, basePath, 'search-index');
  await fs.mkdir(searchIndexDir, { recursive: true });

  // Save each range index and metadata
  await Promise.all([
    ...ranges.map((range) =>
      writeJsonFile(path.join(searchIndexDir, `index-${range.name}.json`), rangeIndexes[range.name])
    ),
    writeJsonFile(path.join(searchIndexDir, 'metadata.json'), metadata),
  ]);

  console.log(`Full VN search index and metadata built successfully for ${basePath}.`);
}

// Main function
// Main function
async function main() {
  try {
    console.time('File generation time');

    // Load templates
    const templates = await fs.readdir(TEMPLATES_DIR);

    for (const templateFile of templates) {
      const templatePath = path.join(TEMPLATES_DIR, templateFile);
      console.log(`Loading template: ${templatePath}`);
      const template = require(templatePath);

      // Fetch data for the template
      console.log(`Fetching data for template: ${template.basePath}`);
      const data = await fetchData(template.dataUrl);
      if (!Array.isArray(data)) throw new Error(`Fetched data for ${template.basePath} is not an array.`);
      if (data.length === 0) {
        console.warn(`Warning: No data found for ${template.basePath}. Skipping.`);
        continue;
      }

      // Generate paginated files for the main items (posts)
      await generatePaginatedFiles({
        items: data,
        pageSize: POSTS_PER_PAGE,
        basePath: template.basePath, // `vn/posts`
        itemMapper: template.itemMapper,
        pageMapper: template.pageMapper,
      });

      // Generate related entities (developers)
      if (template.generateRelatedEntities) {
        await template.generateRelatedEntities(data, generatePaginatedFiles, POSTS_PER_PAGE);
      }

      // Generate a single search index for the full VN dataset
      await generateSearchIndexes(data, template.basePath);
    }

    console.timeEnd('File generation time');
    console.log(`Generated ${totalFilesGenerated} files in total.`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
