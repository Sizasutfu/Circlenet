// components/articles/Pagination.jsx
'use client';
export default function Pagination({ page, totalPages, setPage }) {
  return (
    <div className="art-pagination">
      <button disabled={page <= 1} onClick={() => setPage(p => p-1)}>Previous</button>
      <span>Page {page} of {totalPages}</span>
      <button disabled={page >= totalPages} onClick={() => setPage(p => p+1)}>Next</button>
    </div>
  );
}