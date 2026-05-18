import { useState } from 'react';
import { useStore } from '../../store';
import { Settings as SettingsIcon, Sparkles, RefreshCw, Shield, Info, ExternalLink } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';

export function Settings() {
  const { 
    geminiApiKey, setGeminiApiKey, 
    latestVersion, updateUrl, checkUpdates, triggerUpdate 
  } = useStore();
  
  const [apiKeyInput, setApiKeyInput] = useState(geminiApiKey || '');
  const [isChecking, setIsChecking] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleCheckUpdates = async () => {
    setIsChecking(true);
    await checkUpdates();
    setIsChecking(false);
  };

  const handleTriggerUpdate = async () => {
    setIsUpdating(true);
    await triggerUpdate();
    setIsUpdating(false);
  };

  const currentVersion = "v0.0.1"; // Hardcoded for now, should ideally come from package.json or env

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <div className="flex items-center px-4 py-2 border-b bg-muted/30">
        <SettingsIcon className="w-4 h-4 mr-2 text-muted-foreground" />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">App Settings</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {/* AI Configuration */}
        <section className="space-y-3">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold">AI Configuration</h3>
          </div>
          <div className="bg-muted/30 p-4 rounded-lg border space-y-4">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase font-bold">Google Gemini API Key</label>
              <div className="flex space-x-2 mt-1">
                <Input 
                  type="password"
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  placeholder="Paste your API key here..."
                  className="h-9 text-xs bg-background"
                />
                <Button 
                  size="sm" 
                  className="h-9 text-xs"
                  onClick={async () => {
                    await setGeminiApiKey(apiKeyInput);
                  }}
                >
                  Save Key
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                This key is used for document analysis and the AI Assistant. It is stored securely in your local database.
              </p>
            </div>
          </div>
        </section>

        <Separator />

        {/* Updates Tracker */}
        <section className="space-y-3">
          <div className="flex items-center space-x-2">
            <RefreshCw className="w-4 h-4 text-green-500" />
            <h3 className="text-sm font-semibold">System Updates</h3>
          </div>
          <div className="bg-muted/30 p-4 rounded-lg border space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-medium">Current Version</span>
                  <Badge variant="outline" className="text-[10px] h-5">{currentVersion}</Badge>
                </div>
                {latestVersion && (
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-medium">Latest Available</span>
                    <Badge variant={latestVersion !== currentVersion ? "default" : "secondary"} className="text-[10px] h-5 bg-green-500 hover:bg-green-600">
                      {latestVersion}
                    </Badge>
                  </div>
                )}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 text-[10px] uppercase font-bold"
                onClick={handleCheckUpdates}
                disabled={isChecking}
              >
                {isChecking ? "Checking..." : "Check for Updates"}
              </Button>
            </div>

            {latestVersion && latestVersion !== currentVersion && (
              <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-md animate-in fade-in slide-in-from-top-2">
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-2">
                  A new version is available! {latestVersion}
                </p>
                <div className="flex space-x-2">
                  <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={handleTriggerUpdate} disabled={isUpdating}>
                    {isUpdating ? "Processing..." : "Auto Update Now"}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 text-xs" asChild>
                    <a href={updateUrl || "#"} target="_blank" rel="noopener noreferrer" className="flex items-center">
                      View Release <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </Button>
                </div>
              </div>
            )}

            <div className="flex items-center space-x-2 text-[11px] text-muted-foreground pt-1">
              <Info className="w-3 h-3" />
              <span>Checking against <a href="https://github.com/EmptyRaider101/TapTapRevise" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">EmptyRaider101/TapTapRevise</a></span>
            </div>
          </div>
        </section>

        <Separator />

        {/* Security & Privacy */}
        <section className="space-y-3 pb-4">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-purple-500" />
            <h3 className="text-sm font-semibold">Privacy & Security</h3>
          </div>
          <div className="bg-muted/30 p-4 rounded-lg border space-y-3">
            <div className="flex items-start space-x-3">
              <Info className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-medium">Local-First Storage</p>
                <p className="text-[11px] text-muted-foreground">
                  Your files and notes are stored locally on this device in a SQLite database. No data is sent to external servers except for AI processing via the Gemini API when requested.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
      
      <div className="p-4 border-t bg-muted/10 text-center">
        <p className="text-[10px] text-muted-foreground">
          TapTapRevise Desktop &copy; 2026. Made with ❤️ for revision.
        </p>
      </div>
    </div>
  );
}
