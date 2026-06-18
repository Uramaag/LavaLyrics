import { useEffect, useRef } from 'react'

/**
 * Polls a job status endpoint at the given interval.
 * @param {string|null} jobId
 * @param {function} onUpdate - called with (statusData)
 * @param {number} intervalMs
 */
export function usePolling(jobId, onUpdate, intervalMs = 1500) {
  const timerRef = useRef(null)
  const activeRef = useRef(true)

  useEffect(() => {
    if (!jobId) return
    activeRef.current = true

    const poll = async () => {
      if (!activeRef.current) return
      try {
        const res = await fetch(`/api/status/${jobId}`)
        const data = await res.json()
        onUpdate(data)
        if (data.status !== 'completed' && data.status !== 'error') {
          timerRef.current = setTimeout(poll, intervalMs)
        }
      } catch {
        timerRef.current = setTimeout(poll, intervalMs)
      }
    }

    poll()

    return () => {
      activeRef.current = false
      clearTimeout(timerRef.current)
    }
  }, [jobId]) // eslint-disable-line
}
