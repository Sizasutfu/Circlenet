// components/articles/ArticleFilters.jsx
'use client';
export default function ArticleFilters({ searchTerm, setSearchTerm, activeTag, setActiveTag, allTags }) {
  return (
    <div className="art-filters">
      <input
        type="text"
        placeholder="Search articles..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="art-search-input"
      />
      <div className="art-category-pills">
        {allTags.slice(0,6).map(tag => (
          <button
            key={tag}
            className={`art-cat-pill ${activeTag === tag ? 'active' : ''}`}
            onClick={() => setActiveTag(activeTag === tag ? '' : tag)}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}