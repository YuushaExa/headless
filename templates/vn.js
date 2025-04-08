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
                link: `vn/posts/${slugify(post.title)}.json`,
            });
        });
    });
    return Array.from(developersMap.values());
}

module.exports = {
    plugins: {
        search: { 
            enabled: true,
            settings: {
                fieldsToIndex: ['link', 'title', 'description'],
                idField: 'link',
                minWordLength: 1,
                prefixLength: 2,
            }
        }
    },

    basePath: 'vn/posts',
    dataUrl: 'https://raw.githubusercontent.com/YuushaExa/testapi/main/merged.json',
    slugify: slugify,

    // This replaces generateItems - tells the SSG how to name individual post files
    fileNameGenerator: (item) => `${slugify(item.title)}.json`,

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

    extractDevelopers: extractDevelopers,

    generateRelatedEntities: async function (data, generatePaginatedFiles, POSTS_PER_PAGE) {
        const developers = this.extractDevelopers(data);
        await generatePaginatedFiles({
            items: developers,
            pageSize: POSTS_PER_PAGE,
            basePath: 'vn/developers',
            itemMapper: (dev) => ({
                id: dev.id,
                title: dev.title,
                posts: dev.posts,
                link: `vn/developers/${this.slugify(dev.title)}.json`,
            }),
            pageMapper: (pageEntities, currentPage, totalPages) => ({
                developers: pageEntities.map(dev => ({
                    id: dev.id,
                    title: dev.title,
                    link: `vn/developers/${this.slugify(dev.title)}.json`,
                })),
                pagination: {
                    currentPage,
                    totalPages,
                    nextPage: currentPage < totalPages ? `vn/developers/page/${currentPage + 1}.json` : null,
                    previousPage: currentPage > 1 ? (currentPage === 2 ? 'vn/developers/index.json' : `vn/developers/page/${currentPage - 1}.json`) : null,
                },
            }),
            fileNameGenerator: (dev) => `${this.slugify(dev.title)}.json`,
            typeName: 'developers'
        });
    },
};
