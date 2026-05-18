import { Rnd } from 'react-rnd';
import { useStore } from '../store';
import type { AppWindow } from '../store';
import { X, Minus, Maximize2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface WindowFrameProps {
  appWindow: AppWindow;
  children: React.ReactNode;
}

const TITLE_H = 40;

export function WindowFrame({ appWindow, children }: WindowFrameProps) {
  const { closeWindow, focusWindow, updateWindowBounds, osStyle } = useStore();

  const parseValue = (val: string | number | undefined, base: number) => {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    if (val.endsWith('%')) return (parseFloat(val) / 100) * base;
    if (val.endsWith('rem')) return parseFloat(val) * parseFloat(getComputedStyle(document.documentElement).fontSize);
    return parseFloat(val);
  };

  const x = parseValue(appWindow.bounds.x, window.innerWidth);
  const y = parseValue(appWindow.bounds.y, window.innerHeight);
  const width = parseValue(appWindow.bounds.width, window.innerWidth);
  const height = parseValue(appWindow.bounds.height, window.innerHeight);

  if (!appWindow.isOpen) return null;

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
      onDragStop={(_e, d) => updateWindowBounds(appWindow.id, { x: d.x, y: d.y })}
      onResizeStop={(_e, _direction, ref, _delta, position) => {
        updateWindowBounds(appWindow.id, {
          width: parseInt(ref.style.width),
          height: parseInt(ref.style.height),
          ...position,
        });
      }}
      onClick={() => focusWindow(appWindow.id)}
      style={{ zIndex: appWindow.zIndex }}
      className={cn(
        "transition-shadow duration-200 rounded-2xl",
        appWindow.zIndex > 0 ? "ring-1 ring-primary/20 shadow-primary/10" : ""
      )}
    >
      {/*
        react-rnd's inner wrapper has: position:absolute, display:inline-block, top:0, left:0
        So `position:absolute; inset:0` here fills that wrapper correctly.
        We must NOT use width/height:100% — inline-block parents collapse height for % children.
      */}
      <div
        style={{ width: '100%', height: '100%' }}
        className="bg-background rounded-2xl shadow-2xl overflow-hidden glassmorphism flex flex-col"
      >
        {/* Title Bar */}
        <div
          style={{ height: TITLE_H }}
          className={cn(
            "window-handle flex items-center px-4 bg-muted/50 border-b shrink-0 select-none cursor-grab active:cursor-grabbing",
            osStyle === 'windows' && "flex-row-reverse"
          )}
        >
          <div className={cn("flex space-x-2", osStyle === 'macos' ? "mr-4" : "ml-4")}>
            {osStyle === 'macos' ? (
              <>
                <button onClick={(e) => { e.stopPropagation(); closeWindow(appWindow.id); }} className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 focus:outline-none flex items-center justify-center group">
                  <X className="w-2 h-2 text-red-900 opacity-0 group-hover:opacity-100" />
                </button>
                <button className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 focus:outline-none flex items-center justify-center group">
                  <Minus className="w-2 h-2 text-yellow-900 opacity-0 group-hover:opacity-100" />
                </button>
                <button className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 focus:outline-none flex items-center justify-center group">
                  <Maximize2 className="w-2 h-2 text-green-900 opacity-0 group-hover:opacity-100" />
                </button>
              </>
            ) : (
              <>
                <button className="p-1 hover:bg-muted rounded focus:outline-none">
                  <Minus className="w-3.5 h-3.5 text-foreground/70" />
                </button>
                <button className="p-1 hover:bg-muted rounded focus:outline-none">
                  <Maximize2 className="w-3.5 h-3.5 text-foreground/70" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); closeWindow(appWindow.id); }} className="p-1 hover:bg-red-500 hover:text-white rounded focus:outline-none transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>

          <div className={cn(
            "flex-1 text-sm font-semibold text-foreground/80 tracking-tight",
            osStyle === 'macos' ? "text-center" : "text-left"
          )}>
            {appWindow.title}
          </div>

          {osStyle === 'macos' && <div className="w-12" />}
        </div>

        {/* Content — flex container that fills remaining space */}
        <div
          className="flex-1 relative overflow-hidden bg-background/95"
        >
          {children}
        </div>
      </div>
    </Rnd>
  );
}
