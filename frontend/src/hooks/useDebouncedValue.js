import { useEffect, useState } from 'react'

/** `value`, but only once it has stopped changing for `delay` ms — for search boxes that query the server. */
export default function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
