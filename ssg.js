const fs = require('fs');
const path = require('path');
const https = require('https');

const config = {
  postsPerPage: 10,
  outputDir: './public',
  dataUrl: 'https://raw.githubusercontent.com/YuushaExa/testapi/refs/heads/main/merged.json'
};

// Ensure required directories exist
const requiredDirs = ['posts', 'index', 'developers'];
requiredDirs.forEach(dir => {
  const dirPath = path.join(config.outputDir, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// Fetch JSON data
async function fetchData(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch data. Status code: ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error(`Error parsing JSON: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`Error fetching data: ${error.message}`));
    });
  });
}

// Paginate data
function paginatePosts(posts, pageSize) {
  const paginated = [];
  for (let i = 0; i < posts.length; i += pageSize) {
    paginated.push(posts.slice(i, i + pageSize));
  }
  return paginated;
}

// Generate paginated files
function generatePaginatedFiles(data, outputPath, pageSize, metadataCallback) {
  const paginatedData = paginatePosts(data, pageSize);
  const totalPages = paginatedData.length;

  paginatedData.forEach((page, pageIndex) => {
    const pageFileName = `${pageIndex + 1}.json`;
    const filePath = path.join(outputPath, pageFileName);

    const pageMetadata = metadataCallback(page, pageIndex, totalPages);
    fs.writeFileSync(filePath, JSON.stringify(pageMetadata, null, 2));
  });
}

// Main function
async function main() {
  try {
    const data = await fetchData(config.dataUrl);
    if (!Array.isArray(data)) throw new Error("Fetched data is not an array.");
    if (data.length === 0) return console.warn('Warning: No posts found.');

    // Generate individual post files
    data.forEach(post => {
      const postFilePath = path.join(config.outputDir, 'posts', `${post.id}.json`);
      const postMetadata = {
        id: post.id,
        title: post.title,
        developers: post.developers || [],
        aliases: post.aliases || [],
        description: post.description || null,
        image: post.image || null
      };
      fs.writeFileSync(postFilePath, JSON.stringify(postMetadata, null, 2));
    });

    // Generate paginated index files
    generatePaginatedFiles(data, path.join(config.outputDir, 'index'), config.postsPerPage, (page, pageIndex, totalPages) => ({
      currentPage: pageIndex + 1,
      totalPages,
      nextPage: pageIndex + 2 <= totalPages ? `index/${pageIndex + 2}.json` : null,
      previousPage: pageIndex > 0 ? `index/${pageIndex}.json` : null,
      posts: page.map(post => ({
        id: post.id,
        title: post.title,
        image: post.image || null,
        link: `posts/${post.id}.json`
      }))
    }));

    // Map developers to their posts
    const developersMap = data.reduce((acc, post) => {
      if (Array.isArray(post.developers)) {
        post.developers.forEach(developer => {
          const devId = developer.id;
          if (!acc[devId]) {
            acc[devId] = {
              name: developer.name,
              id: devId,
              posts: []
            };
          }
          acc[devId].posts.push({
            id: post.id,
            title: post.title,
            image: post.image || null,
            link: `posts/${post.id}.json`
          });
        });
      }
      return acc;
    }, {});

    // Generate developer-specific pages
    Object.entries(developersMap).forEach(([devId, developer]) => {
      const developerDir = path.join(config.outputDir, 'developers', devId);
      if (!fs.existsSync(developerDir)) {
        fs.mkdirSync(developerDir, { recursive: true });
      }

      generatePaginatedFiles(developer.posts, developerDir, config.postsPerPage, (page, pageIndex, totalPages) => ({
        developer: {
          name: developer.name,
          id: developer.id
        },
        currentPage: pageIndex + 1,
        totalPages,
        nextPage: pageIndex + 2 <= totalPages ? `${devId}/${pageIndex + 2}.json` : null,
        previousPage: pageIndex > 0 ? `${devId}/${pageIndex}.json` : null,
        posts: page
      }));
    });

    console.log('JSON generation complete!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
