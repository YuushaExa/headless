module.exports = {
    slugify: (text) => {
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
};
