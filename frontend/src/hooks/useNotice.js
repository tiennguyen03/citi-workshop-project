import { useCallback, useState } from 'react'

/** Page-level success/error toast state. Render with <NoticeSnackbar notice={notice} onClose={clear} />. */
export default function useNotice() {
  const [notice, setNotice] = useState(null)
  const notify = useCallback((message, severity = 'success') => setNotice({ message, severity, key: Date.now() }), [])
  const clear = useCallback(() => setNotice(null), [])
  return { notice, notify, clear }
}
