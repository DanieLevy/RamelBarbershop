'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface PortalProps {
  children: ReactNode
  /** Optional container ID. Defaults to 'portal-root' which is added to document.body */
  containerId?: string
}

/**
 * Portal Component
 * 
 * Renders children at the document root level using React Portal.
 * This ensures modals and overlays are positioned correctly relative to the viewport,
 * not inside scrollable containers that could affect `position: fixed` behavior.
 * 
 * Usage:
 * <Portal>
 *   <div className="fixed inset-0 ...">Modal content</div>
 * </Portal>
 */
export function Portal({ children, containerId = 'portal-root' }: PortalProps) {
  const [mounted, setMounted] = useState(false)
  const [container, setContainer] = useState<HTMLElement | null>(null)

  useEffect(() => {
    // Find or create the portal container
    let portalRoot = document.getElementById(containerId)
    
    if (!portalRoot) {
      portalRoot = document.createElement('div')
      portalRoot.id = containerId
      // Ensure portal root doesn't interfere with layout
      portalRoot.style.cssText = 'position: fixed; top: 0; left: 0; z-index: 9999; pointer-events: none;'
      document.body.appendChild(portalRoot)
    }
    
    setContainer(portalRoot)
    setMounted(true)

    return () => {
      // Cleanup: only remove if we created it and it's empty
      const root = document.getElementById(containerId)
      if (root && root.childNodes.length === 0) {
        root.remove()
      }
    }
  }, [containerId])

  if (!mounted || !container) {
    return null
  }

  return createPortal(
    <div style={{ pointerEvents: 'auto' }}>{children}</div>,
    container
  )
}

export default Portal
