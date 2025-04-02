// templates/fav.js

// Keep slugify function (or import from a shared util)
function slugify(text, maxLength = 30) {
    if (!text) return 'untitled-' + Date.now(); // Handle empty/null text better
    let slug = String(text).normalize('NFKC'); // Ensure text is a string
    slug = slug.replace(/[\s\u3000]+/g, '-'); // Replace spaces/ideographic space with hyphen
    slug = slug.replace(/[^\p{L}\p{N}\-]+/gu, ''); // Remove non-letter, non-number, non-hyphen chars
    slug = slug.replace(/-+/g, '-'); // Collapse consecutive hyphens
    slug = slug.replace(/^-+|-+$/g, ''); // Trim leading/trailing hyphens

    if (maxLength > 0) { // Apply maxLength logic
        // Truncate carefully to avoid ending with a partial character or hyphen
        let currentLength = 0;
        let truncatedSlug = '';
        for (const char of slug) {
             const charLength = Buffer.byteLength(char); // More accurate length for unicode
             if (currentLength + charLength <= maxLength) {
                 truncatedSlug += char;
                 currentLength += charLength;
             } else {
                 break;
             }
        }
         slug = truncatedSlug.replace(/-+$/, ''); // Remove trailing hyphen after potential truncation
    }

    if (!slug) { // If slug becomes empty after processing
        return 'untitled-' + Date.now();
    }

    return slug.toLowerCase(); // Often slugs are lowercase
}


module.exports = {
    // --- Core Configuration for Standard Generation ---
    dataUrl: 'https://raw.githubusercontent.com/YuushaExa/merge/main/favsr/merged.json',
    basePath: 'favs/posts',
    slugify: slugify, // Export the function used by fileNameGenerator

    // This function will generate the filename for individual item JSON files.
    // It uses `this.slugify` which works because ssg.js binds `this` correctly.
    fileNameGenerator: function(item) {
        // Add fallback for items lacking a title
        const titleToSlugify = item && item.title ? item.title : 'untitled';
        return `${this.slugify(titleToSlugify)}.json`;
    },

    // Defines the structure of individual item JSON files
    itemMapper: (post) => ({
        title: post.title || null,
        image: post.url || null,
        // Generate link relative to the OUTPUT_DIR root
        link: `/${path.join('favs/posts', `${slugify(post.title || 'untitled')}.json`).replace(/\\/g, '/')}`,
        // Or keep it as before if you resolve paths client-side:
        // link: `favs/posts/${slugify(post.title || 'untitled')}.json`,
    }),

    // Defines the structure of the pagination index files (index.json, page/2.json, etc.)
    pageMapper: (pagePosts, currentPage, totalPages) => {
        const basePath = 'favs/posts'; // Define base path for link generation
        return {
            posts: pagePosts.map(post => ({
                title: post.title || null,
                image: post.url || null,
                 // Ensure consistent link generation here too
                link: `/${path.join(basePath, `${slugify(post.title || 'untitled')}.json`).replace(/\\/g, '/')}`,
            })),
            pagination: {
                currentPage,
                totalPages,
                // Generate links relative to the OUTPUT_DIR root
                nextPage: currentPage < totalPages ? `/${path.join(basePath, 'page', `${currentPage + 1}.json`).replace(/\\/g, '/')}` : null,
                previousPage: currentPage > 1 ? (currentPage === 2 ? `/${path.join(basePath, 'index.json').replace(/\\/g, '/')}` : `/${path.join(basePath, 'page', `${currentPage - 1}.json`).replace(/\\/g, '/')}`) : null,
            },
        };
    },

    // Optional: Define typeName if auto-detection isn't desired
    // typeName: 'favourite',

    // --- Plugins ---
    plugins: {
        search: {
            enabled: true,
            settings: {
                fieldsToIndex: ['title', 'url'],
                idField: 'title', // Make sure IDs are unique, title might not be! Consider adding a unique ID to your source data.
                minWordLength: 1,
                prefixLength: 2,
            }
        }
    },

    // --- Optional Custom Generation Hooks (if needed for specific logic) ---
    // generateItems: async function (data, generatePaginatedFiles, POSTS_PER_PAGE, fileCounter) { ... } // Only if standard gen isn't enough
    // generateRelatedEntities: async function (data, generatePaginatedFiles, POSTS_PER_PAGE, fileCounter) { ... }

};
