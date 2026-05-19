import { useState, useRef, useEffect } from "react"
import { useStore } from "../../store"
import ReactMarkdown from "react-markdown"
import { Send, Bot, User, Sparkles, Settings } from "lucide-react"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { GoogleGenerativeAI } from "@google/generative-ai"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

export function AIAssistant() {
  const {
    files,
    activeFileId,
    notes,
    aiModel,
    setAIModel,
    geminiApiKey,
    openWindow,
  } = useStore()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        'Hi! I can help you understand your documents or answer questions about your notes. Try mentioning "@file-notes" or "@exam-notes"!',
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  
  const activeFile = files.find((f) => f.id === activeFileId)

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async () => {
    if (!input.trim()) return

    const userMsg = input.trim()
    setInput("")
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: "user", content: userMsg },
    ])
    setIsLoading(true)

    try {
      // Collect context
      let context = ""

      if (activeFile) {
        context += `\n--- ACTIVE FILE CONTENT (${activeFile.name}) ---\n${activeFile.content || "No content extracted."}\n`
      }

      if (userMsg.includes("@file-notes") && activeFile) {
        const fileNotes = notes.find((n) => n.fileId === activeFile.id)
        context += `\n--- NOTES FOR ${activeFile.name} ---\n${fileNotes?.content || "No notes yet."}\n`
      }

      if (
        userMsg.includes("@exam-notes") ||
        userMsg.includes("@global-notes")
      ) {
        const globalNotes = notes.find((n) => n.fileId === "global")
        context += `\n--- GLOBAL NOTES ---\n${globalNotes?.content || "No global notes yet."}\n`
      }

      let responseText = ""
      if (geminiApiKey) {
        try {
          const genAI = new GoogleGenerativeAI(geminiApiKey)
          const model = genAI.getGenerativeModel({ model: aiModel })

          const prompt = `${context}\n\nUser Question: ${userMsg}\n\nPlease answer based on the provided context if possible. Use markdown for formatting.`

          const result = await model.generateContent(prompt)
          const response = await result.response
          responseText = response.text()
        } catch (apiError: unknown) {
          console.error("Gemini API Error:", apiError)
          const errMsg = apiError instanceof Error ? apiError.message : "Unknown error"
          responseText = `Error calling Gemini API: ${errMsg}. Please check your API key in settings.`
        }
      } else {
        // Simulation if no key
        await new Promise((r) => setTimeout(r, 1500))
        
        const contextSnippets = []
        if (activeFile) {
          contextSnippets.push(`* **Document (${activeFile.name}):** "${activeFile.content ? activeFile.content.substring(0, 150) + '...' : 'No content'}"`)
        }
        if (userMsg.includes("@file-notes") && activeFile) {
          const fileNotes = notes.find((n) => n.fileId === activeFile.id)
          contextSnippets.push(`* **File Notes:** "${fileNotes?.content ? fileNotes.content.substring(0, 150) + '...' : 'No notes written'}"`)
        }
        if (userMsg.includes("@exam-notes")) {
          const globalNotes = notes.find((n) => n.fileId === "global")
          contextSnippets.push(`* **Exam Prep Notes:** "${globalNotes?.content ? globalNotes.content.substring(0, 150) + '...' : 'No notes written'}"`)
        }

        responseText = `### Context Received:\n${contextSnippets.length > 0 ? contextSnippets.join('\n') : '*No specific context requested.*'}\n\nThis is a **simulated response** using **${aiModel}** because no Gemini API key is configured. To enable real AI answers, please click the gear icon in the top right and add your Gemini API key.`
      }

      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "assistant", content: responseText },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "Sorry, I encountered an error.",
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex h-full flex-col bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-400 via-transparent to-transparent opacity-5"></div>

      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/50 px-4 py-2 backdrop-blur-sm">
        <div className="flex items-center space-x-2">
          <Bot className="h-4 w-4 text-blue-500" />
          <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Assistant
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={aiModel} onValueChange={setAIModel}>
            <SelectTrigger className="h-7 w-[150px] bg-muted/30 text-[10px]">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                value="gemini-3.1-flash-lite-preview"
                className="text-xs"
              >
                gemini-3.1-flash-lite-preview
              </SelectItem>
              <SelectItem value="gemma-4-31b-it" className="text-xs">
                gemma-4-31b-it
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => openWindow("settings")}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-4"
        ref={scrollRef}
      >
        <div className="space-y-4 pb-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`flex max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    msg.role === "user"
                      ? "ml-2 bg-primary text-primary-foreground"
                      : "mr-2 bg-blue-600 text-white"
                  }`}
                >
                  {msg.role === "user" ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </div>
                <div
                  className={`rounded-xl p-3 text-sm ${
                    msg.role === "user"
                      ? "rounded-tr-none bg-primary text-primary-foreground"
                      : "rounded-tl-none border border-border bg-muted shadow-sm"
                  }`}
                >
                  <div
                    className={`prose prose-sm dark:prose-invert max-w-none ${msg.role === "user" ? "text-primary-foreground" : ""}`}
                  >
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex max-w-[85%] flex-row">
                <div className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="flex items-center space-x-2 rounded-xl rounded-tl-none border border-border bg-muted p-4">
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-blue-400"
                    style={{ animationDelay: "0ms" }}
                  />
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-blue-400"
                    style={{ animationDelay: "150ms" }}
                  />
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-blue-400"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto border-t bg-background p-3">
        <div className="mb-2 flex flex-wrap gap-1.5 px-1">
          <button
            type="button"
            onClick={() => {
              setInput((prev) => {
                const trimmed = prev.trim()
                return trimmed ? `${trimmed} @file-notes` : "@file-notes"
              })
            }}
            disabled={!activeFile}
            className={`inline-flex items-center space-x-1 rounded-md px-2 py-1 text-[10px] font-medium border transition-all ${
              !activeFile
                ? "bg-muted/30 text-muted-foreground/30 border-transparent cursor-not-allowed"
                : "bg-blue-500/5 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 border-blue-500/20 cursor-pointer shadow-sm"
            }`}
            title={activeFile ? "Reference notes for current open file" : "Open a file first"}
          >
            <span>@file-notes</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setInput((prev) => {
                const trimmed = prev.trim()
                return trimmed ? `${trimmed} @exam-notes` : "@exam-notes"
              })
            }}
            className="inline-flex items-center space-x-1 rounded-md px-2 py-1 text-[10px] font-medium bg-orange-500/5 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 border border-orange-500/20 cursor-pointer shadow-sm transition-all"
            title="Reference shared exam preparation notes"
          >
            <span>@exam-notes</span>
          </button>
          {activeFile && activeFile.type.includes("pdf") && (
            <div className="ml-auto text-[9px] text-emerald-600 dark:text-emerald-400 flex items-center space-x-1 bg-emerald-500/5 border border-emerald-500/10 px-2 py-0.5 rounded-md">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="truncate max-w-[120px] font-medium">PDF content read ({activeFile.content?.length || 0} chars)</span>
            </div>
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex items-center space-x-2 rounded-full border bg-muted/50 p-1 pr-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about the file, or use @exam-notes..."
            className="h-10 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            className="h-8 w-8 shrink-0 rounded-full"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <div className="mt-2 px-4 text-center text-[10px] text-muted-foreground">
          AI can make mistakes. Consider verifying important information.
        </div>
      </div>
    </div>
  )
}
