'use client'
import { Filters } from '../../lib/filters'

interface FiltersProps {
  value: Filters
  onChange: (f: Filters) => void
  categories: string[]
}

export default function FiltersComponent({ value, onChange, categories }: FiltersProps) {
  const handleCategoryChange = (category: string, checked: boolean) => {
    const newCategories = checked
      ? [...value.category, category]
      : value.category.filter(c => c !== category)
    
    onChange({
      ...value,
      category: newCategories
    })
  }

  const handleUpdatedSinceChange = (updatedSince: string) => {
    onChange({
      ...value,
      updatedSince: updatedSince || undefined
    })
  }

  const handleAvailabilityChange = (availability: "any"|"cached"|"online") => {
    onChange({
      ...value,
      availability
    })
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-200">Filters</h3>
        <button 
          onClick={() => onChange({ category: [], updatedSince: undefined, availability: "any" })}
          className="text-xs text-neutral-400 hover:text-neutral-200 px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Categories */}
      {categories.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-neutral-300 mb-2">Categories</label>
          <div className="space-y-2">
            {categories.map(category => (
              <label key={category} className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={value.category.includes(category)}
                  onChange={(e) => handleCategoryChange(category, e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-neutral-800 border-neutral-700 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="text-neutral-200">{category}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Updated Since */}
      <div>
        <label className="block text-xs font-medium text-neutral-300 mb-2">Updated Since</label>
        <input
          type="date"
          value={value.updatedSince || ''}
          onChange={(e) => handleUpdatedSinceChange(e.target.value)}
          className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Availability */}
      <div>
        <label className="block text-xs font-medium text-neutral-300 mb-2">Availability</label>
        <select
          value={value.availability || 'any'}
          onChange={(e) => handleAvailabilityChange(e.target.value as "any"|"cached"|"online")}
          className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="any">Any</option>
          <option value="cached">Cached Only</option>
          <option value="online">Online Only</option>
        </select>
      </div>
    </div>
  )
}
