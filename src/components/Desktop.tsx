import React from 'react';
import { useStore } from '../store';
import type { WindowType } from '../store';
import { WindowFrame } from './WindowFrame';
import { FileManager } from './windows/FileManager';
import { Previewer } from './windows/Previewer';
import { NotesEditor } from './windows/NotesEditor';
import { AIAssistant } from './windows/AIAssistant';
import { StatsReviewer } from './windows/StatsReviewer';
import { Button } from './ui/button';
import { FolderOpen, Eye, Edit3, Bot, BarChart3, Layout, Maximize2, X, Settings as SettingsIcon } from 'lucide-react';
import { cn } from '../lib/utils';

import { Settings } from './windows/Settings';

const WindowContent: Record<WindowType, React.FC> = {
  'file-manager': FileManager,
  'previewer': Previewer,
  'notes': NotesEditor,
  'ai-assistant': AIAssistant,
  'stats': StatsReviewer,
  'settings': Settings,
};

export function Desktop() {
  const { windows, openWindow, closeWindow, init, osStyle, setOSStyle, viewMode, setViewMode } = useStore();

  React.useEffect(() => {
    init();
  }, [init]);

  const dockItems = [
    { type: 'file-manager' as WindowType, icon: FolderOpen, label: 'Files' },
    { type: 'previewer' as WindowType, icon: Eye, label: 'Preview' },
    { type: 'notes' as WindowType, icon: Edit3, label: 'Notes' },
    { type: 'ai-assistant' as WindowType, icon: Bot, label: 'AI Assistant' },
    { type: 'stats' as WindowType, icon: BarChart3, label: 'Stats' },
    { type: 'settings' as WindowType, icon: SettingsIcon, label: 'Settings' },
  ];

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-900/5 dark:bg-black font-sans flex flex-col">
      {/* Background with a subtle pattern/gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-100/20 via-transparent to-transparent dark:from-blue-900/20 pointer-events-none"></div>
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px_32px] pointer-events-none"></div>
      
      {/* Desktop area where windows render */}
      <div className={cn(
        "flex-1 relative z-10 overflow-hidden",
        viewMode === 'panel' && "p-8 pb-32 overflow-auto"
      )}>
        {viewMode === 'windowed' ? (
          windows.map(window => {
            const ContentComponent = WindowContent[window.type];
            return (
              <WindowFrame key={window.id} appWindow={window}>
                <ContentComponent />
              </WindowFrame>
            );
          })
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {windows.filter(w => w.isOpen).map(window => {
              const ContentComponent = WindowContent[window.type];
              return (
                <div 
                  key={window.id} 
                  className="flex flex-col bg-background rounded-2xl shadow-2xl overflow-hidden glassmorphism min-h-[500px] h-full"
                >
                  <div className="flex items-center px-6 py-4 bg-muted/50 border-b">
                    <span className="flex-1 text-sm font-bold tracking-tight text-foreground/80">{window.title}</span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors"
                      onClick={() => closeWindow(window.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex-1 flex flex-col overflow-hidden relative bg-background/95">
                    <ContentComponent />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* OS Style Switcher (Bottom Left) */}
      <div className="absolute bottom-6 left-6 z-50 flex items-center p-1.5 glassmorphism rounded-2xl gap-1">
        <Button
          variant={osStyle === 'macos' ? 'default' : 'secondary'}
          size="sm"
          className={cn(
            "h-8 px-4 rounded-xl text-xs font-bold transition-all duration-300",
            osStyle === 'macos' ? "shadow-lg scale-105" : "opacity-70 hover:opacity-100"
          )}
          onClick={() => setOSStyle('macos')}
        >
          macOS
        </Button>
        <Button
          variant={osStyle === 'windows' ? 'default' : 'secondary'}
          size="sm"
          className={cn(
            "h-8 px-4 rounded-xl text-xs font-bold transition-all duration-300",
            osStyle === 'windows' ? "shadow-lg scale-105" : "opacity-70 hover:opacity-100"
          )}
          onClick={() => setOSStyle('windows')}
        >
          Windows
        </Button>
      </div>

      {/* View Mode Switcher (Bottom Right) */}
      <div className="absolute bottom-6 right-6 z-50 flex items-center p-1.5 glassmorphism rounded-2xl gap-1">
        <Button
          variant={viewMode === 'windowed' ? 'default' : 'secondary'}
          size="sm"
          className={cn(
            "h-8 px-4 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-2",
            viewMode === 'windowed' ? "shadow-lg scale-105" : "opacity-70 hover:opacity-100"
          )}
          onClick={() => setViewMode('windowed')}
        >
          <Maximize2 className="w-3 h-3" />
          Windowed
        </Button>
        <Button
          variant={viewMode === 'panel' ? 'default' : 'secondary'}
          size="sm"
          className={cn(
            "h-8 px-4 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-2",
            viewMode === 'panel' ? "shadow-lg scale-105" : "opacity-70 hover:opacity-100"
          )}
          onClick={() => setViewMode('panel')}
        >
          <Layout className="w-3 h-3" />
          Panel
        </Button>
      </div>

      {/* Dock */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center space-x-2 px-4 py-3 rounded-2xl glassmorphism bg-white/40 dark:bg-black/40 border border-white/20 dark:border-white/10 shadow-2xl backdrop-blur-xl">
          {dockItems.map(item => (
            <Button
              key={item.type}
              variant="ghost"
              size="icon"
              className="w-12 h-12 rounded-xl hover:bg-white/50 dark:hover:bg-white/10 transition-all hover:scale-110 relative group"
              onClick={() => openWindow(item.type)}
            >
              <item.icon className="w-6 h-6 text-slate-700 dark:text-slate-200" />
              
              {/* Tooltip */}
              <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                {item.label}
              </span>
              
              {/* Indicator if open */}
              {windows.find(w => w.type === item.type && w.isOpen) && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full"></span>
              )}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
