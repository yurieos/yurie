import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Track if component has mounted to avoid hydration mismatches
  const [hasMounted, setHasMounted] = React.useState(false)
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    // Mark as mounted first
    setHasMounted(true)
    
    // Check mobile status
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    
    // Initial check
    checkMobile()
    
    // Listen for changes
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    mql.addEventListener("change", checkMobile)
    
    return () => mql.removeEventListener("change", checkMobile)
  }, [])

  // Always return false during SSR and initial hydration to match server render
  // After hydration, return the actual mobile status
  return hasMounted ? isMobile : false
}
