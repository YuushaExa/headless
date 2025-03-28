function slugify(text) {
  if (!text) return '';
  
  return text
    .toString()
        .toLowerCase()
    .replace(/\s+/g, '-')            // Replace spaces with -
    .replace(/-+/g, '-')             // Replace multiple - with single -
    .replace(/^-+/, '')              // Trim - from start
    .replace(/-+$/, '')             // Trim - from end
    .replace(/\//g, '-');
}

module.exports = {
  slugify: slugify,
  basePath: 'vn/posts',
  dataUrl: 'https://raw.githubusercontent.com/YuushaExa/testapi/main/merged.json',

  itemMapper: (post) => ({
    id: post.id,
    title: post.title,
    developers: post.developers?.map(dev => ({
      title: dev.name,
      id: dev.id,
      link: `vn/developers/${slugify(dev.name)}.json`,
    })),
    aliases: post.aliases || [],
    description: post.description || null,
    image: post.image || null,
    link: `vn/posts/${slugify(post.title)}.json`,
  }),

  pageMapper: (pagePosts, currentPage, totalPages) => ({
    posts: pagePosts.map(post => ({
      id: post.id,
      title: post.title,
      image: post.image || null,
      link: `vn/posts/${slugify(post.title)}.json`,
    })),
    pagination: {
      currentPage,
      totalPages,
      nextPage: currentPage < totalPages ? `vn/posts/page/${currentPage + 1}.json` : null,
      previousPage: currentPage > 1 ? (currentPage === 2 ? 'vn/posts/index.json' : `vn/posts/page/${currentPage - 1}.json`) : null,
    },
  }),

  generateItems: async function (data, generatePaginatedFiles, POSTS_PER_PAGE) {
    console.log(`Generating main items for ${this.basePath}...`);
    await generatePaginatedFiles({
      items: data,
      pageSize: POSTS_PER_PAGE,
      basePath: this.basePath,      // Use template's basePath
      itemMapper: this.itemMapper,  // Use template's itemMapper
      pageMapper: this.pageMapper,  // Use template's pageMapper
      // Use template's slugify via 'this'
      fileNameGenerator: (item) => `${this.slugify(item.title)}.json`,
      typeName: 'post' // Or derive from basePath, e.g., this.basePath.split('/').pop().slice(0, -1)
    });
  },
  
  extractDevelopers: (posts) => {
    const developersMap = new Map();

    posts.forEach(post => {
      post.developers?.forEach(dev => {
        if (!developersMap.has(dev.id)) {
          developersMap.set(dev.id, {
            id: dev.id,
            title: dev.name,
            posts: [],
          });
        }
        developersMap.get(dev.id).posts.push({
          id: post.id,
          title: post.title,
          image: post.image || null,
          link: `vn/posts/${slugify(post.title)}.json`,
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
      basePath: 'vn/developers',
      itemMapper: (dev) => ({
        id: dev.id,
        title: dev.title,
        posts: dev.posts,
        link: `vn/developers/${slugify(dev.title)}.json`,
      }),
      pageMapper: (pageEntities, currentPage, totalPages) => ({
        developers: pageEntities.map(dev => ({
          id: dev.id,
          title: dev.title,
          link: `vn/developers/${slugify(dev.title)}.json`,
        })),
        pagination: {
          currentPage,
          totalPages,
          nextPage: currentPage < totalPages ? `vn/developers/page/${currentPage + 1}.json` : null,
          previousPage: currentPage > 1 ? (currentPage === 2 ? 'vn/developers/index.json' : `vn/developers/page/${currentPage - 1}.json`) : null,
        },
      }),
    fileNameGenerator: (dev) => `${slugify(dev.title)}.json`,
    typeName: 'developers'
    });
  },

generateSearchIndex: async function (data, OUTPUT_DIR, counter) {
  const fs = require('fs').promises;
  const path = require('path');

  function tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((word) => word.length > 1);
  }

  const prefixIndexes = {};

  data.forEach((doc) => {
    const id = doc.id
    const tokens = [...tokenize(doc.title || ''), ...tokenize(doc.description || '')];

    if (!Array.isArray(tokens)) {
      throw new Error(`Invalid tokens generated for document ID: ${id}`);
    }

    tokens.forEach((word) => {
      const prefix = word.slice(0, 2);
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
  
};
