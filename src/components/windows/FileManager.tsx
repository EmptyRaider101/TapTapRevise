import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { useStore } from "../../store"
import type { FileStatus } from "../../store"
import {
  UploadCloud,
  FileText,
  File,
  CheckCircle2,
  Circle,
  Clock,
  BookOpen,
  Tag,
  Layers,
  ArrowUpDown,
  Trash2,
  CheckSquare,
  Square,
} from "lucide-react"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"

function MetadataSelector({
  value,
  options,
  onChange,
  placeholder,
}: {
  value: string
  options: string[]
  onChange: (val: string) => void
  placeholder: string
}) {
  const [isNew, setIsNew] = useState(false)
  const [tempValue, setTempValue] = useState("")

  if (isNew) {
    return (
      <input
        autoFocus
        className="h-5 w-24 rounded border border-primary/20 bg-muted/50 px-1.5 py-0.5 text-[10px] outline-none focus:ring-1 focus:ring-primary"
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onChange(tempValue)
            setIsNew(false)
            setTempValue("")
          }
          if (e.key === "Escape") {
            setIsNew(false)
            setTempValue("")
          }
        }}
        onBlur={() => {
          if (tempValue) onChange(tempValue)
          setIsNew(false)
          setTempValue("")
        }}
        placeholder="Enter new..."
        onClick={(e) => e.stopPropagation()}
      />
    )
  }

  return (
    <select
      className="h-5 max-w-[90px] cursor-pointer truncate rounded border-none bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted-foreground outline-none focus:ring-0"
      value={value}
      onChange={(e) => {
        if (e.target.value === "___NEW___") {
          setIsNew(true)
        } else {
          onChange(e.target.value)
        }
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
      <option value="___NEW___" className="font-bold text-primary">
        + New...
      </option>
    </select>
  )
}

export function FileManager() {
  const {
    files,
    uploadFiles,
    activeFileId,
    setActiveFile,
    updateFileStatus,
    updateFileMetadata,
    openWindow,
    deleteFiles,
  } = useStore()
  const [sortBy, setSortBy] = useState<"name-module" | "module-name">(
    "name-module"
  )
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const sortedFiles = [...files].sort((a, b) => {
    if (sortBy === "name-module") {
      const nameCompare = a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: "base",
      })
      if (nameCompare !== 0) return nameCompare
      return (a.module || "").localeCompare(b.module || "", undefined, {
        numeric: true,
        sensitivity: "base",
      })
    } else {
      const moduleCompare = (a.module || "").localeCompare(
        b.module || "",
        undefined,
        { numeric: true, sensitivity: "base" }
      )
      if (moduleCompare !== 0) return moduleCompare
      return a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    }
  })

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      uploadFiles(acceptedFiles)
    },
    [uploadFiles]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        [".pptx"],
    },
  })

  const topics = Array.from(
    new Set(files.map((f) => f.topic).filter(Boolean))
  ) as string[]
  const modules = Array.from(
    new Set(files.map((f) => f.module).filter(Boolean))
  ) as string[]

  const getStatusBadge = (status: FileStatus) => {
    switch (status) {
      case "complete":
        return (
          <Badge className="h-5 bg-green-500 px-1.5 py-0 text-[10px] hover:bg-green-600">
            <CheckCircle2 className="mr-1 h-2.5 w-2.5" /> Complete
          </Badge>
        )
      case "complete-follow-up":
        return (
          <Badge className="h-5 bg-yellow-500 px-1.5 py-0 text-[10px] hover:bg-yellow-600">
            <Clock className="mr-1 h-2.5 w-2.5" /> Review
          </Badge>
        )
      case "need-to-learn":
        return (
          <Badge className="h-5 bg-red-500 px-1.5 py-0 text-[10px] hover:bg-red-600">
            <BookOpen className="mr-1 h-2.5 w-2.5" /> Learn
          </Badge>
        )
      default:
        return (
          <Badge
            variant="secondary"
            className="h-5 px-1.5 py-0 text-[10px] text-muted-foreground"
          >
            <Circle className="mr-1 h-2.5 w-2.5" /> Unread
          </Badge>
        )
    }
  }
  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === files.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(files.map((f) => f.id))
    }
  }

  const handleDelete = async (ids: string[], e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (confirm(`Are you sure you want to delete ${ids.length} file(s)?`)) {
      await deleteFiles(ids)
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)))
    }
  }

  return (
    <div className="flex h-full flex-col bg-background/50">
      <div
        {...getRootProps()}
        className={`m-3 cursor-pointer rounded-xl border-b border-dashed p-4 text-center transition-colors ${
          isDragActive
            ? "border-primary bg-primary/10"
            : "border-muted-foreground/30 bg-muted/30 hover:bg-muted/50"
        }`}
      >
        <input {...getInputProps()} />
        <UploadCloud className="mx-auto mb-1 h-6 w-6 text-muted-foreground" />
        <p className="text-[11px] font-medium text-muted-foreground">
          Drop PDFs/PPTXs here
        </p>
      </div>

      <div className="flex items-center justify-between px-4 pb-2 text-xs font-semibold">
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="icon-xs"
            className="h-5 w-5 rounded-md text-muted-foreground"
            onClick={toggleSelectAll}
          >
            {selectedIds.length === files.length && files.length > 0 ? (
              <CheckSquare className="h-3 w-3 text-primary" />
            ) : (
              <Square className="h-3 w-3" />
            )}
          </Button>
          <span>Files ({files.length})</span>
          <Button
            variant="ghost"
            size="icon-xs"
            className={`h-5 w-5 rounded-md transition-colors ${sortBy === "module-name" ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}
            onClick={() =>
              setSortBy(
                sortBy === "name-module" ? "module-name" : "name-module"
              )
            }
            title={
              sortBy === "name-module"
                ? "Sorting by Name > Module"
                : "Sorting by Module > Name"
            }
          >
            <ArrowUpDown className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex items-center space-x-1">
          {selectedIds.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] text-red-500 hover:bg-red-500/10 hover:text-red-600"
              onClick={(e) => handleDelete(selectedIds, e)}
            >
              <Trash2 className="mr-1 h-3 w-3" />
              Delete ({selectedIds.length})
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] hover:bg-primary/10 hover:text-primary"
            onClick={() => {
              const input = document.createElement("input")
              input.type = "file"
              // @ts-ignore
              input.webkitdirectory = true
              input.onchange = (e) => {
                const files = (e.target as HTMLInputElement).files
                if (files) uploadFiles(Array.from(files))
              }
              input.click()
            }}
          >
            Import Folder
          </Button>
        </div>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-4">
        <div className="space-y-2 pb-4">
          {sortedFiles.map((file) => (
            <div
              key={file.id}
              className={`group cursor-pointer rounded-lg border p-3 transition-all ${
                activeFileId === file.id
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-transparent bg-card hover:border-border hover:bg-muted/50"
              } ${selectedIds.includes(file.id) ? "ring-1 ring-primary" : ""}`}
              onClick={() => {
                setActiveFile(file.id)
                openWindow("previewer", { fileId: file.id })
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <div className="flex-shrink-0 rounded-md bg-blue-500/10 p-1.5 text-blue-500">
                    {file.type.includes("pdf") ? (
                      <FileText className="h-4 w-4" />
                    ) : (
                      <File className="h-4 w-4" />
                    )}
                  </div>
                  <div
                    className="cursor-pointer rounded-md p-1 transition-colors hover:bg-primary/10"
                    onClick={(e) => toggleSelect(file.id, e)}
                  >
                    {selectedIds.includes(file.id) ? (
                      <CheckSquare className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Square className="h-3.5 w-3.5 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="truncate text-xs font-medium">
                      {file.name}
                    </h4>
                    <div className="mt-1 flex items-center space-x-2">
                      <div className="flex items-center text-[10px] text-muted-foreground">
                        <Tag className="mr-1 h-2.5 w-2.5" />
                        <MetadataSelector
                          value={file.topic || ""}
                          options={topics}
                          onChange={(val) =>
                            updateFileMetadata(file.id, val, file.module || "")
                          }
                          placeholder="Topic"
                        />
                      </div>
                      <div className="flex items-center text-[10px] text-muted-foreground">
                        <Layers className="mr-1 h-2.5 w-2.5" />
                        <MetadataSelector
                          value={file.module || ""}
                          options={modules}
                          onChange={(val) =>
                            updateFileMetadata(file.id, file.topic || "", val)
                          }
                          placeholder="Module"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="h-6 w-6 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-500"
                  onClick={(e) => handleDelete([file.id], e)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <div
                className="mt-2.5 flex items-center justify-between border-t border-border/50 pt-2.5"
                onClick={(e) => e.stopPropagation()}
              >
                {getStatusBadge(file.status)}

                <select
                  className="cursor-pointer border-none bg-transparent text-[10px] text-muted-foreground outline-none focus:ring-0"
                  value={file.status}
                  onChange={(e) =>
                    updateFileStatus(file.id, e.target.value as FileStatus)
                  }
                >
                  <option value="unread">Mark Unread</option>
                  <option value="complete">Mark Complete</option>
                  <option value="complete-follow-up">Needs Follow Up</option>
                  <option value="need-to-learn">Need to Learn</option>
                </select>
              </div>
            </div>
          ))}
          {files.length === 0 && (
            <div className="py-10 text-center text-[11px] text-muted-foreground">
              No files uploaded yet.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
