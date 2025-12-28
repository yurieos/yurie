"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"

// Component to sync theme-color meta tag with current theme
function ThemeColorSync() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  
  React.useEffect(() => {
    setMounted(true)
  }, [])
  
  React.useEffect(() => {
    // Wait for mount and theme to be resolved
    if (!mounted || !resolvedTheme) return
    
    // Read the actual background color from CSS variables
    const root = document.documentElement
    const computedStyle = getComputedStyle(root)
    const bgColor = computedStyle.getPropertyValue('--background').trim()
    
    // Convert CSS color to hex if needed, or use fallback
    let themeColor: string
    if (bgColor) {
      // Create a temporary element to get the computed color
      const temp = document.createElement('div')
      temp.style.backgroundColor = `var(--background)`
      temp.style.display = 'none'
      document.body.appendChild(temp)
      const computedBg = getComputedStyle(temp).backgroundColor
      document.body.removeChild(temp)
      
      // Convert rgb to hex
      const rgbMatch = computedBg.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/)
      if (rgbMatch) {
        const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0')
        const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0')
        const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0')
        themeColor = `#${r}${g}${b}`
      } else {
        // Fallback
        themeColor = resolvedTheme === 'dark' ? '#0a0a0a' : '#f5f5f5'
      }
    } else {
      themeColor = resolvedTheme === 'dark' ? '#0a0a0a' : '#f5f5f5'
    }
    
    // Remove all existing theme-color meta tags
    const existingTags = document.querySelectorAll('meta[name="theme-color"]')
    existingTags.forEach(tag => tag.remove())
    
    // Create a single theme-color meta tag
    const metaTag = document.createElement('meta')
    metaTag.setAttribute('name', 'theme-color')
    metaTag.setAttribute('content', themeColor)
    document.head.appendChild(metaTag)
  }, [mounted, resolvedTheme])
  
  return null
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props}>
      <ThemeColorSync />
      {children}
    </NextThemesProvider>
  )
}
