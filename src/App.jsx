import React, { useState, useEffect, useRef } from 'preact/compat';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
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
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [fontSize, setFontSize] = useState('16px');
  const [uiFontSize, setUiFontSize] = useState(16);
  // --- DRAG AND FOLDER OPEN STATE ---
  const [openFolders, setOpenFolders] = useState({});
  // --- CUSTOM CONTEXT MENU STATE ---
  const [ctxMenu, setCtxMenu] = useState({ visible: false, x: 0, y: 0, folder: null });
  // --- NOTE CONTEXT MENU STATE ---
  const [noteCtxMenu, setNoteCtxMenu] = useState({ visible: false, x: 0, y: 0, note: null });

  // --- DRAG AND FOLDER OPEN STATE HANDLERS ---
  const preDragOpenRef = useRef({});

  const origHandleDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    const srcFolder = source.droppableId;
    const destFolder = destination.droppableId;
    setNotes(prev => {
      // Only reorder notes of that folder, but reconstruct the full array.
      const notesByFolder = prev.filter(n => n.folder === srcFolder);
      const moved = notesByFolder.splice(source.index, 1)[0];
      moved.folder = destFolder;
      notesByFolder.splice(destination.index, 0, moved);
      // Remove moved note from prev, then insert updated
      const others = prev.filter(n => n.id !== draggableId);
      return [...others, moved];
    });
    // Persist folder change
    const db = await getDb();
    await db.execute('UPDATE notes SET folder = ? WHERE id = ?', [destFolder, draggableId]);
  };

  const handleDragStart = () => {
    preDragOpenRef.current = openFolders;
    // open all folders during drag
    const allOpen = {};
    folders.forEach(f => { allOpen[f] = true; });
    setOpenFolders(allOpen);
  };

  const handleDragEnd = async (result) => {
    await origHandleDragEnd(result);
    // restore folder open state
    setOpenFolders(preDragOpenRef.current || {});
  };
  // --- INLINE FOLDER CREATION STATE ---
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  // --- INLINE FOLDER EDITING STATE ---
  const [editingFolder, setEditingFolder] = useState(null);
  const [editingName, setEditingName] = useState('');
  // Ref to focus the new-folder input
  const newFolderInputRef = useRef(null);
  // Ref to focus the title input on new note
  const titleInputRef = useRef(null);
  useEffect(() => {
    if (isAddingFolder && newFolderInputRef.current) {
      newFolderInputRef.current.focus();
    }
  }, [isAddingFolder]);


  const handleAddFolder = () => {
    setNewFolderName('');
    setIsAddingFolder(true);
  };

  // Delete folder: log, delete from db, update state, handle selection
  const handleDeleteFolder = async (name) => {
    console.log('Deleting folder:', name);
    try {
      const db = await getDb();
      await db.execute('DELETE FROM folders WHERE name = ?', [name]);
      await db.execute('DELETE FROM notes WHERE folder = ?', [name]);
      console.log('SQL deletion complete for folder and its notes:', name);
    } catch (err) {
      console.error('Error deleting folder or notes:', err);
    }
    // Update React state
    setFolders(prevFolders => {
      const updated = prevFolders.filter(f => f !== name);
      // If the deleted folder was selected, pick a new one
      if (selectedFolder === name) {
        setSelectedFolder(updated[0] || null);
      }
      return updated;
    });
    setNotes(prevNotes => prevNotes.filter(n => n.folder !== name));
    setOpenFolders(prevOpen => {
      const updated = { ...prevOpen };
      delete updated[name];
      return updated;
    });
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.metaKey && (e.key === '+' || e.key === '=')) {
        setUiFontSize(size => size + 1);
      }
      if (e.metaKey && e.key === '-') {
        setUiFontSize(size => size - 1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  // --- CLOSE CONTEXT MENU ON CLICK ---
  useEffect(() => {
    const handleClick = () => setCtxMenu({ visible: false, x: 0, y: 0, folder: null });
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);
  // --- CLOSE NOTE CONTEXT MENU ON CLICK ---
  useEffect(() => {
    const handleClick = () => setNoteCtxMenu({ visible: false, x: 0, y: 0, note: null });
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Placeholder.configure({
        placeholder: 'write a new note :3',
        showOnlyWhenEditable: true,
        placeholderClass: 'placeholder',
      })
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
  // Load notes and folders on mount
  useEffect(() => {
    (async () => {
      const db = await getDb();
      // Try to add the folder column if missing
      try {
        await db.execute("ALTER TABLE notes ADD COLUMN folder TEXT DEFAULT 'Default'");
      } catch (e) {
        // column already exists
      }
      // Use original schema for new tables
      await db.execute(`
        CREATE TABLE IF NOT EXISTS notes (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          last_edited TEXT NOT NULL
        )
      `);
      // Ensure folders table exists
      await db.execute(`
        CREATE TABLE IF NOT EXISTS folders (
          name TEXT PRIMARY KEY,
          order_idx INTEGER
        )
      `);
      // Load folders
      const folderRows = await db.select('SELECT name FROM folders ORDER BY order_idx ASC');
      let folderList = folderRows.map(r => r.name);
      if (folderList.length === 0) {
        folderList = ['Default'];
        await db.execute('INSERT INTO folders (name, order_idx) VALUES (?, ?)', ['Default', 0]);
      }
      setFolders(folderList);
      setSelectedFolder(folderList[0]);
      // Then load notes as before and parse row.folder
      const rows = await db.select('SELECT * FROM notes ORDER BY last_edited DESC');
      const parsedNotes = rows.map(row => ({
        ...row,
        folder: row.folder || 'Default'
      }));
      setNotes(parsedNotes);
    })();
  }, []);

  const handleNew = async () => {
    console.log('Creating new note');
    const newNote = {
      id: crypto.randomUUID(),
      title: '',
      body: editor?.getHTML() || '',
      last_edited: new Date().toISOString(),
      folder: selectedFolder
    };

    const db = await getDb();

    await db.execute(
      'INSERT INTO notes (id, title, body, last_edited, folder) VALUES (?, ?, ?, ?, ?)',
      [newNote.id, newNote.title, newNote.body, newNote.last_edited, selectedFolder]
    );

    setNotes((prevNotes) => [newNote, ...prevNotes]);
    setSelectedNote(newNote);
    setTitle('');
    editor?.commands.setContent('');
    // Focus the title field for the new note
    if (titleInputRef.current) {
      titleInputRef.current.focus();
    }
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
    if (!selectedNote || note.id !== selectedNote.id) {
      setSelectedNote(note);
      setTitle(note.title);
      editor.commands.setContent(note.body);
    }
  };

  const handleDelete = async (note) => {
    console.log('Deleting note:', note.id, note.title);
    const db = await getDb();
    const currentIndex = notes.findIndex(n => n.id === note.id);
    await db.execute('DELETE FROM notes WHERE id = ?', [note.id]);
    const rows = await db.select('SELECT * FROM notes ORDER BY last_edited DESC');
    const parsedRows = rows.map(row => ({
      ...row,
      folder: row.folder || 'Default'
    }));
    setNotes(parsedRows);
    // Determine the next note index: prefer the same index, else fall back to previous
    let nextIndex = currentIndex;
    if (nextIndex >= parsedRows.length) {
      nextIndex = parsedRows.length - 1;
    }
    if (nextIndex >= 0) {
      const nextNote = parsedRows[nextIndex];
      setSelectedNote(nextNote);
      setTitle(nextNote.title);
      editor.commands.setContent(nextNote.body);
    } else {
      // No notes left
      setSelectedNote(null);
      setTitle('');
      editor.commands.setContent('');
    }
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
    <div
    className= "app-root"
      style={{ display: 'flex', height: '100vh', position: 'relative' }}
    >
      <aside style={{ width: '150px', minWidth: '150px', flexShrink: 0, position: 'relative' }}>
        <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="sidebar-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
            {isAddingFolder ? (
              <input
                ref={newFolderInputRef}
                type="text"
                autoFocus
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    (async () => {
                      const name = newFolderName.trim();
                      if (name && !folders.includes(name)) {
                        const db = await getDb();
                        const order = folders.length;
                        await db.execute('INSERT INTO folders (name, order_idx) VALUES (?, ?)', [name, order]);
                        const updated = [name, ...folders];
                        setFolders(updated);
                        setSelectedFolder(name);
                        setOpenFolders(prev => ({ ...prev, [name]: true }));
                      }
                      setIsAddingFolder(false);
                    })();
                  } else if (e.key === 'Escape') {
                    setIsAddingFolder(false);
                  }
                }}
                onBlur={() => setIsAddingFolder(false)}
                style={{
                  padding: '6px 8px',
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'white',
                  fontWeight: 'bold',
                }}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 5px',
                  color: 'white',
                  borderBottom: '1px solid rgba(255,255,255,0.2)',
                }}
              >
                <div
                  onClick={handleNew}
                  className="action-button"
                  style={{
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    padding: '0px 6px',
                    marginLeft: '-4px',
                    borderRadius: '4px',
                  }}
                >
                  New Note + 
                </div>
                <div
                  style={{
                    width: '1px',
                    height: '16px',
                    marginLeft: '-2px',
                    background: 'rgba(255,255,255,0.2)',
                  }}
                />
                <img
                  src="/newfolder.svg"
                  alt="New Folder"
                  onClick={handleAddFolder}
                  className="action-button"
                  style={{
                    width: '19px',
                    height: '19px',
                    filter: 'brightness(0) invert(1)',
                    cursor: 'pointer',
                    marginLeft: '-3px',
                    padding: '4px',
                    borderRadius: '4px',
                  }}
                />
              </div>
            )}
            {folders.map(folder => (
              <Droppable droppableId={folder} key={folder}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    data-folder={folder}
                    onContextMenu={e => {
                      e.preventDefault();
                      setCtxMenu({ visible: true, x: e.clientX, y: e.clientY, folder });
                    }}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}
                  >
                    {editingFolder === folder ? (
                      <input
                        type="text"
                        autoFocus
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            (async () => {
                              const name = editingName.trim();
                              if (name && !folders.includes(name)) {
                                const db = await getDb();
                                await db.execute('UPDATE folders SET name = ? WHERE name = ?', [name, folder]);
                                setFolders(prev => prev.map(f => f === folder ? name : f));
                                setNotes(prev => prev.map(n =>
                                  n.folder === folder ? { ...n, folder: name } : n
                                ));
                                if (selectedFolder === folder) setSelectedFolder(name);
                                setOpenFolders(prev => {
                                  const { [folder]: wasOpen, ...rest } = prev;
                                  return { ...rest, [name]: wasOpen };
                                });
                              }
                            })();
                            setEditingFolder(null);
                          } else if (e.key === 'Escape') {
                            setEditingFolder(null);
                          }
                        }}
                        onBlur={() => setEditingFolder(null)}
                        style={{
                          padding: '6px 8px',
                          width: '100%',
                          boxSizing: 'border-box',
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          color: 'white',
                          fontWeight: 'bold'
                        }}
                      />
                    ) : (
                      <div
                        onClick={() => {
                          setSelectedFolder(folder);
                          setOpenFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
                        }}
                        style={{
                          padding: '6px 8px',
                          cursor: 'pointer',
                          background: selectedFolder === folder ? '#ffffff1a' : 'transparent',
                          fontWeight: 'bold',
                          color: 'white'
                        }}
                      >
                        {folder} {openFolders[folder] ? '▾' : '▸'}
                      </div>
                    )}
                    <div className={`folder-content${openFolders[folder] ? ' open' : ''}`}>
                      <div style={{ minHeight: '40px' }}>
                        {notes.filter(note => note.folder === folder).length === 0 ? (
                          <div style={{ color: 'lightgray', padding: '8px' }}>
                            drag a note here.
                          </div>
                        ) : (
                          notes
                            .filter(note => note.folder === folder)
                            .map((note, idx) => (
                              <Draggable key={note.id} draggableId={note.id} index={idx}>
                                {(provided, snapshot) => {
                                  const providedStyle = provided.draggableProps.style || {};
                                  const transform = providedStyle.transform || '';
                                  const yMatch = transform.match(/translate\(.*px,\s*([-\d.]+)px\)/);
                                  const y = yMatch ? `${yMatch[1]}px` : '0px';
                                  return (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      onClick={() => { setSelectedFolder(folder); handleSelect(note); }}
                                      onContextMenu={e => {
                                        e.preventDefault();
                                        setNoteCtxMenu({ visible: true, x: e.clientX, y: e.clientY, note: note.id });
                                      }}
                                      style={{
                                        ...providedStyle,
                                        transform: `translate(0px, ${y})`,
                                        padding: '8px',
                                        paddingLeft: '12px',
                                        borderLeft: '2px solid rgba(255,255,255,0.2)',
                                        cursor: snapshot.isDragging ? 'grabbing' : 'pointer',
                                        background: selectedNote?.id === note.id ? '#ffffff1a' : '#ffffff08',
                                        borderBottom: '1px solid rgba(255,255,255,0.2)',
                                        fontSize: '0.9rem',
                                        lineHeight: '1.2rem',
                                        color: 'white',
                                      }}
                                    >
                                      <strong>{note.title || '[Untitled]'}</strong>
                                      <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                                        {(() => {
                                          const d = new Date(note.last_edited);
                                          const today = new Date();
                                          const isToday = d.toDateString() === today.toDateString();
                                          return isToday
                                            ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                            : d.toLocaleDateString();
                                        })()}
                                      </div>
                                    </div>
                                  );
                                }}
                              </Draggable>
                            ))
                        )}
                      </div>
                    </div>
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>
      </aside>
      <main style={{ flex: 1, padding: '8px', display: 'flex', flexDirection: 'column' }}>
        
        <input
          ref={titleInputRef}
          type="text"
          placeholder="Title"
          value={title}
          onChange={handleTitleChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              editor?.commands.focus();
            }
          }}
          style={{
            marginTop: '10px',
            marginBottom: '8px',
            fontSize: uiFontSize + 'px',
            outline: 'none',
            border: 'none',
            background: 'transparent',
            color: 'white',
          }}
        />
        
        <div
          style={{ flex: 1, overflow: 'auto' }}
          onClick={() => editor && editor.commands.focus()}
        >
          {editor ? (
            <EditorContent
              editor={editor}
              className="tiptap"
              style={{
                flex: 1,
                minHeight: '100%',
                padding: '8px',
                outline: 'none',
                fontFamily: 'Akzidenz-Grotesk, sans-serif',
                color: 'white',
                fontSize: uiFontSize + 'px',
                lineHeight: (uiFontSize * 1.5) + 'px',
              }}
            />
          ) : (
            <p>Loading editor…</p>
          )}
        </div>
        <div style={{ marginTop: '8px' }}>
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
      {/* Context menu for notes */}
      {noteCtxMenu.visible && (
        <ul style={{
          position: 'fixed',
          top: noteCtxMenu.y + 'px',
          left: noteCtxMenu.x + 'px',
          background: '#333',
          color: 'white',
          listStyle: 'none',
          padding: '4px 0',
          margin: 0,
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.5)'
        }}>
          <li
            style={{ padding: '4px 12px', cursor: 'pointer' }}
            onMouseDown={e => {
              e.preventDefault();
              e.stopPropagation();
              const noteObj = notes.find(n => n.id === noteCtxMenu.note);
              if (noteObj) handleDelete(noteObj);
              setNoteCtxMenu({ visible: false, x: 0, y: 0, note: null });
            }}
          >
            Delete Note
          </li>
        </ul>
      )}
      {/* Context menu for folders */}
      {ctxMenu.visible && (
        <ul style={{
          position: 'fixed',
          top: ctxMenu.y + 'px',
          left: ctxMenu.x + 'px',
          background: '#333',
          color: 'white',
          listStyle: 'none',
          padding: '4px 0',
          margin: 0,
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.5)'
        }}>
          <li
            style={{ padding: '4px 12px', cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              setEditingFolder(ctxMenu.folder);
              setEditingName(ctxMenu.folder);
              setCtxMenu({ ...ctxMenu, visible: false });
            }}
          >
            Rename Folder
          </li>
          <li
            style={{ padding: '4px 12px', cursor: 'pointer' }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Context menu: Deleting folder', ctxMenu.folder);
              handleDeleteFolder(ctxMenu.folder);
              setCtxMenu({ ...ctxMenu, visible: false });
            }}
          >
            Delete Folder
          </li>
        </ul>
      )}
    </div>
  );
}

export default App;