const fs = require('fs').promises;
const path = require('path');
const https = require('https');

// Constants
const OUTPUT_DIR = './public';
const POSTS_PER_PAGE = 10;
const TEMPLATES_DIR = path.join(__dirname, 'templates');
const FILE_CONCURRENCY_LIMIT = 100; // Increased for SSDs

// Track total number of generated files
let totalFilesGenerated = 0;

// Optimized concurrency control
async function processWithConcurrency(items, processorFn) {
  const batchSize = FILE_CONCURRENCY_LIMIT;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(item => processorFn(item)));
  }
}

// Pre-create all directories first
async function ensureDirectories(filePaths) {
  const dirs = new Set();
  filePaths.forEach(filePath => {
    dirs.add(path.dirname(filePath));
  });
  await Promise.all([...dirs].map(dir => fs.mkdir(dir, { recursive: true })));
}

// Generate paginated files (optimized)
async function generatePaginatedFiles({ items, pageSize, basePath, itemMapper, pageMapper }) {
  const baseDir = path.join(OUTPUT_DIR, basePath);
  const pageDir = path.join(baseDir, 'page');
  
  // Pre-create all needed directories
  await Promise.all([
    fs.mkdir(baseDir, { recursive: true }),
    fs.mkdir(pageDir, { recursive: true })
  ]);

  // Prepare all file paths first
  const itemFilePaths = items.map(item => 
    path.join(baseDir, `${item.id}.json`)
  );
  const pageFilePaths = [
    path.join(baseDir, 'index.json'),
    ...Array.from({ length: Math.ceil(items.length / pageSize) - 1 }, (_, i) => 
      path.join(pageDir, `${i + 2}.json`)
    )
  ];

  // Create all directories at once
  await ensureDirectories([...itemFilePaths, ...pageFilePaths]);

  // Process items in optimized batches
  await processWithConcurrency(items, async (item) => {
    const filePath = path.join(baseDir, `${item.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(itemMapper(item), null, 2));
    totalFilesGenerated++;
    if (totalFilesGenerated <= 3) console.log(`Generated item file: ${filePath}`);
  });

  // Generate paginated files
  const paginatedItems = paginateItems(items, pageSize);
  await processWithConcurrency(
    paginatedItems.map((page, index) => ({ page, index })),
    async ({ page, index }) => {
      const pageNumber = index + 1;
      const filePath = pageNumber === 1 
        ? path.join(baseDir, 'index.json')
        : path.join(pageDir, `${pageNumber}.json`);
      await fs.writeFile(filePath, JSON.stringify(pageMapper(page, pageNumber, paginatedItems.length), null, 2));
      totalFilesGenerated++;
      if (index < 3) console.log(`Generated paginated file: ${filePath}`);
    }
  );
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
