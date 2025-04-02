// templates/posts.js

// Keep the original simple slugify function
function slugify(text) {
    if (!text) return '';
    return text
        .toString()
        .toLowerCase()
        .replace(/\s+/g, '-') // Replace spaces with -
        .replace(/[^\w\-]+/g, '') // Remove all non-word chars
        .replace(/\-\-+/g, '-') // Replace multiple - with single -
        .replace(/^-+/, '') // Trim - from start of text
        .replace(/-+$/, ''); // Trim - from end of text
        // Removed the / replacement for simplicity as per original request implied
}

// Keep extractDevelopers as it was originally structured
function extractDevelopers(posts) {
    const developersMap = new Map();
    posts.forEach(post => {
        // Use original slugify directly since 'this' context might not be guaranteed inside here
        const postSlug = slugify(post.title || 'untitled-post');
        post.developers?.forEach(dev => {
             if (!dev || !dev.id) return; // Basic check
             const devId = dev.id;
             const devName = dev.name || 'unknown-developer';
            if (!developersMap.has(devId)) {
                developersMap.set(devId, {
                    id: devId,
                    title: devName,
                    posts: [],
                });
            }
            developersMap.get(devId).posts.push({
                // id: post.id, // Keep if needed
                title: post.title || 'Untitled Post',
                image: post.image || null,
                // Keep original link structure (relative to output dir root implicitly)
                link: `vn/posts/${postSlug}.json`,
            });
        });
    });
    return Array.from(developersMap.values());
}


module.exports = {
    // --- Core Configuration ---
    basePath: 'vn/posts',
    dataUrl: 'https://raw.githubusercontent.com/YuushaExa/merge/main/vnr/merged.json',
    typeName: 'post', // **ADDED** Explicit type name

    // --- Functions ---
    slugify: slugify, // Export the function so 'this.slugify' works via binding in ssg.js

    // **ADDED** Main item file name generator
    fileNameGenerator: function(item) {
        // 'this' is bound to module.exports by ssg.js
        const title = item.title || 'untitled-post'; // Handle missing title
        return `${this.slugify(title)}.json`;
    },

    // --- Mappers (Main Items) --- Keep original structure
    itemMapper: (post) => {
        // Use the exported slugify directly if needed, avoid 'this' here unless bound
        const postSlug = slugify(post.title || 'untitled-post');
        const devSlug = (name) => slugify(name || 'unknown-developer');

        return {
            id: post.id,
            title: post.title,
            developers: post.developers?.map(dev => ({
                title: dev?.name, // Keep original structure
                id: dev?.id,
                // Keep original link structure
                link: `vn/developers/${devSlug(dev?.name)}.json`,
            })).filter(Boolean), // Keep filter for safety
            aliases: post.aliases || [],
            description: post.description || null,
            image: post.image || null,
            // Keep original link structure
            link: `vn/posts/${postSlug}.json`,
        };
    },

    pageMapper: (pagePosts, currentPage, totalPages) => ({
        posts: pagePosts.map(post => ({
            id: post.id,
            title: post.title,
            image: post.image || null,
             // Keep original link structure
            link: `vn/posts/${slugify(post.title || 'untitled-post')}.json`,
        })),
        pagination: {
            currentPage,
            totalPages,
             // Keep original link structure
            nextPage: currentPage < totalPages ? `vn/posts/page/${currentPage + 1}.json` : null,
            previousPage: currentPage > 1 ? (currentPage === 2 ? 'vn/posts/index.json' : `vn/posts/page/${currentPage - 1}.json`) : null,
        },
    }),

    // --- Related Entities Generation --- Keep original structure
    extractDevelopers: extractDevelopers, // Assign the function

    generateRelatedEntities: async function (data, generatePaginatedFiles, POSTS_PER_PAGE) {
        const developers = this.extractDevelopers(data); // Use this.extractDevelopers
        console.log(`\nGenerating related entities: ${developers.length} developers...`); // Keep log

        if (developers.length === 0) {
            console.log("No developers found to generate.");
            return;
        }

        const developersBasePath = 'vn/developers'; // Define base path

        await generatePaginatedFiles({
            items: developers,
            pageSize: POSTS_PER_PAGE,
            basePath: developersBasePath,
            // Pass context explicitly for generatePaginatedFiles binding
            // If its mappers/fileNameGenerator use 'this.slugify', they need this context.
            templateContext: this,
            itemMapper: (dev) => ({ // Use local slugify for safety if context binding isn't guaranteed deep down
                id: dev.id,
                title: dev.title,
                posts: dev.posts, // Already has links from extractDevelopers
                // Keep original link structure
                link: `${developersBasePath}/${slugify(dev.title || 'unknown-developer')}.json`,
            }),
            pageMapper: (pageEntities, currentPage, totalPages) => ({
                developers: pageEntities.map(dev => ({
                    id: dev.id,
                    title: dev.title,
                     // Keep original link structure
                    link: `${developersBasePath}/${slugify(dev.title || 'unknown-developer')}.json`,
                })),
                pagination: {
                    currentPage,
                    totalPages,
                     // Keep original link structure
                    nextPage: currentPage < totalPages ? `${developersBasePath}/page/${currentPage + 1}.json` : null,
                    previousPage: currentPage > 1 ? (currentPage === 2 ? `${developersBasePath}/index.json` : `${developersBasePath}/page/${currentPage - 1}.json`) : null,
                },
            }),
            // fileNameGenerator needs the bound 'this' from templateContext to access this.slugify
            fileNameGenerator: function(dev) {
                const title = dev.title || 'unknown-developer';
                return `${this.slugify(title)}.json`;
            },
            typeName: 'developer' // Specific type name
        });
    },

    // --- Plugins --- Keep original structure
    plugins: {
        search: {
            enabled: true,
            settings: {
                fieldsToIndex: ['title', 'description', 'aliases'],
                idField: 'id',
                minWordLength: 1,
                prefixLength: 2,
            }
        }
    },

    // **REMOVED** generateItems function
    // **REMOVED** generateSearchIndex function (handled by plugin system)
};
