'use client'

import { useState, useEffect, useRef } from 'react'

interface StreamingTextResult {
  displayedText: string
  isComplete: boolean
}

export function useStreamingText(fullText: string, speed = 18): StreamingTextResult {
  const [displayedText, setDisplayedText] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const indexRef = useRef(0)
  const prevTextRef = useRef('')

  useEffect(() => {
    if (fullText !== prevTextRef.current) {
      prevTextRef.current = fullText
      indexRef.current = 0
      setDisplayedText('')
      setIsComplete(false)
    }
  }, [fullText])

  useEffect(() => {
    if (isComplete) return

    const interval = setInterval(() => {
      if (indexRef.current < fullText.length) {
        indexRef.current++
        setDisplayedText(fullText.slice(0, indexRef.current))
      } else {
        setIsComplete(true)
        clearInterval(interval)
      }
    }, speed)

    return () => clearInterval(interval)
  }, [fullText, speed, isComplete])

  return { displayedText, isComplete }
}
