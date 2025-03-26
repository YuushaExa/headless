// put in template

  // Add search index generation logic
generateSearchIndex: async function (data, OUTPUT_DIR, counter) {
  const fs = require('fs').promises;
  const path = require('path');

  function tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((word) => word.length > 2);
  }

  const prefixIndexes = {};

  data.forEach((doc) => {
    const id = doc.id;
    const tokens = [...tokenize(doc.title || ''), ...tokenize(doc.description || '')];

    if (!Array.isArray(tokens)) {
      throw new Error(`Invalid tokens generated for document ID: ${id}`);
    }

    tokens.forEach((word) => {
      const prefix = word.slice(0, 3);
      if (!prefixIndexes[prefix]) {
        prefixIndexes[prefix] = {};
      }
      if (!prefixIndexes[prefix][word] || !(prefixIndexes[prefix][word] instanceof Set)) {
        prefixIndexes[prefix][word] = new Set();
      }
      prefixIndexes[prefix][word].add(id);
    });
  });

  for (const prefix in prefixIndexes) {
    for (const word in prefixIndexes[prefix]) {
      prefixIndexes[prefix][word] = Array.from(prefixIndexes[prefix][word]);
    }
  }

  const searchIndexDir = path.join(OUTPUT_DIR, this.basePath, 'search-index');
  await fs.mkdir(searchIndexDir, { recursive: true });

  const prefixes = Object.keys(prefixIndexes).sort();
  const prefixCount = prefixes.length;

  await Promise.all(
    prefixes.map(async (prefix, index) => {
      const filePath = path.join(searchIndexDir, `${prefix}.json`);
      await fs.writeFile(filePath, JSON.stringify(prefixIndexes[prefix], null, 2));
      
      counter.value++;
      if (index < 3) {
        console.log(`Generated search index file: ${filePath}`);
      }
    })
  );
  
  console.log(`Search index generated successfully for ${this.basePath}.`);
  console.log(`Generated ${prefixCount} search index files in total.`);
},

// put in main 


      // Generate search index for this template
      if (template.generateSearchIndex) {
        await template.generateSearchIndex(data, OUTPUT_DIR);
      }
