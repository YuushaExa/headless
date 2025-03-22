// put in template

  // Add search index generation logic
generateSearchIndex: async function (data, OUTPUT_DIR) {
  const fs = require('fs').promises;
  const path = require('path');

  // Helper function to tokenize text
  function tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove punctuation
      .split(/\s+/) // Split by whitespace
      .filter((word) => word.length > 2); // Ignore short words
  }

  // Initialize inverted indexes for each two-letter prefix
  const prefixIndexes = {};

  // Process each document
  data.forEach((doc) => {
    const id = doc.id;

    // Tokenize title and description
    const tokens = [...tokenize(doc.title || ''), ...tokenize(doc.description || '')];

    // Ensure tokens is defined before using it
    if (!Array.isArray(tokens)) {
      throw new Error(`Invalid tokens generated for document ID: ${id}`);
    }

    tokens.forEach((word) => {
      const prefix = word.slice(0, 2); // Extract the first two letters, change to 3 for smaller file size 
      if (!prefixIndexes[prefix]) {
        prefixIndexes[prefix] = {}; // Initialize the prefix object
      }
      if (!prefixIndexes[prefix][word] || !(prefixIndexes[prefix][word] instanceof Set)) {
        prefixIndexes[prefix][word] = new Set(); // Ensure it's a Set
      }
      prefixIndexes[prefix][word].add(id); // Add the document ID to the Set
    });
  });

  // Convert Sets to Arrays for JSON serialization
  for (const prefix in prefixIndexes) {
    for (const word in prefixIndexes[prefix]) {
      prefixIndexes[prefix][word] = Array.from(prefixIndexes[prefix][word]);
    }
  }

  // Create a directory for the search index
  const searchIndexDir = path.join(OUTPUT_DIR, this.basePath, 'search-index');
  await fs.mkdir(searchIndexDir, { recursive: true });

  // Save each prefix index as a separate file
  await Promise.all(
    Object.keys(prefixIndexes).map(async (prefix) => {
      const filePath = path.join(searchIndexDir, `${prefix}.json`);
      await fs.writeFile(filePath, JSON.stringify(prefixIndexes[prefix], null, 2));
      console.log(`Generated search index file: ${filePath}`);
    })
  );
  
  console.log(`Search index generated successfully for ${this.basePath}.`);
},

// put in main 


      // Generate search index for this template
      if (template.generateSearchIndex) {
        await template.generateSearchIndex(data, OUTPUT_DIR);
      }
