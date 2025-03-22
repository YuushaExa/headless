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

  // Add search index generation logic
generateSearchIndex: async function (data, OUTPUT_DIR) {

  // Helper function to tokenize text
  function tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove punctuation
      .split(/\s+/) // Split by whitespace
      .filter((word) => word.length > 2); // Ignore short words
  }

  // Define alphabetical ranges
  const ranges = [
    { name: 'a-c', test: (word) => /^[a-c]/.test(word) },
    { name: 'd-f', test: (word) => /^[d-f]/.test(word) },
    { name: 'g-i', test: (word) => /^[g-i]/.test(word) },
    { name: 'j-l', test: (word) => /^[j-l]/.test(word) },
    { name: 'm-o', test: (word) => /^[m-o]/.test(word) },
    { name: 'p-s', test: (word) => /^[p-s]/.test(word) },
    { name: 't-v', test: (word) => /^[t-v]/.test(word) },
    { name: 'w-z', test: (word) => /^[w-z]/.test(word) },
  ];

  // Initialize inverted indexes for each range
  const rangeIndexes = {};
  ranges.forEach((range) => {
    rangeIndexes[range.name] = {};
  });

  // Metadata storage
  const metadata = {};

tokens.forEach((word) => {
  const range = ranges.find((r) => r.test(word));
  if (range) {
    if (!rangeIndexes[range.name]) {
      rangeIndexes[range.name] = {}; // Ensure the range object exists
    }
    if (!rangeIndexes[range.name][word]) {
      rangeIndexes[range.name][word] = new Set(); // Initialize as a Set
    }

    console.log(`Processing word: "${word}"`);
    console.log(`Type of rangeIndexes[${range.name}][${word}]:`, typeof rangeIndexes[range.name][word]);
    console.log(`Is Set?`, rangeIndexes[range.name][word] instanceof Set);

    // Ensure it's still a Set before calling .add()
    if (!(rangeIndexes[range.name][word] instanceof Set)) {
      throw new Error(`Expected a Set but got ${typeof rangeIndexes[range.name][word]} for word "${word}"`);
    }

    rangeIndexes[range.name][word].add(id); // Add the document ID to the Set
  }
});

  // Convert Sets to Arrays for JSON serialization
  for (const range of ranges) {
    for (const word in rangeIndexes[range.name]) {
      rangeIndexes[range.name][word] = Array.from(rangeIndexes[range.name][word]);
    }
  }

  // Create a directory for the search index
  const searchIndexDir = path.join(OUTPUT_DIR, this.basePath, 'search-index');
  await fs.mkdir(searchIndexDir, { recursive: true });

  // Save each range index and metadata
  await Promise.all([
    ...ranges.map((range) =>
      fs.writeFile(
        path.join(searchIndexDir, `index-${range.name}.json`),
        JSON.stringify(rangeIndexes[range.name], null, 2)
      )
    ),
    fs.writeFile(
      path.join(searchIndexDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    ),
  ]);

  console.log(`Search index generated successfully for ${this.basePath}.`);
},
};
