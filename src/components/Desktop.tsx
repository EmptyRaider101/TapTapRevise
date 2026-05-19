import React from "react"
import { useStore } from "../store"
import type { WindowType } from "../store"
import { WindowFrame } from "./WindowFrame"
import { FileManager } from "./windows/FileManager"
import { Previewer } from "./windows/Previewer"
import { NotesEditor } from "./windows/NotesEditor"
import { AIAssistant } from "./windows/AIAssistant"
import { StatsReviewer } from "./windows/StatsReviewer"
import { QuizPlayer } from "./windows/QuizPlayer"
import { Button } from "./ui/button"
import {
  FolderOpen,
  Eye,
  Edit3,
  Bot,
  BarChart3,
  Layout,
  Maximize2,
  X,
  Settings as SettingsIcon,
  PlayCircle,
} from "lucide-react"
import { cn } from "../lib/utils"

import { Settings } from "./windows/Settings"

const WindowContent: Record<WindowType, React.FC> = {
  "file-manager": FileManager,
  previewer: Previewer,
  notes: NotesEditor,
  "ai-assistant": AIAssistant,
  stats: StatsReviewer,
  settings: Settings,
  "quiz-player": QuizPlayer,
}

export function Desktop() {
  const {
    windows,
    openWindow,
    closeWindow,
    init,
    osStyle,
    setOSStyle,
    viewMode,
    setViewMode,
  } = useStore()

  React.useEffect(() => {
    init()
  }, [init])

  const hasFullscreenWindow = windows.some((w) => w.isOpen && w.isFullscreen)

  const dockItems = [
    { type: "file-manager" as WindowType, icon: FolderOpen, label: "Files" },
    { type: "previewer" as WindowType, icon: Eye, label: "Preview" },
    { type: "notes" as WindowType, icon: Edit3, label: "Notes" },
    { type: "ai-assistant" as WindowType, icon: Bot, label: "AI Assistant" },
    { type: "stats" as WindowType, icon: BarChart3, label: "Stats" },
    { type: "settings" as WindowType, icon: SettingsIcon, label: "Settings" },
    { type: "quiz-player" as WindowType, icon: PlayCircle, label: "Quizzes" },
  ]

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-slate-900/5 font-sans dark:bg-black">
      {/* Background with a subtle pattern/gradient */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-100/20 via-transparent to-transparent dark:from-blue-900/20"></div>
      <div className="bg-grid-white/[0.02] pointer-events-none absolute inset-0 bg-[size:32px_32px]"></div>

      {/* Desktop area where windows render */}
      <div
        className={cn(
          "relative z-10 flex-1 overflow-hidden",
          viewMode === "panel" && "overflow-auto p-8 pb-32"
        )}
      >
        {viewMode === "windowed" ? (
          windows.map((window) => {
            const ContentComponent = WindowContent[window.type]
            if (!ContentComponent) return null
            return (
              <WindowFrame key={window.id} appWindow={window}>
                <ContentComponent />
              </WindowFrame>
            )
          })
        ) : (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {windows
              .filter((w) => w.isOpen && WindowContent[w.type])
              .map((window) => {
                const ContentComponent = WindowContent[window.type]
                return (
                  <div
                    key={window.id}
                    className="glassmorphism flex h-full min-h-[500px] flex-col overflow-hidden rounded-2xl bg-background shadow-2xl"
                  >
                    <div className="flex items-center border-b bg-muted/50 px-6 py-4">
                      <span className="flex-1 text-sm font-bold tracking-tight text-foreground/80">
                        {window.title}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-lg transition-colors hover:bg-red-500/10 hover:text-red-500"
                        onClick={() => closeWindow(window.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="relative flex flex-1 flex-col overflow-hidden bg-background/95">
                      <ContentComponent />
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </div>

      {/* OS Style Switcher (Bottom Left) */}
      <div
        className={cn(
          "glassmorphism absolute left-6 z-50 flex items-center gap-1 rounded-2xl p-1.5 transition-all duration-500 ease-in-out",
          hasFullscreenWindow ? "-bottom-20 opacity-0 pointer-events-none" : "bottom-6"
        )}
      >
        <Button
          variant={osStyle === "macos" ? "default" : "secondary"}
          size="sm"
          className={cn(
            "h-8 rounded-xl px-4 text-xs font-bold transition-all duration-300",
            osStyle === "macos"
              ? "scale-105 shadow-lg"
              : "opacity-70 hover:opacity-100"
          )}
          onClick={() => setOSStyle("macos")}
        >
          macOS
        </Button>
        <Button
          variant={osStyle === "windows" ? "default" : "secondary"}
          size="sm"
          className={cn(
            "h-8 rounded-xl px-4 text-xs font-bold transition-all duration-300",
            osStyle === "windows"
              ? "scale-105 shadow-lg"
              : "opacity-70 hover:opacity-100"
          )}
          onClick={() => setOSStyle("windows")}
        >
          Windows
        </Button>
      </div>

      {/* View Mode Switcher (Bottom Right) */}
      <div
        className={cn(
          "glassmorphism absolute right-6 z-50 flex items-center gap-1 rounded-2xl p-1.5 transition-all duration-500 ease-in-out",
          hasFullscreenWindow ? "-bottom-20 opacity-0 pointer-events-none" : "bottom-6"
        )}
      >
        <Button
          variant={viewMode === "windowed" ? "default" : "secondary"}
          size="sm"
          className={cn(
            "flex h-8 items-center gap-2 rounded-xl px-4 text-xs font-bold transition-all duration-300",
            viewMode === "windowed"
              ? "scale-105 shadow-lg"
              : "opacity-70 hover:opacity-100"
          )}
          onClick={() => setViewMode("windowed")}
        >
          <Maximize2 className="h-3 w-3" />
          Windowed
        </Button>
        <Button
          variant={viewMode === "panel" ? "default" : "secondary"}
          size="sm"
          className={cn(
            "flex h-8 items-center gap-2 rounded-xl px-4 text-xs font-bold transition-all duration-300",
            viewMode === "panel"
              ? "scale-105 shadow-lg"
              : "opacity-70 hover:opacity-100"
          )}
          onClick={() => setViewMode("panel")}
        >
          <Layout className="h-3 w-3" />
          Panel
        </Button>
      </div>

      {/* Dock */}
      <div
        className={cn(
          "absolute left-1/2 z-50 -translate-x-1/2 transition-all duration-500 ease-in-out",
          hasFullscreenWindow ? "-bottom-24 opacity-0 pointer-events-none" : "bottom-6"
        )}
      >
        <div className="glassmorphism flex items-center space-x-2 rounded-2xl border border-white/20 bg-white/40 px-4 py-3 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-black/40">
          {dockItems.map((item) => (
            <Button
              key={item.type}
              id={`dock-icon-${item.type}`}
              variant="ghost"
              size="icon"
              className="group relative h-12 w-12 rounded-xl transition-all hover:scale-110 hover:bg-white/50 dark:hover:bg-white/10"
              onClick={() => {
                const existing = windows.find((w) => w.type === item.type)
                if (existing && existing.isOpen) {
                  closeWindow(existing.id)
                } else {
                  openWindow(item.type)
                }
              }}
            >
              <item.icon className="h-6 w-6 text-slate-700 dark:text-slate-200" />

              {/* Tooltip */}
              <span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 rounded bg-black/80 px-2 py-1 text-xs whitespace-nowrap text-white opacity-0 transition-opacity group-hover:opacity-100">
                {item.label}
              </span>

              {/* Indicator if open */}
              {windows.find((w) => w.type === item.type && w.isOpen) && (
                <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary"></span>
              )}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
