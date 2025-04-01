function slugify(text, maxLength = 100) {
  if (!text) return '';
  
  let slug = text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')            // Replace spaces with -
    .replace(/-+/g, '-')             // Replace multiple - with single -
    .replace(/^-+/, '')              // Trim - from start
    .replace(/-+$/, '')              // Trim - from end
    .replace(/\//g, '-')
    .replace(/[^\w\-]+/g, '');       // Remove all non-word chars except -

  // Trim to maxLength
  if (maxLength > 0 && slug.length > maxLength) {
    slug = slug.substring(0, maxLength);
    // Don't end with a hyphen
    slug = slug.replace(/-+$/, '');
  }

  return slug;
}

module.exports = {

 plugins: {
        search: { 
            enabled: true,
            settings: {
                fieldsToIndex: ['title', 'url'],
                idField: 'title',
                minWordLength: 1, // Example: index words with 3+ chars
                prefixLength: 2, // Example: shard files by 2-char prefix (aa.json, ab.json...)
            }
        }
    },
  
  slugify: slugify,
  basePath: 'favs/posts',
  dataUrl: 'https://raw.githubusercontent.com/YuushaExa/merge/main/favsr/merged.json',

  itemMapper: (post) => ({
    title: post.title || null,
    image: post.url || null,
    link: `favs/posts/${slugify(post.title)}.json`,
  }),

  pageMapper: (pagePosts, currentPage, totalPages) => ({
    posts: pagePosts.map(post => ({
      title: post.title || null,
      image: post.url || null,
      link: `favs/posts/${slugify(post.title)}.json`,
    })),
    pagination: {
      currentPage,
      totalPages,
      nextPage: currentPage < totalPages ? `favs/posts/page/${currentPage + 1}.json` : null,
      previousPage: currentPage > 1 ? (currentPage === 2 ? 'favs/posts/index.json' : `favs/posts/page/${currentPage - 1}.json`) : null,
    },
  }),

  generateItems: async function (data, generatePaginatedFiles, POSTS_PER_PAGE) {
    console.log(`Generating main items for ${this.basePath}...`);
    await generatePaginatedFiles({
      items: data,
      pageSize: POSTS_PER_PAGE,
      basePath: 'favs/posts',      // Use template's basePath
      itemMapper: this.itemMapper,  // Use template's itemMapper
      pageMapper: this.pageMapper,  // Use template's pageMapper
      fileNameGenerator: (item) => `${this.slugify(item.title)}.json`,
      typeName: 'post' // Or derive from basePath, e.g., this.basePath.split('/').pop().slice(0, -1)
    });
  },
  
};
