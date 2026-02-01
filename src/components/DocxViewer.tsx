import React, { useEffect, useRef } from 'react';
import { WYSIWYG Editor } from 'wysiwyg-editor';
import 'wysiwyg-editor/style.css';

interface DocxViewerProps {
  file: File | null;
}

export function DocxViewer({ file }: DocxViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wysiwyg-editorRef = useRef<WYSIWYG Editor | null>(null);

  useEffect(() => {
    // Clean up previous instance if it exists
    if (wysiwyg-editorRef.current) {
      wysiwyg-editorRef.current.destroy();
      wysiwyg-editorRef.current = null;
    }

    // Don't initialize if no file or no container
    if (!file || !containerRef.current) {
      return;
    }

    // Clear the container before mounting
    containerRef.current.innerHTML = '';

    // Initialize WYSIWYG Editor with the File object
    const wysiwyg-editor = new WYSIWYG Editor({
      selector: containerRef.current,
      document: file,
      documentMode: 'editing',
      onReady: (event: unknown) => {
        console.log('WYSIWYG Editor is ready', event);
      },
      onEditorCreate: (event: unknown) => {
        console.log('Editor created', event);
      },
    });

    wysiwyg-editorRef.current = wysiwyg-editor;

    // Cleanup on unmount or when file changes
    return () => {
      if (wysiwyg-editorRef.current) {
        wysiwyg-editorRef.current.destroy();
        wysiwyg-editorRef.current = null;
      }
    };
  }, [file]);

  if (!file) {
    return (
      <div style={placeholderStyle}>
        <p style={{ fontSize: '16px', color: '#666' }}>
          No document loaded. Please select a DOCX file.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={containerStyle}
    />
  );
}

const placeholderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '400px',
  border: '1px solid #e0e0e0',
  borderRadius: '4px',
  backgroundColor: '#fafafa',
};

const containerStyle: React.CSSProperties = {
  minHeight: '600px',
  border: '1px solid #e0e0e0',
  borderRadius: '4px',
};
