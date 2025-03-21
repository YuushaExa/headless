const fs = require('fs').promises;
const path = require('path');
const https = require('https');

// Constants
const OUTPUT_DIR = './public';
const TEMPLATES_DIR = './templates';

// Track total number of generated files
let totalFilesGenerated = 0;

// Utility function to write JSON files with consistent formatting
async function writeJsonFile(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// Fetch JSON data from a URL
function fetchData(url) {
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

// Load templates from the templates directory
async function loadTemplates() {
  try {
    const templateFiles = await fs.readdir(TEMPLATES_DIR);
    console.log('Template files found:', templateFiles); // Debugging log

    const templates = {};
    for (const file of templateFiles) {
      const templateName = path.basename(file, '.js');
      console.log(`Loading template: ${templateName}`); // Debugging log
      templates[templateName] = require(path.join(TEMPLATES_DIR, file));
    }

    return templates;
  } catch (error) {
    console.error('Error loading templates:', error.message);
    throw error;
  }
}

// Main function
async function main() {
  try {
    console.time('File generation time');

    // Load templates
    const templates = await loadTemplates();

    // Process each template
    for (const [templateName, template] of Object.entries(templates)) {
      console.log(`Processing template: ${templateName}`);

      // Delegate file generation to the template
      await template.generateFiles({
        fetchData,
        generatePaginatedFiles,
      });
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
