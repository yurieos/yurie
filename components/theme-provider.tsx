"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"

// Theme colors must match --background in globals.css
const THEME_COLORS = {
  light: '#f5f5f5',
  dark: '#0a0a0a',
} as const

// Component to sync theme-color meta tag with current theme
function ThemeColorSync() {
  const { resolvedTheme } = useTheme()
  
  React.useEffect(() => {
    // Skip if theme not yet resolved (SSR/initial hydration)
    if (!resolvedTheme) return
    
    const themeColor = resolvedTheme === 'dark' ? THEME_COLORS.dark : THEME_COLORS.light
    
    // Update or create the theme-color meta tag
    let metaTag = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
    
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
