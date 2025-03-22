module.exports = {
  basePath: 'vn/posts',
  dataUrl: 'https://raw.githubusercontent.com/YuushaExa/testapi/main/merged.json',

  itemMapper: (post) => ({
    id: post.id,
    title: post.title,
    developers: post.developers?.map(dev => ({
      name: dev.name,
      id: dev.id,
      link: `vn/developers/${dev.id}.json`,
    })),
    aliases: post.aliases || [],
    description: post.description || null,
    image: post.image || null,
    link: `vn/posts/${post.id}.json`,
  }),

  pageMapper: (pagePosts, currentPage, totalPages) => ({
    posts: pagePosts.map(post => ({
      id: post.id,
      title: post.title,
      image: post.image || null,
      link: `vn/posts/${post.id}.json`,
    })),
    pagination: {
      currentPage,
      totalPages,
      nextPage: currentPage < totalPages ? `vn/posts/page/${currentPage + 1}.json` : null,
      previousPage: currentPage > 1 ? (currentPage === 2 ? 'vn/posts/index.json' : `vn/posts/page/${currentPage - 1}.json`) : null,
    },
  }),

  extractDevelopers: (posts) => {
    const developersMap = new Map();

    posts.forEach(post => {
      post.developers?.forEach(dev => {
        if (!developersMap.has(dev.id)) {
          developersMap.set(dev.id, {
            id: dev.id,
            name: dev.name,
            posts: [],
          });
        }
        developersMap.get(dev.id).posts.push({
          id: post.id,
          title: post.title,
          image: post.image || null,
          link: `vn/posts/${post.id}.json`,
        });
      });
    });

    return Array.from(developersMap.values());
  },

  generateRelatedEntities: async function (data, generatePaginatedFiles, POSTS_PER_PAGE) {
    // Extract developers
    const developers = this.extractDevelopers(data);

    // Generate paginated files for developers
    await generatePaginatedFiles({
      items: developers,
      pageSize: POSTS_PER_PAGE,
      basePath: 'vn/developers', // Developers go under `public/vn/developers/`
      itemMapper: (dev) => ({
        id: dev.id,
        name: dev.name,
        posts: dev.posts,
        link: `vn/developers/${dev.id}.json`,
      }),
      pageMapper: (pageEntities, currentPage, totalPages) => ({
        developers: pageEntities.map(dev => ({
          id: dev.id,
          name: dev.name,
          link: `vn/developers/${dev.id}.json`,
        })),
        pagination: {
          currentPage,
          totalPages,
          nextPage: currentPage < totalPages ? `vn/developers/page/${currentPage + 1}.json` : null,
          previousPage: currentPage > 1 ? (currentPage === 2 ? 'vn/developers/index.json' : `vn/developers/page/${currentPage - 1}.json`) : null,
        },
      }),
    });
  },

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

  // Initialize inverted index for each letter
  const letterIndex = {};
  'abcdefghijklmnopqrstuvwxyz'.split('').forEach((letter) => {
    letterIndex[letter] = {}; // Each letter maps to an object of words
  });

  // Process each document
  data.forEach((doc) => {
    const id = doc.id;

    // Tokenize title and description
    const tokens = [...tokenize(doc.title || ''), ...tokenize(doc.description || '')];

    tokens.forEach((word) => {
      const firstLetter = word.charAt(0); // Get the first letter of the word
      if (letterIndex[firstLetter]) {
        if (!letterIndex[firstLetter][word]) {
          letterIndex[firstLetter][word] = new Set(); // Use a Set to avoid duplicates
        }
        letterIndex[firstLetter][word].add(id); // Add the document ID to the word's Set
      }
    });
  });

  // Create a directory for the search index
  const searchIndexDir = path.join(OUTPUT_DIR, this.basePath, 'search-index');
  await fs.mkdir(searchIndexDir, { recursive: true });

  // Save each letter's index as a separate file
  await Promise.all(
    Object.keys(letterIndex).map(async (letter) => {
      const filePath = path.join(searchIndexDir, `${letter}.json`);
      const wordMap = {};

      // Convert Sets to Arrays for JSON serialization
      for (const word in letterIndex[letter]) {
        wordMap[word] = Array.from(letterIndex[letter][word]);
      }

      await fs.writeFile(filePath, JSON.stringify(wordMap, null, 2));
      console.log(`Generated search index file: ${filePath}`);
    })
  );

  console.log(`Search index generated successfully for ${this.basePath}.`);
},
  
};
