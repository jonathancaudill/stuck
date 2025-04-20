import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { getDb } from './db';
import Placeholder from '@tiptap/extension-placeholder';
import './App.css';
import TextStyle from '@tiptap/extension-text-style';


function App() {
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [title, setTitle] = useState('');
  const [fontSize, setFontSize] = useState('16px');
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Placeholder.configure({ placeholder: 'Start typing…' })
    ],
    content: '',
    editable: true,
    onCreate: ({ editor }) => {
      editor.chain().focus().run();
    },
    onUpdate: async ({ editor }) => {
      if (!selectedNote) return;
      const content = editor.getHTML();
      const db = await getDb();
      const now = new Date().toISOString();
      await db.execute(
        'UPDATE notes SET body = ?, last_edited = ? WHERE id = ?',
        [content, now, selectedNote.id]
      );
      setNotes(prev =>
        prev.map(note =>
          note.id === selectedNote.id
            ? { ...note, body: content, last_edited: now }
            : note
        )
      );
    },
  });
  // Load notes on mount
  useEffect(() => {
    (async () => {
      const db = await getDb();
      await db.execute(`
        CREATE TABLE IF NOT EXISTS notes (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          last_edited TEXT NOT NULL
        )
      `);
      const rows = await db.select('SELECT * FROM notes ORDER BY last_edited DESC');
      setNotes(rows);
    })();
  }, []);

  const handleNew = async () => {
    console.log('Creating new note');
    const newNote = {
      id: crypto.randomUUID(),
      title: '',
      body: editor?.getHTML() || '',
      last_edited: new Date().toISOString()
    };
  
    const db = await getDb();
  
    await db.execute(
      'INSERT INTO notes (id, title, body, last_edited) VALUES (?, ?, ?, ?)',
      [newNote.id, newNote.title, newNote.body, newNote.last_edited]
    );
  
    setNotes((prevNotes) => [newNote, ...prevNotes]);
    setSelectedNote(newNote);
    setTitle('');
    editor?.commands.setContent('');
  };

  const handleSave = async () => {
    if (!selectedNote) return;
  
    const db = await getDb();
    const updatedContent = editor?.getHTML() || '';
    const updatedTitle = title;
    const now = new Date().toISOString();
  
    await db.execute(
      'UPDATE notes SET title = ?, body = ?, last_edited = ? WHERE id = ?',
      [updatedTitle, updatedContent, now, selectedNote.id]
    );
  
    // Update local state
    setNotes((prevNotes) =>
      prevNotes
        .map((note) =>
          note.id === selectedNote.id
            ? { ...note, title: updatedTitle, body: updatedContent, last_edited: now }
            : note
        )
        .sort((a, b) => new Date(b.last_edited) - new Date(a.last_edited))
    );
  };

  const handleSelect = (note) => {
    setSelectedNote(note);
    setTitle(note.title);
    editor.commands.setContent(note.body);
  };

  const handleDelete = async (note) => {
    const db = await getDb();
    await db.execute('DELETE FROM notes WHERE id = ?', [note.id]);
    const rows = await db.select('SELECT * FROM notes ORDER BY created_at DESC');
    setNotes(rows);
    handleNew();
  };

  const handleTitleChange = async (e) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (!selectedNote) return;
    const db = await getDb();
    const now = new Date().toISOString();
    await db.execute(
      'UPDATE notes SET title = ?, last_edited = ? WHERE id = ?',
      [newTitle, now, selectedNote.id]
    );
    setNotes(prev =>
      prev.map(note =>
        note.id === selectedNote.id
          ? { ...note, title: newTitle, last_edited: now }
          : note
      )
    );
  };

  return (
    <div style={{ display: 'flex', height: '100vh', position: 'relative' }}>
      <aside style={{ width: '150px', minWidth: '150px', flexShrink: 0, position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
          {notes.map((note) => (
            <div
              key={note.id}
              onClick={() => handleSelect(note)}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: 0,
                background: selectedNote?.id === note.id ? '#ffffff1a' : '#ffffff08',
                borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
                cursor: 'pointer',
                transition: 'background 0.2s',
                fontSize: '0.9rem',
                lineHeight: '1.2rem',
                color: 'white',
              }}
            >
              <strong>{note.title || '[Untitled]'}</strong>
              <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                {(() => {
                  const editedDate = new Date(note.last_edited);
                  const today = new Date();
                  const isToday = editedDate.toDateString() === today.toDateString();
                  return isToday
                    ? editedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : editedDate.toLocaleDateString();
                })()}
              </div>
            </div>
          ))}
        </div>
      </aside>
      <main style={{ flex: 1, padding: '8px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: '8px' }}>
          <label style={{ color: 'white', marginRight: '8px' }}>Font Size:</label>
          <select
            value={fontSize}
          onChange={(e) => {
            const size = e.target.value;
            setFontSize(size);
            editor.chain().focus().setTextStyle({ fontSize: size }).run();
          }}
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: 'white',
              border: 'none',
              padding: '4px',
              borderRadius: '4px',
            }}
          >
            <option value="12px">12px</option>
            <option value="14px">14px</option>
            <option value="16px">16px</option>
            <option value="18px">18px</option>
            <option value="24px">24px</option>
            <option value="32px">32px</option>
          </select>
        </div>
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={handleTitleChange}
          style={{
            marginBottom: '8px',
            fontSize: '1.2rem',
            outline: 'none',
            border: 'none',
            background: 'transparent',
            color: 'white',
          }}
        />
        <div style={{ flex: 1, overflow: 'auto' }}>
          {editor ? (
            <EditorContent
              editor={editor}
              style={{
                flex: 1,
                minHeight: '100%',
                padding: '8px',
                outline: 'none',
                fontFamily: 'Akzidenz-Grotesk, sans-serif',
                color: 'white',
                fontSize: '16px',
              }}
            />
          ) : (
            <p>Loading editor…</p>
          )}
        </div>
        <div style={{ marginTop: '8px' }}>
          <button onClick={handleSave}>
            {selectedNote ? 'Save Note' : 'Create Note'}
          </button>
          {selectedNote && (
            <button
              onClick={() => handleDelete(selectedNote)}
              style={{ marginLeft: '8px' }}
            >
              Delete
            </button>
          )}
        </div>
      </main>
      <button
        onClick={handleNew}
        style={{
          position: 'absolute',
          bottom: '16px',
          right: '16px',
          border: 'none',
          background: 'rgba(255, 255, 255, 0.1)',
          color: 'white',
          padding: '6px 12px',
          borderRadius: '6px',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          cursor: 'pointer',
        }}
      >
        New Note
      </button>
    </div>
  );
}

export default App;