module.exports = {
  basePath: 'vn/posts',
  dataUrl: 'https://raw.githubusercontent.com/YuushaExa/testapi/main/merged.json',

  itemMapper: (post) => ({
    id: post.id,
    title: post.title,
    developers: post.developers?.map(dev => ({
      title: dev.name,
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
            title: dev.name,
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
        title: dev.title,
        posts: dev.posts,
        link: `vn/developers/${dev.id}.json`,
      }),
      pageMapper: (pageEntities, currentPage, totalPages) => ({
        developers: pageEntities.map(dev => ({
          id: dev.id,
          title: dev.title,
          link: `vn/developers/${dev.title}.json`,
        })),
        pagination: {
          currentPage,
          totalPages,
          nextPage: currentPage < totalPages ? `vn/developers/page/${currentPage + 1}.json` : null,
          previousPage: currentPage > 1 ? (currentPage === 2 ? 'vn/developers/index.json' : `vn/developers/page/${currentPage - 1}.json`) : null,
        },
      }),
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
      .filter((word) => word.length > 2);
  }

  const prefixIndexes = {};

  data.forEach((doc) => {
    const id = doc.title;
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
  
};
