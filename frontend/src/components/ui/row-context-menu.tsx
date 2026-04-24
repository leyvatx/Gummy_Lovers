import {
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/lib/utils'

export type RowContextMenuTarget = {
  id: string
  x: number
  y: number
} | null

type RowContextMenuItem = {
  label: string
  icon?: ReactNode
  destructive?: boolean
  onSelect: () => void
}

type RowContextMenuProps = {
  target: RowContextMenuTarget
  rowId: string
  items: RowContextMenuItem[]
  onClose: () => void
}

const menuWidth = 184
const menuOffset = 8
const longPressDelay = 520

export function useRowContextMenu() {
  const [target, setTarget] = useState<RowContextMenuTarget>(null)
  const touchTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)

  const clearTouchTimer = useCallback(() => {
    if (touchTimerRef.current) {
      window.clearTimeout(touchTimerRef.current)
      touchTimerRef.current = null
    }
  }, [])

  const close = useCallback(() => {
    clearTouchTimer()
    setTarget(null)
  }, [clearTouchTimer])

  const getTargetProps = useCallback(
    (id: string) => ({
      onContextMenu: (event: ReactMouseEvent) => {
        event.preventDefault()
        setTarget({ id, x: event.clientX, y: event.clientY })
      },
      onTouchStart: (event: ReactTouchEvent) => {
        clearTouchTimer()
        const touch = event.touches[0]

        if (!touch) {
          return
        }

        touchTimerRef.current = window.setTimeout(() => {
          setTarget({ id, x: touch.clientX, y: touch.clientY })
        }, longPressDelay)
      },
      onTouchMove: clearTouchTimer,
      onTouchEnd: clearTouchTimer,
      onTouchCancel: clearTouchTimer,
    }),
    [clearTouchTimer],
  )

  return { close, getTargetProps, target }
}

export function RowContextMenu({ target, rowId, items, onClose }: RowContextMenuProps) {
  useEffect(() => {
    if (!target || target.id !== rowId) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('click', onClose)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', onClose)
    window.addEventListener('scroll', onClose, true)

    return () => {
      window.removeEventListener('click', onClose)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [onClose, rowId, target])

  if (!target || target.id !== rowId || typeof document === 'undefined') {
    return null
  }

  const left = Math.max(menuOffset, Math.min(target.x, window.innerWidth - menuWidth - menuOffset))
  const top = Math.max(menuOffset, Math.min(target.y, window.innerHeight - items.length * 44 - menuOffset))

  return createPortal(
    <div
      role="menu"
      className="fixed z-50 grid w-[184px] gap-1 rounded-2xl border bg-popover p-1.5 text-sm text-popover-foreground shadow-xl"
      style={{ left, top }}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className={cn(
            'flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left font-medium outline-none transition-colors hover:bg-accent focus-visible:bg-accent',
            item.destructive && 'text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10',
          )}
          onClick={() => {
            onClose()
            item.onSelect()
          }}
        >
          {item.icon ? <span className="grid size-4 shrink-0 place-items-center">{item.icon}</span> : null}
          <span className="truncate">{item.label}</span>
        </button>
      ))}
    </div>,
    document.body,
  )
}
