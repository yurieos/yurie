"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"

// Component to sync theme-color meta tag with current theme
function ThemeColorSync() {
  const { resolvedTheme } = useTheme()
  
  React.useEffect(() => {
    const themeColor = resolvedTheme === 'dark' ? '#0a0a0a' : '#f5f5f5'
    
    // Update existing theme-color meta tag or create one
    let metaTag = document.querySelector('meta[name="theme-color"]')
    if (metaTag) {
      metaTag.setAttribute('content', themeColor)
    } else {
      metaTag = document.createElement('meta')
      metaTag.setAttribute('name', 'theme-color')
      metaTag.setAttribute('content', themeColor)
      document.head.appendChild(metaTag)
    }
  }, [resolvedTheme])
  
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
