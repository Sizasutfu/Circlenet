// components/articles/Pagination.jsx
'use client';

export default function Pagination({ page, totalPages, setPage }) {
  return (
    <div className="flex justify-center items-center gap-4 mt-10">
      <button
        disabled={page <= 1}
        onClick={() => setPage(p => p - 1)}
        className="bg-card border border-border rounded-radius-sm px-5 py-2 text-sm font-semibold text-txt2 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:border-accent hover:enabled:text-accent hover:enabled:bg-accent-bg"
      >
        Previous
      </button>
      <span className="text-sm text-txt2">Page {page} of {totalPages}</span>
      <button
        disabled={page >= totalPages}
        onClick={() => setPage(p => p + 1)}
        className="bg-card border border-border rounded-radius-sm px-5 py-2 text-sm font-semibold text-txt2 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:border-accent hover:enabled:text-accent hover:enabled:bg-accent-bg"
      >
        Next
      </button>
    </div>
  );
}