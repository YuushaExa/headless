// ssg.js

const fs = require('fs').promises;
const path = require('path');
const https = require('https');

// Constants
const OUTPUT_DIR = './public';
const POSTS_PER_PAGE = 10;
const TEMPLATES_DIR = path.join(__dirname, 'templates');
const PLUGINS_DIR = path.join(__dirname, 'plugins');

// Track total number of generated files
// let totalFilesGenerated = 0; // Keep this line if you were using it elsewhere, otherwise remove. The counter object is preferred.
const fileCounter = { // Use an object to pass by reference
    value: 0,
    increment() { this.value++; }
};

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

async function generatePaginatedFiles({ items, pageSize, basePath, itemMapper, pageMapper, fileNameGenerator, typeName = 'items', templateContext = null }) { // Added templateContext
    if (!fileNameGenerator) {
        throw new Error(`fileNameGenerator is required for generatePaginatedFiles (called for ${typeName})`);
    }
    const baseDir = path.join(OUTPUT_DIR, basePath);
    await fs.mkdir(baseDir, { recursive: true });

    const generatedFiles = []; // Keep track of files generated in this call

    // Ensure fileNameGenerator has the correct 'this' context if needed (like for slugify)
    const boundFileNameGenerator = typeof fileNameGenerator === 'function'
        ? fileNameGenerator.bind(templateContext) // Bind to template module context
        : (item) => { throw new Error('fileNameGenerator is not a function'); }; // Handle error case

    // Generate individual item files
    await Promise.all(
        items.map(async (item) => {
            // Pass the item AND the template context to fileNameGenerator if needed,
            // but binding 'this' is generally cleaner if the function expects it.
            const filePath = path.join(baseDir, boundFileNameGenerator(item));
            await writeJsonFile(filePath, itemMapper(item)); // itemMapper should ideally not rely on 'this' or should also be bound if needed
            generatedFiles.push(filePath);
            fileCounter.increment(); // Use counter object
        })
    );

    // Log snippet of item files generated
    console.log(` Generated ${items.length} ${typeName} files in ${baseDir}.`);
    if (items.length > 0) {
        console.log(`  -> Example: ${generatedFiles.slice(0, Math.min(3, generatedFiles.length)).map(f => path.relative(OUTPUT_DIR, f)).join(', ')}`);
    }

    // Paginate items and generate index files
    const paginatedItems = paginateItems(items, pageSize);
    await generatePaginatedIndex(paginatedItems, baseDir, pageMapper, typeName);
}

// Modify the generatePaginatedIndex function (No changes needed here for this request)
async function generatePaginatedIndex(paginatedItems, baseDir, pageMapper, typeName = 'items') {
    if (paginatedItems.length === 0) {
        console.log(` No ${typeName} pagination files to generate.`);
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

            // pageMapper should ideally not rely on 'this' or should also be bound if needed
            await writeJsonFile(filePath, pageMapper(page, pageNumber, paginatedItems.length));
            generatedFiles.push(filePath);
            fileCounter.increment(); // Use counter object
        })
    );

    // Log snippet of pagination files generated
    console.log(` Generated ${paginatedItems.length} ${typeName} pagination files.`);
    if (paginatedItems.length > 0) {
        console.log(`  -> Example: ${generatedFiles.slice(0, Math.min(3, generatedFiles.length)).map(f => path.relative(OUTPUT_DIR, f)).join(', ')}`);
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
            if (!templateFile.endsWith('.js')) continue;

            const templatePath = path.join(TEMPLATES_DIR, templateFile);
            console.log(`\n--- Processing Template: ${templateFile} ---`);
            // Clear require cache for the template in case it was modified
            delete require.cache[require.resolve(templatePath)];
            const template = require(templatePath);

            // --- Data Fetching ---
            if (!template.dataUrl) {
                console.warn(`Warning: Template ${templateFile} missing dataUrl. Skipping data fetch and generation.`);
                continue; // Skip if no data source
            }
            console.log(`Fetching data from: ${template.dataUrl}`);
            let data;
            try {
                 data = await fetchData(template.dataUrl);
            } catch (fetchError) {
                console.error(`\n--- ERROR fetching data for template "${templateFile}" ---`);
                console.error(`URL: ${template.dataUrl}`);
                console.error(fetchError.message);
                continue; // Skip this template on fetch error
            }

            if (!Array.isArray(data)) {
                 console.error(`Error: Fetched data for ${template.basePath || templateFile} is not an array. Skipping generation.`);
                 continue;
            }
            if (data.length === 0) {
                console.warn(`Warning: No data found for ${template.basePath || templateFile}. Skipping generation.`);
                continue;
            }
            console.log(`Fetched ${data.length} items.`);

            // --- Generate main items using direct configuration ---
            // Check for required configuration properties
            const requiredProps = ['basePath', 'itemMapper', 'pageMapper', 'fileNameGenerator'];
            const missingProps = requiredProps.filter(prop => !template[prop]);

            if (missingProps.length > 0) {
                console.warn(`Warning: Template ${templateFile} is missing required properties for item generation: ${missingProps.join(', ')}. Skipping main item generation.`);
            } else {
                 console.log(`Generating main items for ${template.basePath}...`);
                 // Ensure mappers and fileNameGenerator are functions
                 if (typeof template.itemMapper !== 'function' || typeof template.pageMapper !== 'function' || typeof template.fileNameGenerator !== 'function') {
                     console.error(`Error: itemMapper, pageMapper, or fileNameGenerator is not a function in ${templateFile}. Skipping main item generation.`);
                 } else {
                    try {
                        await generatePaginatedFiles({
                            items: data,
                            pageSize: template.pageSize || POSTS_PER_PAGE, // Allow override in template
                            basePath: template.basePath,
                            itemMapper: template.itemMapper, // Pass directly
                            pageMapper: template.pageMapper,   // Pass directly
                            fileNameGenerator: template.fileNameGenerator, // Pass directly
                            typeName: template.typeName || template.basePath?.split('/').pop() || 'item', // Use explicit typeName or try to infer
                            templateContext: template // Pass the template object itself as context for binding 'this'
                        });
                    } catch (genError) {
                         console.error(`\n--- ERROR generating items for template "${templateFile}" ---`);
                         console.error(genError.message);
                         console.error(genError.stack);
                         // Decide if you want to stop process.exit(1);
                    }
                 }
            }
            // --- End Main Item Generation ---

            // Generate related entities (keep this structure if needed)
            if (template.generateRelatedEntities) {
                 console.log(`Generating related entities for ${template.basePath}...`);
                 try {
                    await template.generateRelatedEntities(data, generatePaginatedFiles, POSTS_PER_PAGE);
                 } catch (relatedError) {
                     console.error(`\n--- ERROR generating related entities for template "${templateFile}" ---`);
                     console.error(relatedError.message);
                     console.error(relatedError.stack);
                     // Decide if you want to stop process.exit(1);
                 }
            }

            // --- Execute configured plugins (No changes needed here for this request) ---
            if (template.plugins) {
                for (const pluginName in template.plugins) {
                    const pluginConfig = template.plugins[pluginName];
                    if (pluginConfig && pluginConfig.enabled) {
                        try {
                            const pluginPath = path.join(PLUGINS_DIR, `${pluginName}.js`);
                            try {
                                await fs.access(pluginPath);
                            } catch (e) {
                                console.warn(`Warning: Plugin file not found for enabled plugin "${pluginName}": ${pluginPath}`);
                                continue;
                            }

                            // REMOVED: delete require.cache[require.resolve(pluginPath)]; // Consider if still needed
                            const plugin = require(pluginPath);

                            const pluginFunctionName = `generate${pluginName.charAt(0).toUpperCase() + pluginName.slice(1)}Index`;

                            if (plugin[pluginFunctionName] && typeof plugin[pluginFunctionName] === 'function') {
                                console.log(`\nExecuting plugin: ${pluginName} for ${template.basePath}`);
                                await plugin[pluginFunctionName]({
                                    data: data,
                                    outputDir: OUTPUT_DIR,
                                    basePath: template.basePath,
                                    config: pluginConfig.settings || {},
                                    fileCounter: fileCounter
                                });
                            } else {
                                console.warn(`Warning: Plugin "${pluginName}" is enabled but does not export a function named "${pluginFunctionName}".`);
                            }
                        } catch (pluginError) {
                            console.error(`\n--- ERROR executing plugin "${pluginName}" for template "${templateFile}" ---`);
                            console.error(pluginError.message);
                            console.error(pluginError.stack);
                            // process.exit(1); // Optional: stop on plugin error
                        }
                    }
                }
            }
            // --- End Plugin Execution ---

            console.log(`--- Finished Template: ${templateFile} ---`);
        }

        console.timeEnd('File generation time');
        console.log(`\nGenerated ${fileCounter.value} files in total.`);
    } catch (error) {
        console.error('\n--- FATAL ERROR ---');
        console.error(error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the script
main();
