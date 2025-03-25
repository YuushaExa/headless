const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const { promisify } = require('util');

// Constants
const OUTPUT_DIR = './public';
const POSTS_PER_PAGE = 10;
const TEMPLATES_DIR = path.join(__dirname, 'templates');
const MAX_CONCURRENT_WRITES = 500; // Limit concurrent file writes
const SEARCH_INDEX_PREFIX_LENGTH = 3;

// Track total number of generated files
let totalFilesGenerated = 0;

// Create a simple queue system for file writes
class WriteQueue {
  constructor(maxConcurrent) {
    this.maxConcurrent = maxConcurrent;
    this.queue = [];
    this.active = 0;
  }

  async enqueue(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.process();
    });
  }

  process() {
    if (this.active >= this.maxConcurrent || this.queue.length === 0) return;
    
    this.active++;
    const { task, resolve, reject } = this.queue.shift();
    
    task()
      .then(resolve)
      .catch(reject)
      .finally(() => {
        this.active--;
        this.process();
      });
  }
}

const writeQueue = new WriteQueue(MAX_CONCURRENT_WRITES);

// Utility function to write JSON files with consistent formatting
async function writeJsonFile(filePath, data) {
  await writeQueue.enqueue(() => 
    fs.writeFile(filePath, JSON.stringify(data, null, 2))
  );
}

// Enhanced fetch with timeout and retry
async function fetchData(url, retries = 3, timeout = 5000) {
  return new Promise((resolve, reject) => {
    let attempt = 0;
    
    const tryFetch = () => {
      attempt++;
      const timer = setTimeout(() => {
        req.abort();
        if (attempt < retries) {
          setTimeout(tryFetch, 1000 * attempt);
        } else {
          reject(new Error(`Request timeout after ${timeout}ms`));
        }
      }, timeout);

      const req = https.get(url, (res) => {
        clearTimeout(timer);
        
        if (res.statusCode === 200) {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(e);
            }
          });
        } else if (attempt < retries) {
          setTimeout(tryFetch, 1000 * attempt);
        } else {
          reject(new Error(`Failed to fetch data. Status code: ${res.statusCode}`));
        }
      }).on('error', (err) => {
        clearTimeout(timer);
        if (attempt < retries) {
          setTimeout(tryFetch, 1000 * attempt);
        } else {
          reject(err);
        }
      });
    };

    tryFetch();
  });
}

// Optimized paginateItems with pre-allocation
function paginateItems(items, pageSize) {
  const pageCount = Math.ceil(items.length / pageSize);
  const pages = new Array(pageCount);
  
  for (let i = 0; i < pageCount; i++) {
    pages[i] = items.slice(i * pageSize, (i + 1) * pageSize);
  }
  
  return pages;
}

// Batch processing for large datasets
async function processInBatches(items, batchSize, processFn) {
  const batches = Math.ceil(items.length / batchSize);
  for (let i = 0; i < batches; i++) {
    const batch = items.slice(i * batchSize, (i + 1) * batchSize);
    await Promise.all(batch.map(processFn));
  }
}

// Generate paginated files with batch processing
async function generatePaginatedFiles({ items, pageSize, basePath, itemMapper, pageMapper, fileNameGenerator = (item) => `${item.id}.json` }) {
  const baseDir = path.join(OUTPUT_DIR, basePath);
  await fs.mkdir(baseDir, { recursive: true });

  // Process items in batches to avoid memory overload
  await processInBatches(items, 100, async (item, index) => {
    const filePath = path.join(baseDir, fileNameGenerator(item));
    await writeJsonFile(filePath, itemMapper(item));

    totalFilesGenerated++;
    if (index < 3) {
      console.log(`Generated item file: ${filePath}`);
    }
  });

  // Paginate items and generate index files
  const paginatedItems = paginateItems(items, pageSize);
  await generatePaginatedIndex(paginatedItems, baseDir, pageMapper);
}

// Optimized search index generation
async function generateSearchIndex(data, OUTPUT_DIR, basePath) {
  // Use a Map for better performance with large datasets
  const prefixIndexes = new Map();

  // Process documents in batches
  for (let i = 0; i < data.length; i += 1000) {
    const batch = data.slice(i, i + 1000);
    
    for (const doc of batch) {
      const id = doc.id;
      const tokens = new Set([
        ...tokenize(doc.title || ''),
        ...tokenize(doc.description || '')
      ]);

      for (const word of tokens) {
        const prefix = word.slice(0, SEARCH_INDEX_PREFIX_LENGTH);
        
        if (!prefixIndexes.has(prefix)) {
          prefixIndexes.set(prefix, new Map());
        }
        
        const prefixMap = prefixIndexes.get(prefix);
        if (!prefixMap.has(word)) {
          prefixMap.set(word, new Set());
        }
        
        prefixMap.get(word).add(id);
      }
    }
  }

  // Create search index directory
  const searchIndexDir = path.join(OUTPUT_DIR, basePath, 'search-index');
  await fs.mkdir(searchIndexDir, { recursive: true });

  // Convert Maps to objects for JSON serialization and write files
  const writePromises = [];
  for (const [prefix, wordMap] of prefixIndexes) {
    const indexObj = {};
    for (const [word, idSet] of wordMap) {
      indexObj[word] = Array.from(idSet);
    }
    
    const filePath = path.join(searchIndexDir, `${prefix}.json`);
    writePromises.push(
      writeJsonFile(filePath, indexObj)
        .then(() => console.log(`Generated search index file: ${filePath}`))
    );
  }

  await Promise.all(writePromises);
}

// Main function with error handling and cleanup
async function main() {
  try {
    console.time('File generation time');
    const templates = await fs.readdir(TEMPLATES_DIR);

    // Process templates sequentially to avoid memory spikes
    for (const templateFile of templates) {
      const templatePath = path.join(TEMPLATES_DIR, templateFile);
      console.log(`Processing template: ${templatePath}`);
      
      const template = require(templatePath);
      const data = await fetchData(template.dataUrl);

      if (!Array.isArray(data)) {
        console.warn(`Skipping template ${templateFile}: data is not an array`);
        continue;
      }

      if (data.length === 0) {
        console.warn(`Warning: No data found for ${template.basePath}. Skipping.`);
        continue;
      }

      // Process main items
      await generatePaginatedFiles({
        items: data,
        pageSize: POSTS_PER_PAGE,
        basePath: template.basePath,
        itemMapper: template.itemMapper,
        pageMapper: template.pageMapper,
      });

      // Process related entities if they exist
      if (template.generateRelatedEntities) {
        await template.generateRelatedEntities(data, generatePaginatedFiles, POSTS_PER_PAGE);
      }

      // Generate search index if configured
      if (template.generateSearchIndex) {
        await generateSearchIndex(data, OUTPUT_DIR, template.basePath);
      }
    }

    console.timeEnd('File generation time');
    console.log(`Generated ${totalFilesGenerated} files in total.`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);
