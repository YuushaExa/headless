package main

import (
    "encoding/json"
    "fmt"
    "io/ioutil"
    "net/http"
    "os"
    "path/filepath"
)

// Constants
const (
    DATA_URL       = "https://raw.githubusercontent.com/YuushaExa/testapi/refs/heads/main/merged.json"
    OUTPUT_DIR     = "./public"
    POSTS_PER_PAGE = 10
)

// Track total number of generated files
var totalFilesGenerated int

// Utility function to write JSON files with consistent formatting
func writeJsonFile(filePath string, data interface{}) error {
    jsonData, err := json.MarshalIndent(data, "", "  ")
    if err != nil {
        return err
    }
    err = os.MkdirAll(filepath.Dir(filePath), os.ModePerm)
    if err != nil {
        return err
    }
    return ioutil.WriteFile(filePath, jsonData, 0644)
}

// Fetch JSON data from a URL
func fetchData(url string) ([]map[string]interface{}, error) {
    resp, err := http.Get(url)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    if resp.StatusCode != 200 {
        return nil, fmt.Errorf("failed to fetch data. Status code: %d", resp.StatusCode)
    }

    body, err := ioutil.ReadAll(resp.Body)
    if err != nil {
        return nil, err
    }

    var data []map[string]interface{}
    err = json.Unmarshal(body, &data)
    if err != nil {
        return nil, err
    }

    return data, nil
}

// Paginate items into chunks
func paginateItems(items []map[string]interface{}, pageSize int) [][]map[string]interface{} {
    pages := make([][]map[string]interface{}, 0, (len(items)+pageSize-1)/pageSize)
    for i := 0; i < len(items); i += pageSize {
        end := i + pageSize
        if end > len(items) {
            end = len(items)
        }
        pages = append(pages, items[i:end])
    }
    return pages
}

// Generate pagination links
func generatePaginationLinks(currentPage, totalPages int, basePath string) map[string]interface{} {
    pagination := map[string]interface{}{
        "currentPage": currentPage,
        "totalPages":  totalPages,
    }

    if currentPage < totalPages {
        if currentPage == 1 {
            pagination["nextPage"] = fmt.Sprintf("%s/page/2.json", basePath)
        } else {
            pagination["nextPage"] = fmt.Sprintf("%s/page/%d.json", basePath, currentPage+1)
        }
    } else {
        pagination["nextPage"] = nil
    }

    if currentPage > 1 {
        if currentPage == 2 {
            pagination["previousPage"] = "index.json"
        } else {
            pagination["previousPage"] = fmt.Sprintf("%s/page/%d.json", basePath, currentPage-1)
        }
    } else {
        pagination["previousPage"] = nil
    }

    return pagination
}

// Extract related entities (e.g., developers, publishers)
func extractRelatedEntities(items []map[string]interface{}, entityKey, idKey string, linkGenerator func(map[string]interface{}) string) []map[string]interface{} {
    entityMap := make(map[string]map[string]interface{})

    for _, item := range items {
        entities, ok := item[entityKey].([]interface{})
        if !ok {
            continue
        }

        for _, rawEntity := range entities {
            entity, ok := rawEntity.(map[string]interface{})
            if !ok {
                continue
            }

            id := fmt.Sprintf("%v", entity[idKey])
            if _, exists := entityMap[id]; !exists {
                entityMap[id] = map[string]interface{}{
                    "id":    id,
                    "name":  entity["name"],
                    "items": []map[string]interface{}{},
                }
            }

            entityMap[id]["items"] = append(entityMap[id]["items"].([]map[string]interface{}), map[string]interface{}{
                "id":    item["id"],
                "title": item["title"],
                "image": item["image"],
                "link":  linkGenerator(item),
            })
        }
    }

    result := make([]map[string]interface{}, 0, len(entityMap))
    for _, entity := range entityMap {
        result = append(result, entity)
    }
    return result
}

// Generate paginated files for a given type
func generatePaginatedFiles(items []map[string]interface{}, pageSize int, basePath string, itemMapper func(map[string]interface{}) interface{}, pageMapper func([]map[string]interface{}, int, int) interface{}) error {
    baseDir := filepath.Join(OUTPUT_DIR, basePath)

    // Generate individual item files
    for i, item := range items {
        filePath := filepath.Join(baseDir, fmt.Sprintf("%v.json", item["id"]))
        err := writeJsonFile(filePath, itemMapper(item))
        if err != nil {
            return err
        }

        totalFilesGenerated++
        if i < 3 {
            fmt.Printf("Generated item file: %s\n", filePath)
        }
    }

    // Paginate items and generate index files
    paginatedItems := paginateItems(items, pageSize)
    for i, page := range paginatedItems {
        pageNumber := i + 1
        var filePath string
        if pageNumber == 1 {
            filePath = filepath.Join(baseDir, "index.json")
        } else {
            filePath = filepath.Join(baseDir, "page", fmt.Sprintf("%d.json", pageNumber))
        }

        err := writeJsonFile(filePath, pageMapper(page, pageNumber, len(paginatedItems)))
        if err != nil {
            return err
        }

        totalFilesGenerated++
        if i < 3 {
            fmt.Printf("Generated paginated file: %s\n", filePath)
        }
    }

    return nil
}

// Main function
func main() {
    defer func() {
        fmt.Printf("Generated %d files in total.\n", totalFilesGenerated)
    }()

    data, err := fetchData(DATA_URL)
    if err != nil {
        fmt.Println("Error:", err)
        return
    }

    if len(data) == 0 {
        fmt.Println("Warning: No data found. Exiting.")
        return
    }

    // Generate paginated files for posts
    postLinkGenerator := func(post map[string]interface{}) string {
        return fmt.Sprintf("vn/posts/%v.json", post["id"])
    }

    err = generatePaginatedFiles(data, POSTS_PER_PAGE, "vn/posts",
        func(post map[string]interface{}) interface{} {
            return map[string]interface{}{
                "id":          post["id"],
                "title":       post["title"],
                "developers":  extractDevelopers(post, postLinkGenerator),
                "aliases":     post["aliases"],
                "description": post["description"],
                "image":       post["image"],
                "link":        postLinkGenerator(post),
            }
        },
        func(pagePosts []map[string]interface{}, currentPage, totalPages int) interface{} {
            return map[string]interface{}{
                "posts":      formatPosts(pagePosts, postLinkGenerator),
                "pagination": generatePaginationLinks(currentPage, totalPages, "vn"),
            }
        },
    )
    if err != nil {
        fmt.Println("Error generating post files:", err)
        return
    }

    // Generate paginated files for developers
    developerLinkGenerator := func(post map[string]interface{}) string {
        return fmt.Sprintf("vn/posts/%v.json", post["id"])
    }

    developers := extractRelatedEntities(data, "developers", "id", developerLinkGenerator)

    err = generatePaginatedFiles(developers, POSTS_PER_PAGE, "vn/developers",
        func(developer map[string]interface{}) interface{} {
            return map[string]interface{}{
                "name":  developer["name"],
                "id":    developer["id"],
                "posts": developer["items"],
                "link":  fmt.Sprintf("vn/developers/%v.json", developer["id"]),
            }
        },
        func(pageDevelopers []map[string]interface{}, currentPage, totalPages int) interface{} {
            return map[string]interface{}{
                "developers": formatDevelopers(pageDevelopers),
                "pagination": generatePaginationLinks(currentPage, totalPages, "vn/developers"),
            }
        },
    )
    if err != nil {
        fmt.Println("Error generating developer files:", err)
        return
    }
}

// Helper functions
func extractDevelopers(post map[string]interface{}, linkGenerator func(map[string]interface{}) string) []map[string]interface{} {
    developersRaw, ok := post["developers"].([]interface{})
    if !ok {
        return nil
    }

    var developers []map[string]interface{}
    for _, rawDev := range developersRaw {
        dev, ok := rawDev.(map[string]interface{})
        if !ok {
            continue
        }
        developers = append(developers, map[string]interface{}{
            "name": dev["name"],
            "id":   dev["id"],
            "link": fmt.Sprintf("vn/developers/%v.json", dev["id"]),
        })
    }
    return developers
}

func formatPosts(posts []map[string]interface{}, linkGenerator func(map[string]interface{}) string) []map[string]interface{} {
    var formattedPosts []map[string]interface{}
    for _, post := range posts {
        formattedPosts = append(formattedPosts, map[string]interface{}{
            "id":    post["id"],
            "title": post["title"],
            "image": post["image"],
            "link":  linkGenerator(post),
        })
    }
    return formattedPosts
}

func formatDevelopers(developers []map[string]interface{}) []map[string]interface{} {
    var formattedDevs []map[string]interface{}
    for _, dev := range developers {
        formattedDevs = append(formattedDevs, map[string]interface{}{
            "name": dev["name"],
            "id":   dev["id"],
            "link": fmt.Sprintf("vn/developers/%v.json", dev["id"]),
        })
    }
    return formattedDevs
}
