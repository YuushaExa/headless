// templates/fav.js

// Define slugify function (keep as is)
function slugify(text, maxLength = 30) {
    if (!text) return '';
    let slug = text.toString().normalize('NFKC'); // Ensure input is string
    slug = slug.toLowerCase(); // Convert to lowercase
    slug = slug.replace(/[\s\u3000]+/g, '-'); // Replace spaces and full-width spaces with hyphens
    slug = slug.replace(/[^\p{L}\p{N}\-]+/gu, ''); // Remove non-alphanumeric chars except hyphens
    slug = slug.replace(/-+/g, '-'); // Collapse multiple hyphens
    slug = slug.replace(/^-+|-+$/g, ''); // Trim leading/trailing hyphens

    // Truncate slug to maxLength
    if (slug.length > maxLength) {
        slug = slug.substring(0, maxLength);
        // Avoid ending with a hyphen after truncation
        slug = slug.replace(/-+$/, '');
    }

    if (!slug) {
        // Generate a simple unique ID if slug becomes empty
        return 'untitled-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    }

    return slug;
}

module.exports = {
    // --- Core Configuration ---
    basePath: 'favs/posts',
    dataUrl: 'https://raw.githubusercontent.com/YuushaExa/merge/main/favsr/merged.json',
    typeName: 'post', // Explicitly define the type name for logs/errors
    // pageSize: 15, // Optional: Override default POSTS_PER_PAGE

    // --- Functions ---
    slugify: slugify, // Make slugify available

    fileNameGenerator: function(item) {
        const title = item.title || 'untitled'; // Handle potentially missing titles
        return `${this.slugify(title)}.json`;
    },

    itemMapper: (post) => ({
        title: post.title || null,
        image: post.url || null,
    }),

    pageMapper: (pagePosts, currentPage, totalPages) => ({
        posts: pagePosts.map(post => ({
            title: post.title || null,
            image: post.url || null,
            link: `/${module.exports.basePath}/${module.exports.slugify(post.title || 'untitled')}.json` // Use module's props
        })),
        pagination: {
            currentPage,
            totalPages,
            nextPage: currentPage < totalPages ? `/${module.exports.basePath}/page/${currentPage + 1}.json` : null,
            previousPage: currentPage > 1 ? (currentPage === 2 ? `/${module.exports.basePath}/index.json` : `/${module.exports.basePath}/page/${currentPage - 1}.json`) : null,
        },
    }),

    plugins: {
        search: {
            enabled: true,
            settings: {
                fieldsToIndex: ['title', 'url'], // Assuming 'url' is the image URL here? Check data structure.
                idField: 'title', // Make sure 'title' is unique or use a different ID field if available
                minWordLength: 1,
                prefixLength: 2,
            }
        }
    },

};
