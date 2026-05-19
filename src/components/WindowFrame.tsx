import * as React from "react"
import { Rnd } from "react-rnd"
import { useStore } from "../store"
import type { AppWindow } from "../store"
import { X, Minus, Maximize2 } from "lucide-react"
import { cn } from "../lib/utils"

interface WindowFrameProps {
  appWindow: AppWindow
  children: React.ReactNode
}

const TITLE_H = 40

export function WindowFrame({ appWindow, children }: WindowFrameProps) {
  const { closeWindow, focusWindow, updateWindowBounds, osStyle, toggleFullscreenWindow } = useStore()
  const [isDraggingOrResizing, setIsDraggingOrResizing] = React.useState(false)
  const [dimensions, setDimensions] = React.useState({
    width: window.innerWidth,
    height: window.innerHeight,
  })

  React.useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const parseValue = (val: string | number | undefined, base: number) => {
    if (val === undefined || val === null) return 0
    if (typeof val === "number") return val
    if (val.endsWith("%")) return (parseFloat(val) / 100) * base
    if (val.endsWith("rem"))
      return (
        parseFloat(val) *
        parseFloat(getComputedStyle(document.documentElement).fontSize)
      )
    return parseFloat(val)
  }

  const x = appWindow.isFullscreen ? 0 : parseValue(appWindow.bounds.x, dimensions.width)
  const y = appWindow.isFullscreen ? 0 : parseValue(appWindow.bounds.y, dimensions.height)
  const width = appWindow.isFullscreen ? dimensions.width : parseValue(appWindow.bounds.width, dimensions.width)
  const height = appWindow.isFullscreen ? dimensions.height : parseValue(appWindow.bounds.height, dimensions.height)

  const [animationState, setAnimationState] = React.useState<"closed" | "opening" | "open" | "closing">(
    appWindow.isOpen ? "open" : "closed"
  )
  const [transformStyle, setTransformStyle] = React.useState<React.CSSProperties>({
    transform: "scale(0.1)",
    opacity: 0,
    transformOrigin: "center center",
  })
  
  const isFirstMount = React.useRef(true)

  const getTransformTarget = React.useCallback(() => {
    const dockIcon = document.getElementById(`dock-icon-${appWindow.type}`)
    if (!dockIcon) {
      return {
        transform: "scale(0.1)",
        opacity: 0,
        transformOrigin: "center center",
      }
    }

    const iconRect = dockIcon.getBoundingClientRect()
    const windowLeft = x
    const windowTop = y
    const windowWidth = width
    const windowHeight = height

    const iconCenterX = iconRect.left + iconRect.width / 2
    const iconCenterY = iconRect.top + iconRect.height / 2
    const windowCenterX = windowLeft + windowWidth / 2
    const windowCenterY = windowTop + windowHeight / 2

    const translateX = iconCenterX - windowCenterX
    const translateY = iconCenterY - windowCenterY

    const scaleX = iconRect.width / windowWidth
    const scaleY = iconRect.height / windowHeight

    const skewX = Math.min(Math.max(translateX / 8, -40), 40)
    return {
      transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scaleX * 0.05}, ${scaleY * 2.8}) skewX(${skewX}deg)`,
      opacity: 0,
      transformOrigin: "center center",
    }
  }, [appWindow.type, x, y, width, height])

  React.useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      return
    }

    if (appWindow.isOpen) {
      setTransformStyle(getTransformTarget())
      setAnimationState("opening")
      const raf1 = requestAnimationFrame(() => {
        const raf2 = requestAnimationFrame(() => {
          setAnimationState("open")
        })
        return () => cancelAnimationFrame(raf2)
      })
      return () => cancelAnimationFrame(raf1)
    } else {
      setTransformStyle(getTransformTarget())
      setAnimationState("closing")
      const timer = setTimeout(() => {
        setAnimationState("closed")
      }, 600)
      return () => clearTimeout(timer)
    }
  }, [appWindow.isOpen, getTransformTarget])

  const isClosed = animationState === "closed"
  if (isClosed) return null

  return (
    <Rnd
      size={{
        width,
        height,
      }}
      position={{
        x,
        y,
      }}
      minWidth={300}
      minHeight={200}
      bounds="parent"
      dragHandleClassName="window-handle"
      disableDragging={appWindow.isFullscreen || animationState === "closing" || animationState === "opening"}
      enableResizing={(appWindow.isFullscreen || animationState === "closing" || animationState === "opening") ? false : undefined}
      onDragStart={() => setIsDraggingOrResizing(true)}
      onDragStop={(_e, d) => {
        setIsDraggingOrResizing(false)
        updateWindowBounds(appWindow.id, { x: d.x, y: d.y })
      }}
      onResizeStart={() => setIsDraggingOrResizing(true)}
      onResizeStop={(_e, _direction, ref, _delta, position) => {
        setIsDraggingOrResizing(false)
        updateWindowBounds(appWindow.id, {
          width: parseInt(ref.style.width),
          height: parseInt(ref.style.height),
          ...position,
        })
      }}
      onClick={() => focusWindow(appWindow.id)}
      style={{ zIndex: appWindow.isFullscreen ? 9999 : appWindow.zIndex }}
      className={cn(
        isDraggingOrResizing ? "transition-none" : "transition-all duration-500 ease-in-out"
      )}
    >
      {/*
        react-rnd's inner wrapper has: position:absolute, display:inline-block, top:0, left:0
        So `position:absolute; inset:0` here fills that wrapper correctly.
        We must NOT use width/height:100% — inline-block parents collapse height for % children.
      */}
      <div
        style={{
          width: "100%",
          height: "100%",
          transform: animationState === "open"
            ? "translate3d(0px, 0px, 0px) scale(1, 1)"
            : transformStyle.transform,
          opacity: animationState === "open" ? 1 : 0,
          transformOrigin: transformStyle.transformOrigin || "center center",
          transition: "transform 600ms cubic-bezier(0.25, 1, 0.2, 1), opacity 500ms cubic-bezier(0.25, 1, 0.2, 1), border-radius 600ms cubic-bezier(0.25, 1, 0.2, 1)",
        }}
        className={cn(
          "glassmorphism flex flex-col overflow-hidden bg-background shadow-2xl",
          appWindow.isFullscreen ? "rounded-none" : "rounded-2xl",
          appWindow.zIndex > 0 && !appWindow.isFullscreen ? "ring-1 shadow-primary/10 ring-primary/20" : ""
        )}
      >
        {/* Title Bar */}
        <div
          style={{ height: TITLE_H }}
          className={cn(
            "window-handle flex shrink-0 cursor-grab items-center border-b bg-muted/50 px-4 select-none active:cursor-grabbing",
            osStyle === "windows" && "flex-row-reverse"
          )}
        >
          <div
            className={cn(
              "flex space-x-2",
              osStyle === "macos" ? "mr-4" : "ml-4"
            )}
          >
            {osStyle === "macos" ? (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    closeWindow(appWindow.id)
                  }}
                  className="group flex h-3 w-3 items-center justify-center rounded-full bg-red-500 hover:bg-red-600 focus:outline-none"
                >
                  <X className="h-2 w-2 text-red-900 opacity-0 group-hover:opacity-100" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (appWindow.isFullscreen) {
                      toggleFullscreenWindow(appWindow.id)
                    } else {
                      closeWindow(appWindow.id)
                    }
                  }}
                  className="group flex h-3 w-3 items-center justify-center rounded-full bg-yellow-500 hover:bg-yellow-600 focus:outline-none"
                >
                  <Minus className="h-2 w-2 text-yellow-900 opacity-0 group-hover:opacity-100" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!appWindow.isFullscreen) {
                      toggleFullscreenWindow(appWindow.id)
                    }
                  }}
                  className="group flex h-3 w-3 items-center justify-center rounded-full bg-green-500 hover:bg-green-600 focus:outline-none"
                >
                  <Maximize2 className="h-2 w-2 text-green-900 opacity-0 group-hover:opacity-100" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (appWindow.isFullscreen) {
                      toggleFullscreenWindow(appWindow.id)
                    } else {
                      closeWindow(appWindow.id)
                    }
                  }}
                  className="rounded p-1 hover:bg-muted focus:outline-none"
                >
                  <Minus className="h-3.5 w-3.5 text-foreground/70" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!appWindow.isFullscreen) {
                      toggleFullscreenWindow(appWindow.id)
                    }
                  }}
                  className="rounded p-1 hover:bg-muted focus:outline-none"
                >
                  <Maximize2 className="h-3.5 w-3.5 text-foreground/70" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    closeWindow(appWindow.id)
                  }}
                  className="rounded p-1 transition-colors hover:bg-red-500 hover:text-white focus:outline-none"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>

          <div
            className={cn(
              "flex-1 text-sm font-semibold tracking-tight text-foreground/80",
              osStyle === "macos" ? "text-center" : "text-left"
            )}
          >
            {appWindow.title}
          </div>

          {osStyle === "macos" && <div className="w-12" />}
        </div>

        {/* Content — flex container that fills remaining space */}
        <div className="relative flex-1 overflow-hidden bg-background/95">
          {children}
        </div>
      </div>
    </Rnd>
  )
}
