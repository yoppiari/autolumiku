interface CatalogStatsProps {
  stats: {
    makes: string[];
    models: string[];
    years: number[];
    priceRange: { min: number; max: number };
  };
}

export function CatalogStats({ stats }: CatalogStatsProps) {
  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const yearRange = stats.years.length > 0
    ? `${Math.min(...stats.years)} - ${Math.max(...stats.years)}`
    : 'N/A';

  return (
    <div className="mb-8 bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Catalog Overview</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.makes.length}</div>
          <div className="text-sm text-gray-600">Brands</div>
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.models.length}</div>
          <div className="text-sm text-gray-600">Models</div>
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{yearRange}</div>
          <div className="text-sm text-gray-600">Year Range</div>
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {formatPrice(stats.priceRange.min)}
          </div>
          <div className="text-xs text-gray-600">Starting from</div>
        </div>
      </div>
    </div>
  );
}