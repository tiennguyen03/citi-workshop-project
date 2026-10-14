import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * List filters mirrored in the query string, so a filtered view can be linked to
 * (e.g. `/users?available=true`). Values equal to their default are dropped from the URL.
 * @param {Record<string, string>} defaults  every filter key with its default value (a module-level constant, so its identity is stable)
 * @returns {{ filters: Record<string, string>, setFilter: (key: string, value: string) => void, isFiltered: boolean }}
 */
export default function useUrlFilters(defaults) {
  const [params, setParams] = useSearchParams()
  const filters = {}
  for (const key of Object.keys(defaults)) filters[key] = params.get(key) ?? defaults[key]
  const isFiltered = Object.keys(defaults).some((key) => filters[key] !== defaults[key])

  const setFilter = useCallback(
    (key, value) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (value === '' || value === null || value === undefined || value === defaults[key]) next.delete(key)
          else next.set(key, String(value))
          return next
        },
        { replace: true },
      ),
    [setParams, defaults],
  )

  return { filters, setFilter, isFiltered }
}
