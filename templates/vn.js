module.exports = {
  basePath: 'vn',
  itemMapper: (post) => ({
    id: post.id,
    title: post.title,
    developers: post.developers?.map((developer) => ({
      name: developer.name,
      id: developer.id,
      link: `vn/developers/${developer.id}.json`,
    })),
    aliases: post.aliases || [],
    description: post.description || null,
    image: post.image || null,
    link: `vn/posts/${post.id}.json`,
  }),
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
};
