import { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { File as FileIcon, Bot } from 'lucide-react';
import { Button } from '../ui/button';

// Helper to convert Markdown to HTML for the editor
const applySymbolReplacements = (text: string) => {
  if (!text) return '';
  return text
    // General arrows & indicators
    .replace(/->/g, '→')
    .replace(/=>/g, '⇒')
    .replace(/<-/g, '←')
    .replace(/<==/g, '⇐')
    .replace(/<->/g, '↔')
    .replace(/<==>/g, '⇔')
    .replace(/\.\.\./g, '…')
    // Comparisons
    .replace(/!=/g, '≠')
    .replace(/<=/g, '≤')
    .replace(/>=/g, '≥')
    .replace(/~=/g, '≈')
    // Math/Science
    .replace(/\+-/g, '∧')
    .replace(/\+\/-/g, '∨')
    .replace(/1\/2/g, '½')
    .replace(/1\/4/g, '¼')
    .replace(/3\/4/g, '¾')
    .replace(/\bdeg\b/gi, '°')
    .replace(/\bpi\b/gi, '∨')
    .replace(/\bsqrt\b/gi, '√')
    .replace(/\binfinity\b/gi, '∞')
    .replace(/\bmu\b/gi, 'µ')
    .replace(/\bexists\b/gi, '∃')
    // Set Theory - ONLY specific non-word shorthands or the requested ones
    .replace(/\b!in\b/gi, '∉')
    .replace(/!∈/g, '∉')
    .replace(/!⊂/g, '⊄')
    .replace(/!⊆/g, '⊈')
    .replace(/!⊃/g, '⊅')
    .replace(/!⊇/g, '⊉')
    .replace(/!≈/g, '≉')
    .replace(/!≡/g, '≢')
    .replace(/!=/g, '≠')
    // Specific requests (keeping these as they are less likely to clash)
    .replace(/(\d+)\s*A\b/g, '$1 Å') // Angstrom
    .replace(/(\d+)\s*B\b/g, '$1 ∉') // "is not a set/element of"
    .replace(/(\d+)\s*Y\b/g, '$1 Σ') // Sigma Notation
    // Common Greek letters - removing these from auto-replace to avoid clashes
    // .replace(/\balpha\b/gi, 'α') ...
    // Branding
    .replace(/\(c\)/g, '©')
    .replace(/\(r\)/g, '®')
    .replace(/\(tm\)/g, '™');
};

const mdToHtml = (md: string) => {
  if (!md) return '';
  let content = applySymbolReplacements(md);
  // Convert images: ![alt](url) -> <img src="url" alt="alt" />
  let html = content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width: 100%; border-radius: 0.75rem; border: 1px solid var(--border); margin: 1rem 0; box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);" />');
  // Simple approach: preserve newlines as they are
  return html.split('\n').map(line => line.trim() === '' ? '<div><br></div>' : `<div>${line}</div>`).join('');
};

// Helper to convert HTML back to Markdown for storage
const htmlToMd = (html: string) => {
  if (!html) return '';
  let md = html;
  // Convert <img> tags back to Markdown
  md = md.replace(/<img[^>]+src="([^">]+)"[^>]*>/g, (_, src) => `\n![Pasted Image](${src})\n`);
  // Convert <div> and <br> back to newlines
  md = md.replace(/<div><br><\/div>/g, '\n');
  md = md.replace(/<div>(.*?)<\/div>/g, '$1\n');
  md = md.replace(/<br>/g, '\n');
  
  md = md.replace(/&nbsp;/g, ' ');
  md = md.replace(/\u00A0/g, ' ');
  
  // Apply replacements before saving to DB
  md = applySymbolReplacements(md);
  
  return md.trim();
};

const COMMON_SYMBOLS = [
  { s: '∀', label: 'For all' },
  { s: '∉', label: 'Not in' },
  { s: '∈', label: 'In' },
  { s: '⊄', label: 'Not subset' },
  { s: '⊈', label: 'Not subset eq' },
  { s: '⊂', label: 'Subset' },
  { s: '⊆', label: 'Subset Eq' },
  { s: '∪', label: 'Union' },
  { s: '∩', label: 'Intersect' },
  { s: '∅', label: 'Empty' },
  { s: 'α', label: 'Alpha' },
  { s: 'β', label: 'Beta' },
  { s: 'Σ', label: 'Sigma' },
  { s: 'Δ', label: 'Delta' },
  { s: '∨', label: 'OR' },
  { s: '⊕', label: 'XOR' },
  { s: '∴', label: 'Therefore' },
  { s: '∃', label: 'Exists' },
  { s: 'µ', label: 'Micro' },
  { s: '∧', label: 'AND' },
  { s: '≈', label: 'Approx' },
  { s: '≠', label: 'Not equal' },
  { s: '≤', label: 'Less equal' },
  { s: '≥', label: 'Greater equal' },
  { s: '°', label: 'Degree' },
  { s: '√', label: 'Sqrt' },
  { s: '→', label: 'Arrow' },
  { s: '⇒', label: 'Implies' },
  { s: '↔', label: 'Double Arrow' },
];

export function NotesEditor() {
  const { files, activeFileId, notes, saveNote, uploadNoteImage } = useStore();
  const [scope, setScope] = useState<'file' | 'global'>('file');
  
  const currentFileId = scope === 'file' ? (activeFileId || 'none') : 'global';
  const currentNote = notes.find(n => n.fileId === currentFileId);

  const editorRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);

  const lastLoadedFileIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = mdToHtml(currentNote?.content || '');
      lastLoadedFileIdRef.current = currentFileId;
    }
  }, [currentFileId]);

  useEffect(() => {
    if (editorRef.current && !isEditing) {
      editorRef.current.innerHTML = mdToHtml(currentNote?.content || '');
      lastLoadedFileIdRef.current = currentFileId;
    }
  }, [currentNote?.content, isEditing]);

  const handleInput = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (range.collapsed && range.startContainer.nodeType === Node.TEXT_NODE) {
        const node = range.startContainer;
        const text = node.textContent || '';
        const offset = range.startOffset;
        
        const textBeforeCursor = text.substring(0, offset);
        
        let handledSigmaStep2 = false;
        let handledSigmaStep1 = false;
        
        // Check for Sigma step 2: "again " after a math-sigma[data-step=1]
        const topMatch = textBeforeCursor.match(/^\s*([^\s]+)\s$/);
        if (topMatch) {
          let prevNode = node.previousSibling;
          while (prevNode && prevNode.nodeType === Node.TEXT_NODE && !prevNode.textContent?.trim()) {
            prevNode = prevNode.previousSibling;
          }
          if (prevNode && prevNode.nodeType === Node.ELEMENT_NODE) {
            const prevEl = prevNode as HTMLElement;
            if (prevEl.classList.contains('math-sigma') && prevEl.dataset.step === '1') {
              const topText = topMatch[1];
              prevEl.dataset.step = '2';
              prevEl.dataset.top = topText;
              const topSpan = prevEl.querySelector('.sigma-top') as HTMLElement;
              if (topSpan) {
                topSpan.textContent = topText;
                topSpan.style.visibility = 'visible';
              }
              
              range.setStart(node, 0);
              range.setEnd(node, offset);
              range.deleteContents();
              
              const spaceNode = document.createTextNode('\u00A0');
              range.insertNode(spaceNode);
              range.setStartAfter(spaceNode);
              range.collapse(true);
              selection.removeAllRanges();
              selection.addRange(range);
              handledSigmaStep2 = true;
            }
          }
        }
        
        // Check for Sigma step 1: "(sigma)something "
        if (!handledSigmaStep2) {
          const sigmaMatch1 = textBeforeCursor.match(/\(sigma\)\s*([^\s]+)\s$/);
          if (sigmaMatch1) {
            const bottomText = sigmaMatch1[1];
            const startOffset = sigmaMatch1.index!;
            
            range.setStart(node, startOffset);
            range.setEnd(node, offset);
            range.deleteContents();
            
            const sigmaSpan = document.createElement('span');
            sigmaSpan.className = 'math-sigma';
            sigmaSpan.dataset.step = '1';
            sigmaSpan.dataset.bottom = bottomText;
            sigmaSpan.contentEditable = 'false';
            sigmaSpan.style.display = 'inline-flex';
            sigmaSpan.style.flexDirection = 'column';
            sigmaSpan.style.verticalAlign = 'middle';
            sigmaSpan.style.textAlign = 'center';
            sigmaSpan.style.margin = '0 0.2em';
            
            const topSpan = document.createElement('span');
            topSpan.className = 'sigma-top';
            topSpan.style.fontSize = '0.6em';
            topSpan.style.lineHeight = '1';
            topSpan.style.visibility = 'hidden';
            topSpan.textContent = '_';
            
            const symbolSpan = document.createElement('span');
            symbolSpan.className = 'sigma-symbol';
            symbolSpan.style.fontSize = '1.2em';
            symbolSpan.style.lineHeight = '1';
            symbolSpan.textContent = 'Σ';
            
            const bottomSpan = document.createElement('span');
            bottomSpan.className = 'sigma-bottom';
            bottomSpan.style.fontSize = '0.6em';
            bottomSpan.style.lineHeight = '1';
            bottomSpan.textContent = bottomText;
            
            sigmaSpan.appendChild(topSpan);
            sigmaSpan.appendChild(symbolSpan);
            sigmaSpan.appendChild(bottomSpan);
            
            range.insertNode(sigmaSpan);
            
            range.setStartAfter(sigmaSpan);
            range.collapse(true);
            
            const spaceNode = document.createTextNode('\u00A0');
            range.insertNode(spaceNode);
            
            range.setStartAfter(spaceNode);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            handledSigmaStep1 = true;
          }
        }

        // Original superscript logic
        if (!handledSigmaStep2 && !handledSigmaStep1) {
          const match = textBeforeCursor.match(/\^([^\s\^]+)\s$/);
          if (match) {
            const superscriptText = match[1];
            const startOffset = match.index!;
            
            range.setStart(node, startOffset);
            range.setEnd(node, offset);
            range.deleteContents();
            
            const sup = document.createElement('sup');
            sup.textContent = superscriptText;
            range.insertNode(sup);
            
            range.setStartAfter(sup);
            range.collapse(true);
            
            const spaceNode = document.createTextNode('\u00A0');
            range.insertNode(spaceNode);
            
            range.setStartAfter(spaceNode);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
      }
    }

    if (editorRef.current && lastLoadedFileIdRef.current === currentFileId) {
      const markdown = htmlToMd(editorRef.current.innerHTML);
      saveNote(currentFileId, markdown);
    }
  };

  const handleFocus = () => setIsEditing(true);
  const handleBlur = () => {
    handleInput();
    setIsEditing(false);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    
    // Check for images first
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          try {
            const url = await uploadNoteImage(file);
            const imgHtml = `<img src="${url}" style="max-width: 100%; border-radius: 0.75rem; border: 1px solid var(--border); margin: 1rem 0; box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);" />`;
            
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              range.deleteContents();
              const el = document.createElement("div");
              el.innerHTML = imgHtml;
              const frag = document.createDocumentFragment();
              let node, lastNode;
              while ( (node = el.firstChild) ) {
                lastNode = frag.appendChild(node);
              }
              range.insertNode(frag);
              if (lastNode) {
                range.setStartAfter(lastNode);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
              }
            } else if (editorRef.current) {
              editorRef.current.innerHTML += imgHtml;
            }
            handleInput();
          } catch (err) {
            console.error('Failed to upload pasted image:', err);
          }
        }
        return; // Stop if we handled an image
      }
    }

    // Handle text paste with symbol auto-replacement
    const text = e.clipboardData.getData('text/plain');
    if (text) {
      e.preventDefault();
      const processedText = applySymbolReplacements(text);
      
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(processedText);
        range.insertNode(textNode);
        
        // Move cursor to end of inserted text
        range.setStartAfter(textNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        
        handleInput();
      }
    }
  };

  const insertSymbol = (symbol: string) => {
    editorRef.current?.focus();
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(symbol);
      range.insertNode(textNode);
      
      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      
      handleInput();
    } else if (editorRef.current) {
      editorRef.current.innerText += symbol;
      handleInput();
    }
  };

  const file = files.find(f => f.id === activeFileId);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="border-b px-4 py-2 flex items-center justify-between bg-muted/20">
        <Tabs value={scope} onValueChange={(v) => setScope(v as 'file' | 'global')} className="w-[280px]">
          <TabsList className="h-8">
            <TabsTrigger value="file" className="text-xs px-3"><FileIcon className="w-3 h-3 mr-1"/> File Notes</TabsTrigger>
            <TabsTrigger value="global" className="text-xs px-3"><Bot className="w-3 h-3 mr-1 text-orange-500"/> Exam Prep (Shared)</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {scope === 'global' && (
        <div className="bg-orange-500/10 border-b border-orange-500/20 px-4 py-2 flex items-center space-x-2 shrink-0">
          <Bot className="w-4 h-4 text-orange-500" />
          <p className="text-[10px] font-medium text-orange-700 dark:text-orange-400 uppercase tracking-wider">
            Exam Prep Mode: These notes are shared across all documents.
          </p>
        </div>
      )}
      
      {scope === 'file' && !activeFileId ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground p-8 text-center bg-muted/5">
          <p>Select a file to edit its notes, or switch to Exam Prep notes above.</p>
        </div>
      ) : (
        <Tabs defaultValue="edit" className="flex-1 flex flex-col min-h-0">
          <div className="border-b bg-muted/5 flex flex-col shrink-0">
            <div className="px-4 py-1 flex justify-between items-center border-b">
              <span className="text-xs font-medium text-muted-foreground">
                {scope === 'file' ? (
                  <span className="flex items-center"><FileIcon className="w-3 h-3 mr-1.5 opacity-50"/> {file?.name}</span>
                ) : (
                  <span className="flex items-center text-orange-600 dark:text-orange-400 font-bold"><Bot className="w-3 h-3 mr-1.5"/> EXAM PREP / SHARED NOTES</span>
                )}
              </span>
              <TabsList className="h-7 bg-transparent">
                <TabsTrigger value="edit" className="text-[10px] uppercase tracking-wider px-2 py-0.5 h-6">Edit</TabsTrigger>
                <TabsTrigger value="preview" className="text-[10px] uppercase tracking-wider px-2 py-0.5 h-6">Preview</TabsTrigger>
              </TabsList>
            </div>
            
            <div className="px-2 py-1.5 flex items-center space-x-1 overflow-x-auto no-scrollbar bg-muted/10">
              <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground/60 px-2 shrink-0">Symbols</span>
              <div className="flex items-center space-x-1 px-1">
                {COMMON_SYMBOLS.map(sym => (
                  <Button 
                    key={sym.s}
                    variant="ghost" 
                    size="sm" 
                    className="h-7 w-7 p-0 text-sm hover:bg-primary hover:text-primary-foreground transition-all shrink-0"
                    title={sym.label}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => insertSymbol(sym.s)}
                  >
                    {sym.s}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          
          <TabsContent value="edit" className="flex-1 m-0 p-0 outline-none flex flex-col overflow-hidden data-[state=active]:flex min-h-0">
            <div 
              key={currentFileId}
              ref={editorRef}
              contentEditable
              onInput={handleInput}
              onPaste={handlePaste}
              onFocus={handleFocus}
              onBlur={handleBlur}
              style={{ fontFamily: 'var(--font-sans)' }}
              className="flex-1 w-full overflow-y-auto p-6 focus:outline-none prose prose-sm dark:prose-invert max-w-none bg-transparent custom-scrollbar font-sans"
            />
          </TabsContent>
          <TabsContent value="preview" className="flex-1 m-0 p-0 outline-none bg-muted/5 flex flex-col overflow-hidden data-[state=active]:flex min-h-0">
            <div className="flex-1 w-full overflow-y-auto custom-scrollbar">
              <div className="prose prose-sm dark:prose-invert max-w-none p-6">
                {currentNote?.content ? (
                  <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                    {applySymbolReplacements(currentNote.content)}
                  </ReactMarkdown>
                ) : (
                  <span className="text-muted-foreground italic">No notes written yet.</span>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
