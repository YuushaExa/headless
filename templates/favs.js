module.exports = {
  plugins: {
    search: { 
      enabled: true,
      settings: {
        fieldsToIndex: ['title', 'url'],
        idField: 'title',
        minWordLength: 1,
        prefixLength: 2,
      }
    },
    slugify: true
  },
  
  basePath: 'favs/posts',
  dataUrl: 'https://raw.githubusercontent.com/YuushaExa/merge/main/favsr/merged.json',

  itemMapper: function(post) {
    return {
      title: post.title || null,
      image: post.url || null,
      link: `favs/posts/${this.plugins.slugify(post.title)}.json`,
    };
  },

  pageMapper: function(pagePosts, currentPage, totalPages) {
    return {
      posts: pagePosts.map(post => ({
        title: post.title || null,
        image: post.url || null,
        link: `favs/posts/${this.plugins.slugify(post.title)}.json`,
      })),
      pagination: {
        currentPage,
        totalPages,
        nextPage: currentPage < totalPages ? `favs/posts/page/${currentPage + 1}.json` : null,
        previousPage: currentPage > 1 ? (currentPage === 2 ? 'favs/posts/index.json' : `favs/posts/page/${currentPage - 1}.json`) : null,
      },
    };
  },

  fileNameGenerator: function(item) {
    return `${this.plugins.slugify(item.title)}.json`;
  },
};
