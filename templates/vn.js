module.exports = {
  basePath: 'vn/posts', // Posts will be generated under `public/vn/posts/`
  dataUrl: 'https://raw.githubusercontent.com/YuushaExa/testapi/refs/heads/main/merged.json',
// posts
  itemMapper: (post) => ({
    id: post.id,
    title: post.title,
    developers: post.developers?.map((developer) => ({
      name: developer.name,
      id: developer.id,
      link: `vn/developer/${developer.id}.json`, // Link to developer files
    })),
    aliases: post.aliases || [],
    description: post.description || null,
    image: post.image || null,
    link: `vn/posts/${post.id}.json`, // Link to post files
  }),
  // pagination, index page
  pageMapper: (pagePosts, currentPage, totalPages) => ({
    posts: pagePosts.map((post) => ({
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
  extractRelatedEntities: (posts) => {
    const developersMap = {};

    posts.forEach((post) => {
      post.developers?.forEach((developer) => {
        const developerId = developer.id;
        if (!developersMap[developerId]) {
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

    return Object.values(developersMap);
  },
  generateRelatedEntities: async function (data, generatePaginatedFiles, POSTS_PER_PAGE) {
    const relatedEntities = this.extractRelatedEntities(data);
    await generatePaginatedFiles({
      items: relatedEntities,
      pageSize: POSTS_PER_PAGE,
      basePath: 'vn/developer', // Developers will be generated under `public/vn/developer/`
      itemMapper: (entity) => ({
        id: entity.id,
        name: entity.name,
        posts: entity.posts,
        link: `vn/developer/${entity.id}.json`,
      }),
      pageMapper: (pageEntities, currentPage, totalPages) => ({
        developers: pageEntities.map((dev) => ({
          id: dev.id,
          name: dev.name,
          link: `vn/developer/${dev.id}.json`,
        })),
        pagination: {
          currentPage,
          totalPages,
          nextPage: currentPage < totalPages ? `vn/developer/page/${currentPage + 1}.json` : null,
          previousPage: currentPage > 1 ? (currentPage === 2 ? 'vn/developer/index.json' : `vn/developer/page/${currentPage - 1}.json`) : null,
        },
      }),
    });
  },
};
