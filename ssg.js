const fs = require('fs').promises;
const path = require('path');
const https = require('https');

// Constants
const OUTPUT_DIR = './public';
const POSTS_PER_PAGE = 10;
const TEMPLATES_DIR = path.join(__dirname, 'templates');

// --- Dedicated Stats Object ---
const stats = {
  totalFilesGenerated: 0,
  startTime: null,
  endTime: null,
  durationSeconds: null,
  // Can add more stats later, e.g., stats.filesByType = { posts: 0, tags: 0 };
  incrementGeneratedFiles() {
    this.totalFilesGenerated++;
  },
  recordStartTime() {
    this.startTime = Date.now();
  },
  recordEndTime() {
    this.endTime = Date.now();
    if (this.startTime) {
      this.durationSeconds = (this.endTime - this.startTime) / 1000;
    }
  },
  getSummary() {
    let summary = `Generated ${this.totalFilesGenerated} files in total.`;
    if (this.durationSeconds !== null) {
      summary += `\nFile generation time: ${this.durationSeconds.toFixed(2)} seconds.`;
    }
    return summary;
  }
};
// --- End Stats Object ---


// Utility function to write JSON files with consistent formatting
async function writeJsonFile(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// Fetch JSON data from a URL
async function fetchData(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
         // Added URL to error message
        return reject(new Error(`Failed to fetch data from ${url}. Status code: ${res.statusCode}`));
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (parseError) {
           // Added URL and specific error to message
          reject(new Error(`Failed to parse JSON from ${url}: ${parseError.message}`));
        }
      });
    }).on('error', (fetchError) => {
       // Added URL to error message
      reject(new Error(`Failed to fetch data from ${url}: ${fetchError.message}`));
    });
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

// --- Updated generatePaginatedFiles ---
// Accepts stats object in the options
async function generatePaginatedFiles({
  items,
  pageSize,
  basePath,
  itemMapper,
  pageMapper,
  fileNameGenerator,
  typeName = 'items',
  stats // Added stats parameter
}) {
  if (!fileNameGenerator) {
      throw new Error(`fileNameGenerator is required for generatePaginatedFiles (called for ${typeName})`);
  }
   // Ensure stats object is passed
  if (!stats) {
      throw new Error(`Stats object is required for generatePaginatedFiles (called for ${typeName})`);
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
      stats.incrementGeneratedFiles(); // Use stats object method
    })
  );

  // Log snippet of item files generated
  console.log(`Generated ${items.length} ${typeName} files in ${baseDir}.`);
  if (items.length > 0) {
      console.log(` -> Example: ${generatedFiles.slice(0, Math.min(3, generatedFiles.length)).map(f => path.relative(OUTPUT_DIR, f)).join(', ')}`);
  }


  // Paginate items and generate index files
  const paginatedItems = paginateItems(items, pageSize);
  // Pass stats down to generatePaginatedIndex
  await generatePaginatedIndex(paginatedItems, baseDir, pageMapper, typeName, stats);
}

// --- Updated generatePaginatedIndex ---
// Accepts stats object as a parameter
async function generatePaginatedIndex(paginatedItems, baseDir, pageMapper, typeName = 'items', stats) {
   // Ensure stats object is passed
   if (!stats) {
       throw new Error(`Stats object is required for generatePaginatedIndex (called for ${typeName})`);
   }

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
      const relativeFilePath = isFirstPage ? 'index.json' : path.join('page', `${pageNumber}.json`);
      const filePath = path.join(baseDir, relativeFilePath);

      await writeJsonFile(filePath, pageMapper(page, pageNumber, paginatedItems.length));
      generatedFiles.push(filePath);
      stats.incrementGeneratedFiles(); // Use stats object method
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
  stats.recordStartTime(); // Record start time
  // console.time('File generation time'); // Can keep for comparison or remove

  try {
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

      // --- Update Calls to Pass Stats ---

      // Wrap generatePaginatedFiles to automatically include stats
      const generatePaginatedFilesWithStats = (options) => {
         return generatePaginatedFiles({ ...options, stats });
      };


      // Generate main items using the template's function
      if (template.generateItems) {
        // Pass the wrapped function
        await template.generateItems(data, generatePaginatedFilesWithStats, POSTS_PER_PAGE);
      } else {
        console.warn(`Template ${templateFile} does not have a generateItems function.`);
      }

      // Generate related entities (if defined in the template)
      if (template.generateRelatedEntities) {
         // Pass the wrapped function
        await template.generateRelatedEntities(data, generatePaginatedFilesWithStats, POSTS_PER_PAGE);
      }

      // Generate search index (if defined in the template)
      if (template.generateSearchIndex) {
         // Pass stats directly (assuming generateSearchIndex is updated to accept it)
    await template.generateSearchIndex(data, OUTPUT_DIR, stats, writeJsonFile);
      }

      console.log(`--- Finished Template: ${templateFile} ---`);
    }

    stats.recordEndTime(); // Record end time
    // console.timeEnd('File generation time'); // Can keep or remove
    console.log(`\n${stats.getSummary()}`); // Print summary from stats object

  } catch (error) {
    stats.recordEndTime(); // Record end time even on error
    console.error('\n--- ERROR ---');
    console.error(error.message);
    console.error(error.stack); // Print stack trace for better debugging
    console.log(`\n${stats.getSummary()}`); // Still print summary if possible
    process.exit(1);
  }
}

// Run the script
main();
