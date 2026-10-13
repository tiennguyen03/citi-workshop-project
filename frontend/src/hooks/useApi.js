import { useCallback, useEffect, useState } from 'react'

/**
 * Load data for a page. Re-runs when `deps` change or `refetch()` is called.
 * @param {() => Promise<any>} fetcher  usually a services/* function wrapped in an arrow
 * @param {any[]} deps
 * @returns {{ data: any, error: Error|null, loading: boolean, refetch: () => void }}
 */
export default function useApi(fetcher, deps = []) {
  const [tick, setTick] = useState(0)
  const [result, setResult] = useState({ key: null, data: null, error: null })
  const key = `${tick}:${JSON.stringify(deps)}`

  useEffect(() => {
    let cancelled = false
    fetcher()
      .then((data) => {
        if (!cancelled) setResult({ key, data, error: null })
      })
      .catch((error) => {
        if (!cancelled) setResult({ key, data: null, error })
      })
    return () => {
      cancelled = true
    }
    // `fetcher` is intentionally excluded: callers pass inline arrows and control reloads via deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  const settled = result.key === key
  return {
    data: result.data,
    error: settled ? result.error : null,
    loading: !settled,
    refetch,
  }
}
