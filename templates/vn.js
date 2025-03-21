module.exports = {
  basePath: 'vn', // Base path for generated files
  pageSize: 10,   // Number of items per page
  dataUrl: 'https://raw.githubusercontent.com/YuushaExa/testapi/refs/heads/main/merged.json', // Data URL specific to this template

  // Extract entities (posts and developers)
  extractEntities: (data) => {
    const developersMap = {};

    data.forEach((post) => {
      post.developers?.forEach((developer) => {
        const developerId = developer.id;
        if (!developersMap[developerId]) { // Fixed typo: `developersMap` instead of `developersMap`
          developersMap[developerId] = {
            id: developer.id,
            name: developer.name,
            posts: [],
          };
        }
        developersMap[developerId].posts.push({
          id: post.id,
          title: post.title,
          image: post.image || null,
          link: `vn/posts/${post.id}.json`,
        });
      });
    });

    return {
      posts: data.map((post) => ({
        id: post.id,
        title: post.title,
        developers: post.developers?.map((developer) => ({ // Fixed typo: `developers` -> `developers`
          name: developer.name,
          id: developer.id,
          link: `vn/developers/${developer.id}.json`,
        })),
        aliases: post.aliases || [],
        description: post.description || null,
        image: post.image || null,
        link: `vn/posts/${post.id}.json`,
      })),
      developers: Object.values(developersMap),
    };
  },

  // Generate paginated files for posts and developers
  generateFiles: async ({ fetchData, generatePaginatedFiles }) => {
    // Fetch data using the template-specific URL
    const data = await fetchData(this.dataUrl);
    const { posts, developers } = this.extractEntities(data);

    // Generate paginated files for posts
    await generatePaginatedFiles({
      items: posts,
      pageSize: this.pageSize,
      basePath: `${this.basePath}/posts`,
      itemMapper: (post) => post,
      pageMapper: (pagePosts, currentPage, totalPages) => ({
        posts: pagePosts.map((post) => ({
          id: post.id,
          title: post.title,
          image: post.image || null,
          link: `${this.basePath}/posts/${post.id}.json`,
        })),
        pagination: this.generatePaginationLinks(currentPage, totalPages, `${this.basePath}/posts`),
      }),
    });

    // Generate paginated files for developers
    await generatePaginatedFiles({
      items: developers,
      pageSize: this.pageSize,
      basePath: `${this.basePath}/developers`,
      itemMapper: (developer) => developer,
      pageMapper: (pageDevelopers, currentPage, totalPages) => ({
        developers: pageDevelopers.map((dev) => ({
          id: dev.id,
          name: dev.name,
          link: `${this.basePath}/developers/${dev.id}.json`,
        })),
        pagination: this.generatePaginationLinks(currentPage, totalPages, `${this.basePath}/developers`),
      }),
    });
  },

  // Pagination links generator
  generatePaginationLinks: (currentPage, totalPages, basePath) => {
    const nextPage = currentPage < totalPages ? `${basePath}/page/${currentPage + 1}.json` : null;
    const previousPage = currentPage > 1 ? (currentPage === 2 ? 'index.json' : `${basePath}/page/${currentPage - 1}.json`) : null;

    return { currentPage, totalPages, nextPage, previousPage };
  },
};
