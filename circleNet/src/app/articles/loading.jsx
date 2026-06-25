// src/app/loading.jsx
export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-6 py-6 border-b border-border animate-pulse">
            {/* Image placeholder */}
            <div className="w-[180px] h-[120px] bg-border rounded-radius-sm flex-shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="h-6 bg-border rounded w-3/4" />
              <div className="h-4 bg-border rounded w-full" />
              <div className="h-4 bg-border rounded w-5/6" />
              <div className="flex gap-4 pt-2">
                <div className="h-8 w-8 bg-border rounded-full" />
                <div className="h-4 bg-border rounded w-24" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}