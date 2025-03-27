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

async function generatePaginatedFiles({ items, pageSize, basePath, itemMapper, pageMapper, fileNameGenerator, typeName = 'items' }) {
  if (!fileNameGenerator) {
      throw new Error(`fileNameGenerator is required for generatePaginatedFiles (called for ${typeName})`);
  }
  const baseDir = path.join(OUTPUT_DIR, basePath);
  await fs.mkdir(baseDir, { recursive: true });

  const generatedFiles = []; // Keep track of files generated in this call

  // Generate individual item files
  await Promise.all(
    items.map(async (item) => {
      const filePath = path.join(baseDir, fileNameGenerator(item));
      await writeJsonFile(filePath, itemMapper(item));
      generatedFiles.push(filePath);
      fileCounter.increment(); // Use counter object
    })
  );

  // Log snippet of item files generated
  console.log(`Generated ${items.length} ${typeName} files in ${baseDir}.`);
  if (items.length > 0) {
      console.log(` -> Example: ${generatedFiles.slice(0, Math.min(3, generatedFiles.length)).map(f => path.relative(OUTPUT_DIR, f)).join(', ')}`);
  }


  // Paginate items and generate index files
  const paginatedItems = paginateItems(items, pageSize);
  await generatePaginatedIndex(paginatedItems, baseDir, pageMapper, typeName);
}

// Modify the generatePaginatedIndex function
async function generatePaginatedIndex(paginatedItems, baseDir, pageMapper, typeName = 'items') {
  if (paginatedItems.length === 0) {
      console.log(`No ${typeName} pagination files to generate.`);
      return;
  }

  const pageDir = path.join(baseDir, 'page');
  if (paginatedItems.length > 1) { // Only create page dir if needed
    await fs.mkdir(pageDir, { recursive: true });
  }

  const generatedFiles = [];

  await Promise.all(
    paginatedItems.map(async (page, index) => {
      const pageNumber = index + 1;
      const isFirstPage = pageNumber === 1;
      // Determine filename: index.json for page 1, page/N.json otherwise
      const relativeFilePath = isFirstPage ? 'index.json' : path.join('page', `${pageNumber}.json`);
      const filePath = path.join(baseDir, relativeFilePath);

      await writeJsonFile(filePath, pageMapper(page, pageNumber, paginatedItems.length));
      generatedFiles.push(filePath);
      fileCounter.increment(); // Use counter object
    })
  );

  // Log snippet of pagination files generated
  console.log(`Generated ${paginatedItems.length} ${typeName} pagination files.`);
   if (paginatedItems.length > 0) {
      console.log(` -> Example: ${generatedFiles.slice(0, Math.min(3, generatedFiles.length)).map(f => path.relative(OUTPUT_DIR, f)).join(', ')}`);
   }
   console.log(''); // Add a newline for better separation
}


// Main function
async function main() {
  try {
    console.time('File generation time');
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true }); // Clean output dir
    console.log(`Cleaned output directory: ${OUTPUT_DIR}`);
    await fs.mkdir(OUTPUT_DIR, { recursive: true });


    // Load templates
    const templates = await fs.readdir(TEMPLATES_DIR);

    for (const templateFile of templates) {
      if (!templateFile.endsWith('.js')) continue; // Skip non-js files

      const templatePath = path.join(TEMPLATES_DIR, templateFile);
      console.log(`\n--- Processing Template: ${templateFile} ---`);
      const template = require(templatePath); // Use require for simplicity here

      // Fetch data for the template
      console.log(`Fetching data from: ${template.dataUrl}`);
      const data = await fetchData(template.dataUrl);
      if (!Array.isArray(data)) throw new Error(`Fetched data for ${template.basePath} is not an array.`);
      if (data.length === 0) {
        console.warn(`Warning: No data found for ${template.basePath}. Skipping generation.`);
        continue;
      }
      console.log(`Fetched ${data.length} items.`);

      // Generate main items using the template's function
      if (template.generateItems) {
        // Pass the necessary arguments: data, the utility function, and the constant
        await template.generateItems(data, generatePaginatedFiles, POSTS_PER_PAGE);
      } else {
        console.warn(`Template ${templateFile} does not have a generateItems function.`);
      }

      // Generate related entities (if defined in the template)
      if (template.generateRelatedEntities) {
        // Pass the necessary arguments
        await template.generateRelatedEntities(data, generatePaginatedFiles, POSTS_PER_PAGE);
      }

      // Generate search index (if defined in the template)
      if (template.generateSearchIndex) {
         // Pass the necessary arguments
        await template.generateSearchIndex(data, OUTPUT_DIR, fileCounter); // Pass counter object
      }

      console.log(`--- Finished Template: ${templateFile} ---`);
    }

    console.timeEnd('File generation time');
    // Use the counter object's value
    console.log(`\nGenerated ${fileCounter.value} files in total.`);
  } catch (error) {
    console.error('\n--- ERROR ---');
    console.error(error.message);
    console.error(error.stack); // Print stack trace for better debugging
    process.exit(1);
  }
}

// Run the script
main();
