// components/articles/ArticleFilters.jsx
'use client';

export default function ArticleFilters({ searchTerm, setSearchTerm, activeTag, setActiveTag, allTags }) {
  return (
    <div className="mb-6">
      <input
        type="text"
        placeholder="Search articles..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full px-4 py-3 bg-surface border border-border rounded-radius-sm text-txt text-sm font-body outline-none focus:border-accent transition-colors"
      />
      <div className="flex gap-2 flex-wrap mt-3">
        {allTags.slice(0, 6).map(tag => (
          <button
            key={tag}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold border border-border transition-all ${
              activeTag === tag
                ? 'bg-accent border-accent text-white'
                : 'bg-surface text-txt2 hover:border-accent hover:text-accent'
            }`}
            onClick={() => setActiveTag(activeTag === tag ? '' : tag)}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}