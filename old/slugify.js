function slugify(text, maxLength = 100) {
  if (!text) return '';
  
  let slug = text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')            // Replace spaces with -
    .replace(/-+/g, '-')             // Replace multiple - with single -
    .replace(/^-+/, '')              // Trim - from start
    .replace(/-+$/, '')              // Trim - from end
    .replace(/\//g, '-')
    .replace(/[^\w\-]+/g, '');       // Remove all non-word chars except -

  // Trim to maxLength
  if (maxLength > 0 && slug.length > maxLength) {
    slug = slug.substring(0, maxLength);
    // Don't end with a hyphen
    slug = slug.replace(/-+$/, '');
  }

  return slug;
}
