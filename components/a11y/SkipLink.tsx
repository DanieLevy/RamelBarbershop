'use client'

/**
 * Skip Link Component
 * 
 * Allows keyboard users to skip directly to main content,
 * bypassing navigation and header elements.
 * 
 * The link is visually hidden until focused, then appears
 * at the top of the viewport.
 */
export function SkipLink() {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const mainContent = document.getElementById('main-content')
    if (mainContent) {
      mainContent.focus()
      mainContent.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <a
      href="#main-content"
      onClick={handleClick}
      className="skip-link"
    >
      דלג לתוכן הראשי
    </a>
  )
}
