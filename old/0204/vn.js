// templates/posts.js

// Keep slugify function
function slugify(text) {
    if (!text) return '';
    return text
        .toString()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '')
        .replace(/\//g, '-');
}

// Keep other functions like extractDevelopers etc.
function extractDevelopers(posts) {
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
                link: `vn/posts/${slugify(post.title)}.json`, // Use local slugify
            });
        });
    });
    return Array.from(developersMap.values());
}


module.exports = {
    // Add plugin configuration
    plugins: {
        search: { 
            enabled: true,
            settings: {
                fieldsToIndex: ['title', 'description', 'aliases'],
                idField: 'id',
                minWordLength: 1, // Example: index words with 3+ chars
                prefixLength: 2, // Example: shard files by 2-char prefix (aa.json, ab.json...)
            }
        }
    },

    // Keep existing config
    basePath: 'vn/posts',
    dataUrl: 'https://raw.githubusercontent.com/YuushaExa/merge/main/vnr/merged.json',
    slugify: slugify, // Export slugify if needed elsewhere, or just use locally

    itemMapper: (post) => ({
        id: post.id,
        title: post.title,
        developers: post.developers?.map(dev => ({
            title: dev.name,
            id: dev.id,
            link: `vn/developers/${slugify(dev.name)}.json`, // Use local slugify
        })),
        aliases: post.aliases || [],
        description: post.description || null,
        image: post.image || null,
        link: `vn/posts/${slugify(post.title)}.json`, // Use local slugify
    }),

    pageMapper: (pagePosts, currentPage, totalPages) => ({
        posts: pagePosts.map(post => ({
            id: post.id,
            title: post.title,
            image: post.image || null,
            link: `vn/posts/${slugify(post.title)}.json`, // Use local slugify
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
            basePath: this.basePath,
            itemMapper: this.itemMapper,
            pageMapper: this.pageMapper,
            fileNameGenerator: (item) => `${this.slugify(item.title)}.json`, // Use this.slugify
            typeName: 'post'
        });
    },

    extractDevelopers: extractDevelopers, // Assign the function

    generateRelatedEntities: async function (data, generatePaginatedFiles, POSTS_PER_PAGE) {
        const developers = this.extractDevelopers(data); // Use this.extractDevelopers
        await generatePaginatedFiles({
            items: developers,
            pageSize: POSTS_PER_PAGE,
            basePath: 'vn/developers',
            itemMapper: (dev) => ({
                id: dev.id,
                title: dev.title,
                posts: dev.posts, // Already has correct post links
                link: `vn/developers/${this.slugify(dev.title)}.json`, // Use this.slugify
            }),
            pageMapper: (pageEntities, currentPage, totalPages) => ({
                developers: pageEntities.map(dev => ({
                    id: dev.id,
                    title: dev.title,
                    link: `vn/developers/${this.slugify(dev.title)}.json`, // Use this.slugify
                })),
                pagination: {
                    currentPage,
                    totalPages,
                    nextPage: currentPage < totalPages ? `vn/developers/page/${currentPage + 1}.json` : null,
                    previousPage: currentPage > 1 ? (currentPage === 2 ? 'vn/developers/index.json' : `vn/developers/page/${currentPage - 1}.json`) : null,
                },
            }),
            fileNameGenerator: (dev) => `${this.slugify(dev.title)}.json`, // Use this.slugify
            typeName: 'developers'
        });
    },

    // REMOVED generateSearchIndex function from here
};
