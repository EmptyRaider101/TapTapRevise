import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useStore } from '../../store';
import type { FileStatus } from '../../store';
import { UploadCloud, FileText, File, CheckCircle2, Circle, Clock, BookOpen, Tag, Layers, ArrowUpDown, Trash2, CheckSquare, Square } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

function MetadataSelector({ 
  value, 
  options, 
  onChange, 
  placeholder 
}: { 
  value: string; 
  options: string[]; 
  onChange: (val: string) => void;
  placeholder: string;
}) {
  const [isNew, setIsNew] = useState(false);
  const [tempValue, setTempValue] = useState('');

  if (isNew) {
    return (
      <input
        autoFocus
        className="text-[10px] bg-muted/50 rounded px-1.5 py-0.5 border border-primary/20 focus:ring-1 focus:ring-primary outline-none w-24 h-5"
        value={tempValue}
        onChange={e => setTempValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            onChange(tempValue);
            setIsNew(false);
            setTempValue('');
          }
          if (e.key === 'Escape') {
            setIsNew(false);
            setTempValue('');
          }
        }}
        onBlur={() => {
          if (tempValue) onChange(tempValue);
          setIsNew(false);
          setTempValue('');
        }}
        placeholder="Enter new..."
        onClick={e => e.stopPropagation()}
      />
    );
  }

  return (
    <select
      className="text-[10px] bg-muted/30 rounded px-1.5 py-0.5 border-none text-muted-foreground focus:ring-0 cursor-pointer outline-none max-w-[90px] truncate h-5"
      value={value}
      onChange={e => {
        if (e.target.value === '___NEW___') {
          setIsNew(true);
        } else {
          onChange(e.target.value);
        }
      }}
      onClick={e => e.stopPropagation()}
    >
      <option value="">{placeholder}</option>
      {options.map(opt => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
      <option value="___NEW___" className="font-bold text-primary">+ New...</option>
    </select>
  );
}

export function FileManager() {
  const { files, uploadFiles, activeFileId, setActiveFile, updateFileStatus, updateFileMetadata, openWindow, deleteFiles } = useStore();
  const [sortBy, setSortBy] = useState<'name-module' | 'module-name'>('name-module');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const sortedFiles = [...files].sort((a, b) => {
    if (sortBy === 'name-module') {
      const nameCompare = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      if (nameCompare !== 0) return nameCompare;
      return (a.module || '').localeCompare(b.module || '', undefined, { numeric: true, sensitivity: 'base' });
    } else {
      const moduleCompare = (a.module || '').localeCompare(b.module || '', undefined, { numeric: true, sensitivity: 'base' });
      if (moduleCompare !== 0) return moduleCompare;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    }
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    uploadFiles(acceptedFiles);
  }, [uploadFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx']
    }
  });

  const topics = Array.from(new Set(files.map(f => f.topic).filter(Boolean))) as string[];
  const modules = Array.from(new Set(files.map(f => f.module).filter(Boolean))) as string[];

  const getStatusBadge = (status: FileStatus) => {
    switch (status) {
      case 'complete': return <Badge className="bg-green-500 hover:bg-green-600 px-1.5 py-0 h-5 text-[10px]"><CheckCircle2 className="w-2.5 h-2.5 mr-1"/> Complete</Badge>;
      case 'complete-follow-up': return <Badge className="bg-yellow-500 hover:bg-yellow-600 px-1.5 py-0 h-5 text-[10px]"><Clock className="w-2.5 h-2.5 mr-1"/> Review</Badge>;
      case 'need-to-learn': return <Badge className="bg-red-500 hover:bg-red-600 px-1.5 py-0 h-5 text-[10px]"><BookOpen className="w-2.5 h-2.5 mr-1"/> Learn</Badge>;
      default: return <Badge variant="secondary" className="text-muted-foreground px-1.5 py-0 h-5 text-[10px]"><Circle className="w-2.5 h-2.5 mr-1"/> Unread</Badge>;
    }
  };
  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === files.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(files.map(f => f.id));
    }
  };

  const handleDelete = async (ids: string[], e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm(`Are you sure you want to delete ${ids.length} file(s)?`)) {
      await deleteFiles(ids);
      setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
    }
  };

  return (
    <div className="flex flex-col h-full bg-background/50">
      <div 
        {...getRootProps()} 
        className={`p-4 border-b border-dashed m-3 rounded-xl text-center cursor-pointer transition-colors ${
          isDragActive ? 'bg-primary/10 border-primary' : 'bg-muted/30 border-muted-foreground/30 hover:bg-muted/50'
        }`}
      >
        <input {...getInputProps()} />
        <UploadCloud className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
        <p className="text-[11px] text-muted-foreground font-medium">Drop PDFs/PPTXs here</p>
      </div>

      <div className="px-4 pb-2 font-semibold text-xs flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="icon-xs"
            className="h-5 w-5 rounded-md text-muted-foreground"
            onClick={toggleSelectAll}
          >
            {selectedIds.length === files.length && files.length > 0 ? <CheckSquare className="w-3 h-3 text-primary" /> : <Square className="w-3 h-3" />}
          </Button>
          <span>Files ({files.length})</span>
          <Button 
            variant="ghost" 
            size="icon-xs" 
            className={`h-5 w-5 rounded-md transition-colors ${sortBy === 'module-name' ? 'bg-primary/20 text-primary' : 'text-muted-foreground'}`}
            onClick={() => setSortBy(sortBy === 'name-module' ? 'module-name' : 'name-module')}
            title={sortBy === 'name-module' ? 'Sorting by Name > Module' : 'Sorting by Module > Name'}
          >
            <ArrowUpDown className="w-3 h-3" />
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
              <Trash2 className="w-3 h-3 mr-1" />
              Delete ({selectedIds.length})
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 text-[10px] hover:bg-primary/10 hover:text-primary"
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              // @ts-ignore
              input.webkitdirectory = true;
              input.onchange = (e) => {
                const files = (e.target as HTMLInputElement).files;
                if (files) uploadFiles(Array.from(files));
              };
              input.click();
            }}
          >
            Import Folder
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 min-h-0 custom-scrollbar">
        <div className="space-y-2 pb-4">
          {sortedFiles.map(file => (
            <div 
              key={file.id}
              className={`p-3 rounded-lg border cursor-pointer transition-all group ${
                activeFileId === file.id ? 'bg-primary/5 border-primary shadow-sm' : 'bg-card hover:bg-muted/50 border-transparent hover:border-border'
              } ${selectedIds.includes(file.id) ? 'ring-1 ring-primary' : ''}`}
              onClick={() => {
                setActiveFile(file.id);
                openWindow('previewer', { fileId: file.id });
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-500 flex-shrink-0">
                    {file.type.includes('pdf') ? <FileText className="w-4 h-4" /> : <File className="w-4 h-4" />}
                  </div>
                  <div 
                    className="p-1 cursor-pointer hover:bg-primary/10 rounded-md transition-colors"
                    onClick={(e) => toggleSelect(file.id, e)}
                  >
                    {selectedIds.includes(file.id) ? <CheckSquare className="w-3.5 h-3.5 text-primary" /> : <Square className="w-3.5 h-3.5 text-muted-foreground/50" />}
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="text-xs font-medium truncate">{file.name}</h4>
                    <div className="flex items-center space-x-2 mt-1">
                      <div className="flex items-center text-[10px] text-muted-foreground">
                        <Tag className="w-2.5 h-2.5 mr-1" />
                        <MetadataSelector 
                          value={file.topic || ''} 
                          options={topics} 
                          onChange={(val) => updateFileMetadata(file.id, val, file.module || '')} 
                          placeholder="Topic"
                        />
                      </div>
                      <div className="flex items-center text-[10px] text-muted-foreground">
                        <Layers className="w-2.5 h-2.5 mr-1" />
                        <MetadataSelector 
                          value={file.module || ''} 
                          options={modules} 
                          onChange={(val) => updateFileMetadata(file.id, file.topic || '', val)} 
                          placeholder="Module"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="h-6 w-6 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => handleDelete([file.id], e)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <div className="mt-2.5 flex items-center justify-between border-t border-border/50 pt-2.5" onClick={e => e.stopPropagation()}>
                {getStatusBadge(file.status)}
                
                <select 
                  className="text-[10px] bg-transparent border-none text-muted-foreground focus:ring-0 cursor-pointer outline-none"
                  value={file.status}
                  onChange={(e) => updateFileStatus(file.id, e.target.value as FileStatus)}
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
            <div className="text-center py-10 text-muted-foreground text-[11px]">
              No files uploaded yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
