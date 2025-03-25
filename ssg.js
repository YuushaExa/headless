const fs = require('fs').promises;
const path = require('path');
const https = require('https');

// Constants
const OUTPUT_DIR = './public';
const POSTS_PER_PAGE = 10;
const TEMPLATES_DIR = path.join(__dirname, 'templates');
const FILE_CONCURRENCY_LIMIT = 2000; // Safe number of concurrent file operations

// Track total number of generated files
let totalFilesGenerated = 0;

// Concurrency control helper
async function processWithConcurrency(items, concurrencyLimit, processorFn) {
  const results = [];
  const activeTasks = [];
  
  for (const item of items) {
    if (activeTasks.length >= concurrencyLimit) {
      await Promise.race(activeTasks);
    }

    const task = Promise.resolve().then(() => processorFn(item));
    activeTasks.push(task);
    task.then(() => {
      activeTasks.splice(activeTasks.indexOf(task), 1);
      return null;
    });
    results.push(task);
  }

  return Promise.all(results);
}

// Utility function to write JSON files
async function writeJsonFile(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// Fetch JSON data from a URL
async function fetchData(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch data. Status code: ${res.statusCode}`));
      }
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

// Generate paginated index files
async function generatePaginatedIndex(paginatedItems, baseDir, pageMapper) {
  const pageDir = path.join(baseDir, 'page');
  await fs.mkdir(pageDir, { recursive: true });

  await processWithConcurrency(
    paginatedItems.map((page, index) => ({ page, index })),
    FILE_CONCURRENCY_LIMIT,
    async ({ page, index }) => {
      const pageNumber = index + 1;
      const filePath = pageNumber === 1 
        ? path.join(baseDir, 'index.json')
        : path.join(pageDir, `${pageNumber}.json`);
      await writeJsonFile(filePath, pageMapper(page, pageNumber, paginatedItems.length));
      totalFilesGenerated++;
      if (index < 3) console.log(`Generated paginated file: ${filePath}`);
    }
  );
}

// Generate paginated files for a given type
async function generatePaginatedFiles({ items, pageSize, basePath, itemMapper, pageMapper, fileNameGenerator = (item) => `${item.id}.json` }) {
  const baseDir = path.join(OUTPUT_DIR, basePath);
  await fs.mkdir(baseDir, { recursive: true });

  // Generate individual item files with concurrency control
  await processWithConcurrency(
    items,
    FILE_CONCURRENCY_LIMIT,
    async (item) => {
      const filePath = path.join(baseDir, fileNameGenerator(item));
      await writeJsonFile(filePath, itemMapper(item));
      totalFilesGenerated++;
      if (totalFilesGenerated <= 3) {
        console.log(`Generated item file: ${filePath}`);
      }
    }
  );

  // Paginate items and generate index files
  const paginatedItems = paginateItems(items, pageSize);
  await generatePaginatedIndex(paginatedItems, baseDir, pageMapper);
}

// Main function
async function main() {
  try {
    console.time('File generation time');
    const templates = await fs.readdir(TEMPLATES_DIR);

    // Process all templates concurrently
    await Promise.all(templates.map(async (templateFile) => {
      const templatePath = path.join(TEMPLATES_DIR, templateFile);
      console.log(`Loading template: ${templatePath}`);
      const template = require(templatePath);

      // Fetch data for the template
      console.log(`Fetching data for template: ${template.basePath}`);
      const data = await fetchData(template.dataUrl);
      if (!Array.isArray(data)) throw new Error(`Fetched data for ${template.basePath} is not an array.`);
      if (data.length === 0) {
        console.warn(`Warning: No data found for ${template.basePath}. Skipping.`);
        return;
      }

      // Create an array of all generation tasks for this template
      const generationTasks = [];

      // 1. Main posts generation
      generationTasks.push(
        generatePaginatedFiles({
          items: data,
          pageSize: POSTS_PER_PAGE,
          basePath: template.basePath,
          itemMapper: template.itemMapper,
          pageMapper: template.pageMapper,
        })
      );

      // 2. Related entities generation (if exists)
      if (template.generateRelatedEntities) {
        generationTasks.push(
          template.generateRelatedEntities(data, generatePaginatedFiles, POSTS_PER_PAGE)
        );
      }

      // 3. Search index generation (if exists)
      if (template.generateSearchIndex) {
        generationTasks.push(
          template.generateSearchIndex(data, OUTPUT_DIR)
        );
      }

      // Run all generation tasks for this template concurrently
      await Promise.all(generationTasks);
    }));

    console.timeEnd('File generation time');
    console.log(`Generated ${totalFilesGenerated} files in total.`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
