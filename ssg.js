const fs = require('fs');
const path = require('path');
const https = require('https'); // For fetching remote JSON

// Remote JSON URL
const dataUrl = 'https://raw.githubusercontent.com/YuushaExa/testapi/refs/heads/main/merged.json';

// Output directory
const outputDir = './public';

// Ensure the output directory and subdirectories exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}
if (!fs.existsSync(path.join(outputDir, 'posts'))) {
  fs.mkdirSync(path.join(outputDir, 'posts'), { recursive: true });
}
if (!fs.existsSync(path.join(outputDir, 'index'))) {
  fs.mkdirSync(path.join(outputDir, 'index'), { recursive: true });
}
if (!fs.existsSync(path.join(outputDir, 'developers'))) {
  fs.mkdirSync(path.join(outputDir, 'developers'), { recursive: true });
}

// Function to fetch JSON data from the remote URL
function fetchData(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch data. Status code: ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', (chunk) => {
        data += chunk; // Append each chunk of data
      });

      res.on('end', () => {
        try {
          resolve(JSON.parse(data)); // Parse the fetched data as JSON
        } catch (error) {
          reject(new Error(`Error parsing JSON: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`Error fetching data: ${error.message}`));
    });
  });
}

// Function to split posts into pages
function paginatePosts(posts, pageSize) {
  const paginated = [];
  for (let i = 0; i < posts.length; i += pageSize) {
    paginated.push(posts.slice(i, i + pageSize));
  }
  return paginated;
}

// Main function to process the JSON data
async function main() {
  try {
    // Fetch the JSON data
    const data = await fetchData(dataUrl);

    // Validate the input JSON
    if (!Array.isArray(data)) {
      throw new Error("The fetched data is not an array.");
    }

    const posts = data;

    if (posts.length === 0) {
      console.warn('Warning: The "posts" array is empty. No files will be generated.');
      return;
    }

    // Pagination settings
    const postsPerPage = 10; // Number of posts per page

    // Generate individual post files
    posts.forEach(post => {
      const postFilePath = path.join(outputDir, 'posts', `${post.id}.json`);

      // Create the updated metadata object for the post
      const postMetadata = {
        id: post.id,
        title: post.title,
        developers: post.developers || [], // Default to an empty array if not provided
        aliases: post.aliases || [],      // Default to an empty array if not provided
        description: post.description || null, // Default to null if not provided
        image: post.image || null         // Default to null if not provided
      };

      // Write the post metadata to its corresponding file
      fs.writeFileSync(postFilePath, JSON.stringify(postMetadata, null, 2));
    });

    // Paginate the posts
    const paginatedPosts = paginatePosts(posts, postsPerPage);

    // Generate paginated index files and pagination metadata
    const totalPages = paginatedPosts.length;

    paginatedPosts.forEach((pagePosts, pageIndex) => {
      const pageFileName = `${pageIndex + 1}.json`;
      const indexPath = path.join(outputDir, 'index', pageFileName);

      // Create the metadata object for the current page
      const pageMetadata = {
        currentPage: pageIndex + 1,
        totalPages: totalPages,
        nextPage: pageIndex + 2 <= totalPages ? `index/${pageIndex + 2}.json` : null,
        previousPage: pageIndex > 0 ? `index/${pageIndex}.json` : null,
        posts: pagePosts.map(post => ({
          id: post.id,
          title: post.title,
          image: post.image || null,
          link: `posts/${post.id}.json`
        }))
      };

      // Write the metadata for this page to its corresponding file
      fs.writeFileSync(indexPath, JSON.stringify(pageMetadata, null, 2));
    });

    // Step 1: Extract developers and map their posts
    const developersMap = {};
    posts.forEach(post => {
      if (Array.isArray(post.developers)) {
        post.developers.forEach(developer => {
          const devId = developer.id;
          if (!developersMap[devId]) {
            developersMap[devId] = {
              name: developer.name,
              id: developer.id,
              posts: []
            };
          }
          developersMap[devId].posts.push({
            id: post.id,
            title: post.title,
            image: post.image || null,
            link: `posts/${post.id}.json`
          });
        });
      }
    });

    // Step 2: Generate developer-specific pages
    const developerIds = Object.keys(developersMap);
    developerIds.forEach(devId => {
      const developer = developersMap[devId];
      const developerDir = path.join(outputDir, 'developers', devId);

      if (!fs.existsSync(developerDir)) {
        fs.mkdirSync(developerDir, { recursive: true });
      }

      // Paginate the developer's posts
      const paginatedDeveloperPosts = paginatePosts(developer.posts, postsPerPage);

      // Generate paginated files for the developer
      paginatedDeveloperPosts.forEach((pagePosts, pageIndex) => {
        const pageFileName = `${pageIndex + 1}.json`;
        const developerIndexPath = path.join(developerDir, pageFileName);

        const pageMetadata = {
          developer: {
            name: developer.name,
            id: developer.id
          },
          currentPage: pageIndex + 1,
          totalPages: paginatedDeveloperPosts.length,
          nextPage: pageIndex + 2 <= paginatedDeveloperPosts.length ? `${devId}/${pageIndex + 2}.json` : null,
          previousPage: pageIndex > 0 ? `${devId}/${pageIndex}.json` : null,
          posts: pagePosts
        };

        fs.writeFileSync(developerIndexPath, JSON.stringify(pageMetadata, null, 2));
      });
    });

    // Step 3: Generate an index of all developers with pagination
    const developersList = developerIds.map(devId => ({
      name: developersMap[devId].name,
      id: developersMap[devId].id,
      link: `developers/${devId}/1.json`
    }));

    const paginatedDevelopers = paginatePosts(developersList, postsPerPage);

    paginatedDevelopers.forEach((pageDevelopers, pageIndex) => {
      const pageFileName = `${pageIndex + 1}.json`;
      const developersIndexPath = path.join(outputDir, 'developers', pageFileName);

      const pageMetadata = {
        currentPage: pageIndex + 1,
        totalPages: paginatedDevelopers.length,
        nextPage: pageIndex + 2 <= paginatedDevelopers.length ? `developers/${pageIndex + 2}.json` : null,
        previousPage: pageIndex > 0 ? `developers/${pageIndex}.json` : null,
        developers: pageDevelopers
      };

      fs.writeFileSync(developersIndexPath, JSON.stringify(pageMetadata, null, 2));
    });

    console.log('JSON generation complete!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1); // Exit with an error code
  }
}

// Run the main function
main();
