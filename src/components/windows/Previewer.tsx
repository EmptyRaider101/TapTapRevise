import React from 'react';
import { useStore } from '../../store';
import { FileQuestion } from 'lucide-react';

const fill: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100%',
  height: '100%',
  overflow: 'hidden',
};

export function Previewer() {
  const { files, activeFileId } = useStore();
  const file = files.find(f => f.id === activeFileId);

  if (!file) {
    return (
      <div
        style={{ ...fill, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}
        className="text-muted-foreground bg-muted/10"
      >
        <FileQuestion className="w-16 h-16 mb-4 opacity-20" />
        <p>Select a file from the File Manager to preview it here.</p>
      </div>
    );
  }

  if (file.type.includes('pdf')) {
    return (
      <iframe
        src={file.url}
        style={{ ...fill, border: 'none', backgroundColor: 'white', display: 'block' }}
        title="PDF Preview"
      />
    );
  }

  return (
    <div style={{ ...fill, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', padding: '2rem' }}>
      <h2 className="text-xl font-bold mb-4">Presentation Preview</h2>
      <p className="text-muted-foreground text-center">
        (Preview of {file.name})<br />
        In a production app, PPTX files would be rendered using a service or a specialized canvas renderer.
      </p>
    </div>
  );
}
