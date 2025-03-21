// Utility function to generate links for entities
function generateEntityLink(entityType, entityId) {
  return `vn/${entityType}/${entityId}.json`;
}

// Generate paginated files for a given type
async function generatePaginatedFiles({
  items,
  pageSize,
  basePath,
  itemMapper,
  pageMapper,
  fileNameGenerator = (item) => `${item.id}.json`,
}) {
  const baseDir = path.join(OUTPUT_DIR, basePath);
  await ensureDirectoryExists(baseDir);

  // Generate individual item files
  await Promise.all(
    items.map(async (item, index) => {
      const filePath = path.join(baseDir, fileNameGenerator(item));
      await writeJsonFile(filePath, itemMapper(item));

      totalFilesGenerated++;
      if (index < 3) console.log(`Generated item file: ${filePath}`);
    })
  );

  // Paginate items and generate index files
  const paginatedItems = paginateItems(items, pageSize);
  await generatePaginatedIndex(paginatedItems, baseDir, pageMapper);
}

// Main function
async function main() {
  try {
    console.time('File generation time');

    const data = await fetchData(DATA_URL);
    if (!Array.isArray(data)) throw new Error('Fetched data is not an array.');
    if (data.length === 0) {
      console.warn('Warning: No data found. Exiting.');
      return;
    }

    // Generate paginated files for posts
    await generatePaginatedFiles({
      items: data,
      pageSize: POSTS_PER_PAGE,
      basePath: 'vn',
      itemMapper: (post) => ({
        id: post.id,
        title: post.title,
        developers: (post.developers || []).map((developer) => ({
          name: developer.name,
          id: developer.id,
          link: generateEntityLink('developers', developer.id), // Add link for each developer
        })),
        aliases: post.aliases || [],
        description: post.description || null,
        image: post.image || null,
      }),
      pageMapper: (pagePosts, currentPage, totalPages) => ({
        posts: pagePosts.map((post) => ({
          id: post.id,
          title: post.title,
          image: post.image || null,
          link: `vn/${post.id}.json`,
        })),
        pagination: generatePaginationLinks(currentPage, totalPages, 'vn'),
      }),
    });

    // Generate paginated files for developers
    const developers = extractRelatedEntities(
      data,
      'developers',
      'id',
      (post) => `vn/${post.id}.json`
    );

    await generatePaginatedFiles({
      items: developers,
      pageSize: POSTS_PER_PAGE,
      basePath: 'vn/developers',
      itemMapper: (developer) => ({
        name: developer.name,
        id: developer.id,
        link: generateEntityLink('developers', developer.id), // Add link for the developer itself
        posts: developer.items.map((post) => ({
          id: post.id,
          title: post.title,
          image: post.image || null,
          link: post.link, // Link already generated in extractRelatedEntities
        })),
      }),
      pageMapper: (pageDevelopers, currentPage, totalPages) => ({
        developers: pageDevelopers.map((dev) => ({
          name: dev.name,
          id: dev.id,
          link: generateEntityLink('developers', dev.id), // Add link for each developer
        })),
        pagination: generatePaginationLinks(currentPage, totalPages, 'vn/developers'),
      }),
    });

    console.timeEnd('File generation time');
    console.log(`Generated ${totalFilesGenerated} files in total.`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
