export function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Image Skeleton */}
          <div className="aspect-[16/12] bg-gray-200 animate-pulse"></div>

          {/* Content Skeleton */}
          <div className="p-4">
            <div className="h-6 bg-gray-200 rounded-md animate-pulse mb-2"></div>
            <div className="h-4 bg-gray-200 rounded-md animate-pulse mb-3 w-3/4"></div>

            {/* Price Skeleton */}
            <div className="h-8 bg-gray-200 rounded-md animate-pulse mb-4 w-1/2"></div>

            {/* Specs Skeleton */}
            <div className="grid grid-cols-2 gap-2">
              <div className="h-4 bg-gray-200 rounded-md animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded-md animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded-md animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded-md animate-pulse"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}