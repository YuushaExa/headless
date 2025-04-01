// --- Dependencies at the top ---
const path = require('path'); // Path is needed for search index dir calculation

// --- Helper Functions ---
function slugify(text) {
  if (!text) return '';

  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')            // Replace spaces with -
    .replace(/-+/g, '-')             // Replace multiple - with single -
    .replace(/^-+/, '')              // Trim - from start
    .replace(/-+$/, '')             // Trim - from end
    .replace(/[^\w-]+/g, '')         // Remove all non-word chars except hyphen (enhancement)
    .replace(/\//g, '-');           // Replace slashes AFTER removing other chars
}

function extractDevelopers(posts) {
    const developersMap = new Map();

    posts.forEach(post => {
      post.developers?.forEach(dev => {
        if (dev && dev.id && dev.name) { // Add basic validation for dev object
            const devId = dev.id;
            if (!developersMap.has(devId)) {
            developersMap.set(devId, {
                id: devId,
                title: dev.name,
                posts: [],
            });
            }
            developersMap.get(devId).posts.push({
            id: post.id,
            title: post.title,
            image: post.image || null,
            link: `vn/posts/${slugify(post.title)}.json`, // Ensure consistency
            });
        } else {
            // Optional: Log a warning if developer data is malformed
            // console.warn(`Skipping malformed developer entry in post ID ${post.id}`);
        }
      });
    });

    return Array.from(developersMap.values());
}


// --- Module Exports ---
module.exports = {
  slugify: slugify, // Export slugify if needed elsewhere, or keep internal
  basePath: 'vn/posts',
  dataUrl: 'https://raw.githubusercontent.com/YuushaExa/merge/main/vnr/merged.json',

  itemMapper: (post) => ({
    id: post.id,
    title: post.title,
    developers: post.developers?.map(dev => ({
      title: dev.name,
      id: dev.id,
      // Use the same slugify function consistently
      link: `vn/developers/${slugify(dev.name)}.json`,
    })).filter(Boolean), // Filter out potential nulls if dev name/id was missing
    aliases: post.aliases || [],
    description: post.description || null,
    image: post.image || null,
    // Use the same slugify function consistently
    link: `vn/posts/${slugify(post.title)}.json`,
  }),

  pageMapper: (pagePosts, currentPage, totalPages) => ({
    posts: pagePosts.map(post => ({
      id: post.id,
      title: post.title,
      image: post.image || null,
      // Use the same slugify function consistently
      link: `vn/posts/${slugify(post.title)}.json`,
    })),
    pagination: {
      currentPage,
      totalPages,
      nextPage: currentPage < totalPages ? `vn/posts/page/${currentPage + 1}.json` : null,
      previousPage: currentPage > 1 ? (currentPage === 2 ? 'vn/posts/index.json' : `vn/posts/page/${currentPage - 1}.json`) : null,
    },
  }),

  // Uses this.slugify internally via itemMapper/pageMapper/fileNameGenerator
  generateItems: async function (data, generatePaginatedFiles, POSTS_PER_PAGE) {
    console.log(`Generating main items for ${this.basePath}...`);
    await generatePaginatedFiles({
      items: data,
      pageSize: POSTS_PER_PAGE,
      basePath: this.basePath,
      itemMapper: this.itemMapper,
      pageMapper: this.pageMapper,
      // Pass the slugify function reference directly if 'this' causes issues,
      // but 'this.slugify' should work fine here.
      fileNameGenerator: (item) => `${slugify(item.title)}.json`,
      typeName: 'post'
    });
  },

  generateRelatedEntities: async function (data, generatePaginatedFiles, POSTS_PER_PAGE) {
    // Extract developers using the helper
    const developers = extractDevelopers(data); // Use helper function

    if (developers.length === 0) {
        console.log("No developers found to generate related entities.");
        return;
    }

    console.log(`Generating ${developers.length} developer pages...`);

    // Generate paginated files for developers
    await generatePaginatedFiles({
      items: developers,
      pageSize: POSTS_PER_PAGE,
      basePath: 'vn/developers', // Define base path for developers
      itemMapper: (dev) => ({ // Mapper for individual developer JSON
        id: dev.id,
        title: dev.title,
        posts: dev.posts, // Include the list of associated posts
        link: `vn/developers/${slugify(dev.title)}.json`, // Consistent link
      }),
      pageMapper: (pageEntities, currentPage, totalPages) => ({ // Mapper for developer list pages
        developers: pageEntities.map(dev => ({
          id: dev.id,
          title: dev.title,
          link: `vn/developers/${slugify(dev.title)}.json`, // Consistent link
        })),
        pagination: { // Consistent pagination structure
          currentPage,
          totalPages,
          nextPage: currentPage < totalPages ? `vn/developers/page/${currentPage + 1}.json` : null,
          previousPage: currentPage > 1 ? (currentPage === 2 ? 'vn/developers/index.json' : `vn/developers/page/${currentPage - 1}.json`) : null,
        },
      }),
      fileNameGenerator: (dev) => `${slugify(dev.title)}.json`, // Consistent filename
      typeName: 'developers'
    });
  },

  // Updated signature to accept stats and writeJsonFile
  generateSearchIndex: async function (data, OUTPUT_DIR, stats, writeJsonFile) {

    // --- Tokenization (Internal Helper) ---
    function tokenize(text) {
      if (!text || typeof text !== 'string') return []; // Add type check
      return text
        .toLowerCase()
        // More restrictive regex: only allow letters, numbers, and whitespace
        // Adjust if other characters are important (e.g., C++, C#)
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        // Filter empty strings resulting from split and short words
        .filter((word) => word && word.length > 1);
    }
    // --- End Tokenization ---

    console.log(`Generating search index for ${this.basePath}...`);
    const prefixIndexes = {};

    data.forEach((doc) => {
      // Basic validation for document structure
      if (!doc || typeof doc.id === 'undefined' || doc.id === null) {
          console.warn("Skipping document with missing ID during search index generation.");
          return;
      }
      const id = doc.id;
      // Combine tokens from relevant fields
      const tokens = [
        ...tokenize(doc.title),
        ...tokenize(doc.description)
        // Add other fields to index here if needed (e.g., tokenize(doc.aliases?.join(' ')))
      ];

      // This check might be redundant now due to tokenize validation, but safe to keep
      if (!Array.isArray(tokens)) {
          console.error(`Invalid tokens generated for document ID: ${id}`);
          return; // Skip this doc if tokenization failed unexpectedly
      }

      // Use a Set for efficient addition of tokens during processing
      const uniqueTokens = new Set(tokens);

      uniqueTokens.forEach((word) => {
        // Ensure word is valid (it should be after tokenize, but belts and suspenders)
        if (!word) return;

        const prefix = word.slice(0, 2); // Use 2-char prefix
        if (prefix.length < 2) return; // Skip if word is too short for prefix

        if (!prefixIndexes[prefix]) {
          prefixIndexes[prefix] = {};
        }
        if (!prefixIndexes[prefix][word]) {
          // Store document IDs in a Set initially for auto-deduplication per word/prefix
          prefixIndexes[prefix][word] = new Set();
        }
        prefixIndexes[prefix][word].add(id);
      });
    });

    // Convert Sets to Arrays for JSON output AFTER processing all docs
    for (const prefix in prefixIndexes) {
      for (const word in prefixIndexes[prefix]) {
        prefixIndexes[prefix][word] = Array.from(prefixIndexes[prefix][word]);
      }
    }

    const searchIndexDir = path.join(OUTPUT_DIR, this.basePath, 'search-index');
    await fs.promises.mkdir(searchIndexDir, { recursive: true }); // Use fs directly as it's simple here

    const prefixes = Object.keys(prefixIndexes).sort();
    const prefixCount = prefixes.length;
    let generatedCount = 0;

    await Promise.all(
      prefixes.map(async (prefix) => {
        const filePath = path.join(searchIndexDir, `${prefix}.json`);
        try {
            // Use the passed writeJsonFile utility
            await writeJsonFile(filePath, prefixIndexes[prefix]);
            stats.incrementGeneratedFiles(); // Use stats object
            generatedCount++;
            // Log progress periodically or just the first few
            if (generatedCount <= 3 || generatedCount % 100 === 0) {
                 console.log(` -> Generated search index file: ${path.relative(OUTPUT_DIR, filePath)}`);
            }
        } catch (error) {
            console.error(`Failed to write search index file ${filePath}: ${error.message}`);
            // Decide if you want to stop the build or just log and continue
        }
      })
    );

    console.log(`Search index generation complete for ${this.basePath}.`);
    console.log(`Generated ${generatedCount} search index files (from ${prefixCount} prefixes).`);
  },
};
