// templates/posts.js

// Use a more robust slugify function
function slugify(text, maxLength = 50) { // Added maxLength parameter
    if (!text) return '';
    let slug = text.toString().normalize('NFKC'); // Ensure input is string, normalize unicode
    slug = slug.toLowerCase(); // Convert to lowercase
    slug = slug.replace(/[\s\u3000]+/g, '-'); // Replace spaces and full-width spaces with hyphens
    slug = slug.replace(/[^\p{L}\p{N}\-]+/gu, ''); // Remove non-alphanumeric chars except hyphens
    slug = slug.replace(/-+/g, '-'); // Collapse multiple hyphens
    slug = slug.replace(/^-+|-+$/g, ''); // Trim leading/trailing hyphens
    slug = slug.replace(/\//g, '-'); // Replace slashes specifically

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


// Keep extractDevelopers, but update links to be root-relative
function extractDevelopers(posts, basePath) { // Pass basePath for context
    const developersMap = new Map();
    const postBasePath = basePath; // Assuming posts are at the main basePath passed to the template
    posts.forEach(post => {
        const postSlug = slugify(post.title || 'untitled-post'); // Slugify post title once
        post.developers?.forEach(dev => {
            if (!dev || !dev.id) return; // Skip if dev or dev.id is missing
            const devId = dev.id;
            const devName = dev.name || 'unknown-developer'; // Handle missing names
            if (!developersMap.has(devId)) {
                developersMap.set(devId, {
                    id: devId,
                    title: devName,
                    posts: [],
                });
            }
            developersMap.get(devId).posts.push({
                // Keep post id if needed, but link is primary
                // id: post.id,
                title: post.title || 'Untitled Post',
                image: post.image || null,
                 // Link relative to output root
                link: `/${postBasePath}/${postSlug}.json`,
            });
        });
    });
    return Array.from(developersMap.values());
}


module.exports = {
    // --- Core Configuration ---
    basePath: 'vn/posts',
    dataUrl: 'https://raw.githubusercontent.com/YuushaExa/merge/main/vnr/merged.json',
    typeName: 'post', // Explicit type name
    // pageSize: 10, // Optional: Override default POSTS_PER_PAGE

    // --- Functions ---
    slugify: slugify, // Export the function so 'this.slugify' works

    // Main item file name generator
    fileNameGenerator: function(item) {
        // 'this' is bound to module.exports by ssg.js
        const title = item.title || 'untitled-post'; // Handle missing title
        return `${this.slugify(title)}.json`;
    },

    // --- Mappers (Main Items) ---
    itemMapper: (post) => {
        const postSlug = slugify(post.title || 'untitled-post'); // Use local slugify
        // Define base paths for related entities for link generation
        const developersBasePath = 'vn/developers'; // Could be dynamic if needed

        return {
            id: post.id,
            title: post.title || 'Untitled Post', // Handle missing title
            developers: post.developers?.map(dev => {
                 if (!dev) return null; // Handle potentially null developer entries
                 const devName = dev.name || 'unknown-developer';
                 const devSlug = slugify(devName);
                 return {
                    // title: devName, // title/name are often synonymous
                    id: dev.id, // Keep ID if useful
                    name: devName, // Use 'name' for consistency if API uses it
                    // Link relative to output root
                    link: `/${developersBasePath}/${devSlug}.json`,
                 };
            }).filter(Boolean), // Filter out any null entries if they occurred
            aliases: post.aliases || [],
            description: post.description || null,
            image: post.image || null,
            // Link is implicit via file path, but can be added if needed for direct use
            // link: `/${module.exports.basePath}/${postSlug}.json`,
        };
    },

    pageMapper: (pagePosts, currentPage, totalPages) => ({
        posts: pagePosts.map(post => {
            const postSlug = slugify(post.title || 'untitled-post'); // Use local slugify
            return {
                id: post.id,
                title: post.title || 'Untitled Post',
                image: post.image || null,
                 // Link relative to output root
                link: `/${module.exports.basePath}/${postSlug}.json`,
            };
        }),
        pagination: {
            currentPage,
            totalPages,
             // Links relative to output root
            nextPage: currentPage < totalPages ? `/${module.exports.basePath}/page/${currentPage + 1}.json` : null,
            previousPage: currentPage > 1 ? (currentPage === 2 ? `/${module.exports.basePath}/index.json` : `/${module.exports.basePath}/page/${currentPage - 1}.json`) : null,
        },
    }),

    // --- Related Entities Generation ---
    extractDevelopers: extractDevelopers, // Assign the function

    generateRelatedEntities: async function (data, generatePaginatedFiles, POSTS_PER_PAGE) {
        const developersBasePath = 'vn/developers'; // Define base path for developers
        // Pass the main basePath to extractDevelopers for correct post link generation
        const developers = this.extractDevelopers(data, this.basePath);
        console.log(`\nGenerating related entities: ${developers.length} developers...`); // Add log

        if (developers.length === 0) {
            console.log("No developers found to generate.");
            return;
        }

        await generatePaginatedFiles({
            items: developers,
            pageSize: POSTS_PER_PAGE,
            basePath: developersBasePath, // Use specific base path
             // Use 'this' which is bound to module.exports
            templateContext: this, // Pass context explicitly for generatePaginatedFiles binding
            itemMapper: (dev) => {
                 const devSlug = this.slugify(dev.title); // Use this.slugify
                 return {
                    id: dev.id,
                    title: dev.title, // Or 'name' depending on consistency
                    // Posts already have root-relative links from extractDevelopers
                    posts: dev.posts || [],
                    // link: `/${developersBasePath}/${devSlug}.json` // Implicit via file path
                };
            },
            pageMapper: (pageEntities, currentPage, totalPages) => ({
                developers: pageEntities.map(dev => {
                    const devSlug = this.slugify(dev.title); // Use this.slugify
                    return {
                        id: dev.id,
                        title: dev.title,
                        // Link relative to output root
                        link: `/${developersBasePath}/${devSlug}.json`,
                    };
                }),
                pagination: {
                    currentPage,
                    totalPages,
                     // Links relative to output root
                    nextPage: currentPage < totalPages ? `/${developersBasePath}/page/${currentPage + 1}.json` : null,
                    previousPage: currentPage > 1 ? (currentPage === 2 ? `/${developersBasePath}/index.json` : `/${developersBasePath}/page/${currentPage - 1}.json`) : null,
                },
            }),
            fileNameGenerator: function(dev) { // Define as function to access 'this' correctly
                const title = dev.title || 'unknown-developer';
                 // Ensure 'this' refers to the template module context passed via templateContext
                return `${this.slugify(title)}.json`;
            },
            typeName: 'developer' // Specific type name for logs
        });
    },

    // --- Plugins ---
    plugins: {
        search: {
            enabled: true,
            settings: {
                // Ensure these fields exist in the data mapped by itemMapper for main items
                fieldsToIndex: ['title', 'description', 'aliases'],
                idField: 'id', // Make sure post.id is unique and present
                minWordLength: 1,
                prefixLength: 2,
            }
        }
    },

    // REMOVED generateItems function - ssg.js handles this now
    // REMOVED generateSearchIndex function - handled by plugin system in ssg.js
};
