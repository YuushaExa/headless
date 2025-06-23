// plugins/search.js
const fs = require('fs').promises;
const path = require('path');

// Default settings for the search plugin
const DEFAULT_SETTINGS = {
    fieldsToIndex: ['title', 'description'], // Fields to extract tokens from
    idField: 'id',                           // Field containing the unique document ID
    minWordLength: 2,                        // Minimum length of a word to be indexed
    prefixLength: 2,                         // Length of the prefix for sharding index files
    outputSubDir: 'search-index'             // Subdirectory within the basePath for index files
};

// Utility function to write JSON files
async function writeJsonFile(filePath, data) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// Tokenizer function
function tokenize(text, minWordLength) {
    if (typeof text !== 'string' || !text) {
        return [];
    }
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((word) => word && word.length >= minWordLength);
}

async function generateSearchIndex({ data, outputDir, basePath, config, fileCounter }) {
    console.log(`[Search Plugin] Starting index generation for basePath: ${basePath}`);

    // Merge default settings with provided config
    const settings = { ...DEFAULT_SETTINGS, ...config };


    if (!Array.isArray(settings.fieldsToIndex) || settings.fieldsToIndex.length === 0) {
        console.warn(`[Search Plugin] Skipping index generation for ${basePath}: 'fieldsToIndex' is missing or empty in config.`);
        return;
    }
    if (typeof settings.idField !== 'string' || !settings.idField) {
         console.warn(`[Search Plugin] Skipping index generation for ${basePath}: 'idField' is missing or invalid in config.`);
        return;
    }
     if (typeof settings.minWordLength !== 'number' || settings.minWordLength < 1) {
         console.warn(`[Search Plugin] Invalid 'minWordLength' (${settings.minWordLength}) in config for ${basePath}. Using default: ${DEFAULT_SETTINGS.minWordLength}`);
         settings.minWordLength = DEFAULT_SETTINGS.minWordLength;
    }
    if (typeof settings.prefixLength !== 'number' || settings.prefixLength < 1) {
         console.warn(`[Search Plugin] Invalid 'prefixLength' (${settings.prefixLength}) in config for ${basePath}. Using default: ${DEFAULT_SETTINGS.prefixLength}`);
         settings.prefixLength = DEFAULT_SETTINGS.prefixLength;
    }

    console.log(`[Search Plugin] Using settings:`, settings);

    const prefixIndexes = {}; // { prefix: { word: Set<id> } }

    data.forEach((doc, docIndex) => {
        const docId = doc[settings.idField];
        if (docId === undefined || docId === null) {
            console.warn(`[Search Plugin] Document at index ${docIndex} missing ID field '${settings.idField}'. Skipping.`);
            return;
        }

        let tokens = [];
        settings.fieldsToIndex.forEach(field => {
            tokens = tokens.concat(tokenize(doc[field], settings.minWordLength));
        });

        // Deduplicate tokens for this document before processing
        const uniqueTokens = [...new Set(tokens)];

        uniqueTokens.forEach((word) => {
            if (word.length < settings.prefixLength) return; // Skip words shorter than prefix length

            const prefix = word.slice(0, settings.prefixLength);



            // Initialize prefix if it doesn't exist
            if (!prefixIndexes[prefix]) {
                prefixIndexes[prefix] = {};


            }

            // Initialize word Set if it doesn't exist
            if (!prefixIndexes[prefix][word]) {
                prefixIndexes[prefix][word] = new Set();


            }

            // Add the document ID to the Set
            prefixIndexes[prefix][word].add(docId);
        });
    });

    // Convert Sets to Arrays for JSON serialization
    for (const prefix in prefixIndexes) {
        for (const word in prefixIndexes[prefix]) {
            prefixIndexes[prefix][word] = Array.from(prefixIndexes[prefix][word]).sort();
        }
    }




    const searchIndexDir = path.join(outputDir, basePath, settings.outputSubDir);
    await fs.mkdir(searchIndexDir, { recursive: true });

    const prefixes = Object.keys(prefixIndexes).sort();
    const generatedFiles = [];

    await Promise.all(
        prefixes.map(async (prefix) => {
            const filePath = path.join(searchIndexDir, `${prefix}.json`);
            await writeJsonFile(filePath, prefixIndexes[prefix]);
            generatedFiles.push(filePath);
            fileCounter.increment();
        })
    );

    console.log(`[Search Plugin] Generated ${prefixes.length} search index files for ${basePath} in ${searchIndexDir}.`);
    if (prefixes.length > 0) {
         console.log(` -> Example: ${generatedFiles.slice(0, Math.min(3, generatedFiles.length)).map(f => path.relative(outputDir, f)).join(', ')}`);Add commentMore actions
    }
    console.log('');
}

module.exports = {
    generateSearchIndex,
};
