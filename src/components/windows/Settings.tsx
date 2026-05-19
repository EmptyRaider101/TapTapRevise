import { useState } from "react"
import { useStore } from "../../store"
import {
  Settings as SettingsIcon,
  Sparkles,
  RefreshCw,
  Shield,
  Info,
  ExternalLink,
} from "lucide-react"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { Separator } from "../ui/separator"

export function Settings() {
  const {
    geminiApiKey,
    setGeminiApiKey,
    latestVersion,
    updateUrl,
    checkUpdates,
    triggerUpdate,
  } = useStore()

  const [apiKeyInput, setApiKeyInput] = useState(geminiApiKey || "")
  const [isChecking, setIsChecking] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleCheckUpdates = async () => {
    setIsChecking(true)
    await checkUpdates()
    setIsChecking(false)
  }

  const handleTriggerUpdate = async () => {
    setIsUpdating(true)
    await triggerUpdate()
    setIsUpdating(false)
  }

  const currentVersion = "v0.0.1" // Hardcoded for now, should ideally come from package.json or env

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="flex items-center border-b bg-muted/30 px-4 py-2">
        <SettingsIcon className="mr-2 h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          App Settings
        </span>
      </div>

      <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto p-4">
        {/* AI Configuration */}
        <section className="space-y-3">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-semibold">AI Configuration</h3>
          </div>
          <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase">
                Google Gemini API Key
              </label>
              <div className="mt-1 flex space-x-2">
                <Input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Paste your API key here..."
                  className="h-9 bg-background text-xs"
                />
                <Button
                  size="sm"
                  className="h-9 text-xs"
                  onClick={async () => {
                    await setGeminiApiKey(apiKeyInput)
                  }}
                >
                  Save Key
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                This key is used for document analysis and the AI Assistant. It
                is stored securely in your local database.
              </p>
            </div>
          </div>
        </section>

        <Separator />

        {/* Updates Tracker */}
        <section className="space-y-3">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4 text-green-500" />
            <h3 className="text-sm font-semibold">System Updates</h3>
          </div>
          <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-medium">Current Version</span>
                  <Badge variant="outline" className="h-5 text-[10px]">
                    {currentVersion}
                  </Badge>
                </div>
                {latestVersion && (
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-medium">
                      Latest Available
                    </span>
                    <Badge
                      variant={
                        latestVersion !== currentVersion
                          ? "default"
                          : "secondary"
                      }
                      className="h-5 bg-green-500 text-[10px] hover:bg-green-600"
                    >
                      {latestVersion}
                    </Badge>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-[10px] font-bold uppercase"
                onClick={handleCheckUpdates}
                disabled={isChecking}
              >
                {isChecking ? "Checking..." : "Check for Updates"}
              </Button>
            </div>

            {latestVersion && latestVersion !== currentVersion && (
              <div className="animate-in rounded-md border border-blue-500/20 bg-blue-500/10 p-3 fade-in slide-in-from-top-2">
                <p className="mb-2 text-xs font-medium text-blue-600 dark:text-blue-400">
                  A new version is available! {latestVersion}
                </p>
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    className="h-8 bg-blue-600 text-xs text-white hover:bg-blue-700"
                    onClick={handleTriggerUpdate}
                    disabled={isUpdating}
                  >
                    {isUpdating ? "Processing..." : "Auto Update Now"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    asChild
                  >
                    <a
                      href={updateUrl || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center"
                    >
                      View Release <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </div>
            )}

            <div className="flex items-center space-x-2 pt-1 text-[11px] text-muted-foreground">
              <Info className="h-3 w-3" />
              <span>
                Checking against{" "}
                <a
                  href="https://github.com/EmptyRaider101/TapTapRevise"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  EmptyRaider101/TapTapRevise
                </a>
              </span>
            </div>
          </div>
        </section>

        <Separator />

        {/* Security & Privacy */}
        <section className="space-y-3 pb-4">
          <div className="flex items-center space-x-2">
            <Shield className="h-4 w-4 text-purple-500" />
            <h3 className="text-sm font-semibold">Privacy & Security</h3>
          </div>
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-start space-x-3">
              <Info className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-xs font-medium">Local-First Storage</p>
                <p className="text-[11px] text-muted-foreground">
                  Your files and notes are stored locally on this device in a
                  SQLite database. No data is sent to external servers except
                  for AI processing via the Gemini API when requested.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="border-t bg-muted/10 p-4 text-center">
        <p className="text-[10px] text-muted-foreground">
          TapTapRevise Desktop &copy; 2026. Made with ❤️ for revision.
        </p>
      </div>
    </div>
  )
}
