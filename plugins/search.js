// plugins/search.js
const fs = require('fs').promises;
const path = require('path');


const DEFAULT_SETTINGS = {
    fieldsToIndex: ['title', 'description'],
    idField: 'description',
    minWordLength: 2,
    prefixLength: 2,
    outputSubDir: 'search-index'
};


async function writeJsonFile(filePath, data) {
 await fs.writeFile(filePath, JSON.stringify(data));
}


function tokenize(text, minWordLength) {
    if (typeof text !== 'string' || !text) return [];

    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(word => word && word.length >= minWordLength);
}

async function generateSearchIndex({ data, outputDir, basePath, config, fileCounter }) {
    console.log(`[Search Plugin] Starting index generation for ${basePath}`);


    const settings = { ...DEFAULT_SETTINGS, ...config };
    
    // Validate settings
    if (!Array.isArray(settings.fieldsToIndex) || settings.fieldsToIndex.length === 0) {
        console.warn(`[Search Plugin] Skipping - invalid fieldsToIndex`);
        return;
    }
    if (typeof settings.idField !== 'string' || !settings.idField) {
        console.warn(`[Search Plugin] Skipping - invalid idField`);
        return;
    }
    if (typeof settings.minWordLength !== 'number' || settings.minWordLength < 1) {
        settings.minWordLength = DEFAULT_SETTINGS.minWordLength;

    }
    if (typeof settings.prefixLength !== 'number' || settings.prefixLength < 1) {
        settings.prefixLength = DEFAULT_SETTINGS.prefixLength;

    }

    // Initialize index structure with proper Set objects
    const prefixIndexes = new Map();


    data.forEach((doc, docIndex) => {
        const docId = doc[settings.idField];
        if (docId === undefined || docId === null) {
            console.warn(`Document ${docIndex} missing ID - skipping`);
            return;
        }

        // Collect and tokenize all fields
        const tokens = settings.fieldsToIndex.flatMap(field => 
            tokenize(doc[field], settings.minWordLength)
        );







        // Process unique tokens only
        new Set(tokens).forEach(word => {
            if (word.length < settings.prefixLength) return;

            const prefix = word.substring(0, settings.prefixLength);
            
            // Initialize prefix if not exists
            if (!prefixIndexes.has(prefix)) {
                prefixIndexes.set(prefix, new Map());
            }

            const prefixMap = prefixIndexes.get(prefix);
            
            // Initialize word Set if not exists
            if (!prefixMap.has(word)) {
                prefixMap.set(word, new Set());
            }

            // Add document ID to the Set
            prefixMap.get(word).add(docId);
        });
    });

    // Convert to serializable format
  const serializableIndex = {};
    prefixIndexes.forEach((wordMap, prefix) => {
        serializableIndex[prefix] = {};
        wordMap.forEach((idSet, word) => {
            serializableIndex[prefix][word] = Array.from(idSet).sort();
        });
    });

    // Write to files
    const searchIndexDir = path.join(outputDir, basePath, settings.outputSubDir);
    await fs.mkdir(searchIndexDir, { recursive: true });

    const prefixes = Object.keys(serializableIndex).sort();
    const generatedFiles = [];

    await Promise.all(prefixes.map(async prefix => {
        const filePath = path.join(searchIndexDir, `${prefix}.json`);
        // Write just the word map instead of the wrapped object
        await writeJsonFile(filePath, serializableIndex[prefix]);
        generatedFiles.push(filePath);
        fileCounter.increment();
    }));

    console.log(`[Search Plugin] Generated ${prefixes.length} index files for ${basePath}`);
    if (prefixes.length > 0) {
        console.log(` -> Example: ${generatedFiles.slice(0, 3).map(f => path.relative(outputDir, f)).join(', ')}`);
    }

}

module.exports = {
    generateSearchIndex
};
