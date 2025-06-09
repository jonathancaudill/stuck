import React, { useState, useEffect, useRef } from 'preact/compat';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { getDb } from './db';
import Placeholder from '@tiptap/extension-placeholder';
import './App.css';
import TextStyle from '@tiptap/extension-text-style';

import { getCurrentWindow } from '@tauri-apps/api/window';
import pinIcon from './assets/pin.svg';
import newFolderIcon from '../public/newfolder.svg';

import TitleSetter from './titlesetter';


function App() {
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [title, setTitle] = useState('');
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [fontSize, setFontSize] = useState('16px');
  const [uiFontSize, setUiFontSize] = useState(16);
  // === Drag and Folder Open State ===
  const [openFolders, setOpenFolders] = useState({});
  // === Custom Context Menu State ===
  const [ctxMenu, setCtxMenu] = useState({ visible: false, x: 0, y: 0, folder: null });
  // === Note Context Menu State ===
  const [noteCtxMenu, setNoteCtxMenu] = useState({ visible: false, x: 0, y: 0, note: null });

  const [isPinned, setIsPinned] = useState(false);

  const togglePin = async () => {
    console.log('togglepin called')
    const newPinned = !isPinned;
    const window = getCurrentWindow();
    await window.setAlwaysOnTop(newPinned);
    await window.setFocus();
    setIsPinned(newPinned);
  };

  // === Drag and Folder Handlers ===
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
  };

  const handleDragEnd = async (result) => {
    await origHandleDragEnd(result);
    // restore folder open state
    setOpenFolders(preDragOpenRef.current || {});
  };

  const handleDragUpdate = (update) => {
    if (!update.destination) return;
    const destFolder = update.destination.droppableId;
    setOpenFolders(prev => ({
      ...prev,
      [destFolder]: true
    }));
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

  // === Compact mode state ===
  const [isCompact, setIsCompact] = useState(false);
  const [isManuallyCompact, setIsManuallyCompact] = useState(false);

  // Add color scheme detection
  const [isDarkMode, setIsDarkMode] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => setIsDarkMode(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Helper function for text color
  const textColor = isDarkMode ? '#ffffff' : '#262626';
  const hoverBg = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const borderColor = isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)';

  useEffect(() => {
    const updateCompact = () => {
      if (isManuallyCompact) return;
      const { innerWidth: w, innerHeight: h } = window;
      const compact = w <= 400 && h <= 200;
      console.log(`updateCompact: width=${w}, height=${h}, isCompact=${compact}`);
      setIsCompact(compact);
    };
    window.addEventListener('resize', updateCompact);
    updateCompact();
    return () => window.removeEventListener('resize', updateCompact);
  }, [isManuallyCompact]);

  const toggleCompact = () => {
    setIsManuallyCompact(prev => !prev);
    setIsCompact(prev => !prev);
  };

  useEffect(() => {
    if (!isCompact) return;
    (async () => {
      const win = getCurrentWindow();
    })();
  }, [isCompact, title]);
  useEffect(() => {
    if (isAddingFolder && newFolderInputRef.current) {
      newFolderInputRef.current.focus();
    }
  }, [isAddingFolder]);

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
  // === Close Folder Context Menu on Click ===
  useEffect(() => {
    const handleClick = () => setCtxMenu({ visible: false, x: 0, y: 0, folder: null });
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);
  // === Close Note Context Menu on Click ===
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
      // Add 'folder' column to notes table if missing
      try {
        await db.execute("ALTER TABLE notes ADD COLUMN folder TEXT DEFAULT 'Default'");
      } catch (e) {
        // 'folder' column already exists, skipping
      }
      // Ensure notes table schema
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
      // Load folders from database
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
      // Default-select the most recently edited note if none is selected
      if (!selectedNote && parsedNotes.length > 0) {
        const firstNote = parsedNotes[0];
        setSelectedNote(firstNote);
        setTitle(firstNote.title);
        editor?.commands.setContent(firstNote.body);
      }
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
    // Update window title to [Untitled] for new note
    //     // Focus the title field for the new note
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

  const handleSelect = async (note) => {
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
    console.log('Saving title:', newTitle);
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

  const handleAddFolder = async () => {
    setNewFolderName('');
    setIsAddingFolder(true);
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    const name = newFolderName.trim();
    if (name && !folders.includes(name)) {
      const db = await getDb();
      await db.execute('INSERT INTO folders (name, order_idx) VALUES (?, ?)', [name, folders.length]);
      setFolders(prev => [...prev, name]);
      setSelectedFolder(name);
      setOpenFolders(prev => ({ ...prev, [name]: true }));
    }
    setIsAddingFolder(false);
  };

  const handleDeleteFolder = async (name) => {
    if (name === 'Default') return; // Prevent deleting default folder
    console.log('Deleting folder:', name);
    try {
      const db = await getDb();
      // Move notes to Default folder instead of deleting them
      await db.execute('UPDATE notes SET folder = ? WHERE folder = ?', ['Default', name]);
      await db.execute('DELETE FROM folders WHERE name = ?', [name]);
      console.log('SQL update complete for folder:', name);
    } catch (err) {
      console.error('Error updating folder:', err);
    }
    // Update React state
    setFolders(prevFolders => {
      const updated = prevFolders.filter(f => f !== name);
      // If the deleted folder was selected, switch to Default
      if (selectedFolder === name) {
        setSelectedFolder('Default');
      }
      return updated;
    });
    setNotes(prevNotes => prevNotes.map(n => 
      n.folder === name ? { ...n, folder: 'Default' } : n
    ));
    setOpenFolders(prevOpen => {
      const { [name]: _, ...rest } = prevOpen;
      return rest;
    });
  };

  return (
    <div
      className="app-root"
      style={{ display: 'flex', height: '100vh', position: 'relative' }}
    >
      <TitleSetter title={isCompact ? title : 'stuck.'} />
      <div style={{
        position: 'absolute',
        bottom: '8px',
        right: '8px',
        zIndex: 1000,
        display: 'flex',
        gap: '8px',
      }}>
        <div
          onClick={toggleCompact}
          className="action-button"
          style={{
            width: '22px',
            height: '22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px',
            borderRadius: '6px',
          }}
        >
          <span
            style={{
              fontFamily: 'sans-serif',
              fontWeight: '900',
              fontSize: '24px',
              lineHeight: '1',
              filter: isCompact
                ? 'drop-shadow(0 0 2px rgba(0,0,0,0.5)) brightness(0) invert(1)'
                : isDarkMode
                  ? 'brightness(0) invert(0.7)'
                  : 'brightness(0) invert(0.3)',
              opacity: isCompact ? 1 : 0.5,
              pointerEvents: 'none',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
            }}
          >
            {isCompact ? 'M' : 'm'}
          </span>
        </div>
        <div
          onClick={togglePin}
          className="action-button"
          style={{
            width: '22px',
            height: '22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px',
            borderRadius: '6px',
          }}
        >
          <img
            src={pinIcon}
            alt={isPinned ? 'Unpin' : 'Pin'}
            style={{
              width: '20px',
              height: '20px',
              filter: isPinned
                ? 'drop-shadow(0 0 2px rgba(0,0,0,0.5)) brightness(0) invert(1)'
                : isDarkMode
                  ? 'brightness(0) invert(0.7)'
                  : 'brightness(0) invert(0.3)',
              opacity: isPinned ? 1 : 0.5,
            }}
          />
        </div>
      </div>
      {!isCompact && (
        <aside style={{ width: '150px', minWidth: '150px', flexShrink: 0, position: 'relative' }}>
          <DragDropContext 
            onDragStart={handleDragStart} 
            onDragEnd={handleDragEnd}
            onDragUpdate={handleDragUpdate}
          >
            <div className="sidebar-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
              {isAddingFolder ? (
                <form onSubmit={handleCreateFolder} style={{ padding: '8px' }}>
                  <input
                    ref={newFolderInputRef}
                    type="text"
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    placeholder="Folder name"
                    style={{
                      width: '100%',
                      padding: '4px 8px',
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '4px',
                      color: 'white',
                      fontSize: uiFontSize + 'px'
                    }}
                  />
                </form>
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
                  <button
                    onClick={handleAddFolder}
                    className="new-folder-button"
                    style={{
                      color: 'white',
                      background: 'none',
                      border: 'none',
                      padding: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '22px',
                      height: '22px',
                    }}
                  >
                    <img
                      src={newFolderIcon}
                      alt="New Folder"
                      style={{
                        width: '20px',
                        height: '20px',
                        filter: isDarkMode
                          ? 'brightness(0) invert(0.7)'
                          : 'brightness(0) invert(0.3)',
                        opacity: 0.5,
                      }}
                    />
                  </button>
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
                        e.stopPropagation();
                        // Only show folder context menu if clicking on the folder header
                        if (e.target.closest('[data-folder-header]')) {
                          setCtxMenu({ visible: true, x: e.clientX, y: e.clientY, folder });
                          setNoteCtxMenu({ visible: false, x: 0, y: 0, note: null });
                        }
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
                          data-folder-header
                          style={{
                            padding: '8px',
                            background: selectedFolder === folder ? hoverBg : 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                          onClick={() => {
                            setOpenFolders(prev => ({
                              ...prev,
                              [folder]: !prev[folder]
                            }));
                            setSelectedFolder(folder);
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '0.8em', color: textColor }}>{openFolders[folder] ? '▼' : '▶'}</span>
                            <span style={{ fontSize: uiFontSize + 'px', color: textColor }}>{folder}</span>
                          </div>
                        </div>
                      )}
                      {/* Only show notes if folder is open */}
                      {openFolders[folder] && (
                        <div className="folder-content open">
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
                                          e.stopPropagation();
                                          setNoteCtxMenu({ visible: true, x: e.clientX, y: e.clientY, note: note.id });
                                          setCtxMenu({ visible: false, x: 0, y: 0, folder: null });
                                        }}
                                        style={{
                                          ...providedStyle,
                                          transform: `translate(0px, ${y})`,
                                          padding: '8px',
                                          paddingLeft: '12px',
                                          borderLeft: `2px solid ${borderColor}`,
                                          cursor: snapshot.isDragging ? 'grabbing' : 'pointer',
                                          background: selectedNote?.id === note.id ? hoverBg : 'transparent',
                                          borderBottom: `1px solid ${borderColor}`,
                                          fontSize: '0.9rem',
                                          lineHeight: '1.2rem',
                                          color: textColor,
                                        }}
                                      >
                                        <div style={{ fontWeight: 'bold', color: textColor }}>{note.title || '[Untitled]'}</div>
                                        <div style={{ fontSize: '0.8em', opacity: 0.7, color: textColor }}>
                                          {new Date(note.last_edited).toLocaleDateString()}
                                        </div>
                                      </div>
                                    );
                                  }}
                                </Draggable>
                              ))
                          )}
                        </div>
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              ))}
            </div>
          </DragDropContext>
        </aside>
      )}
      <main style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {!isCompact && (
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
              color: textColor,
            }}
          />
        )}
        <div 
          style={{ flexGrow: 1 }}
          onClick={() => editor?.commands.focus()}
        >
          <EditorContent editor={editor} />
        </div>
      </main>
      {/* Folder context menu */}
      {ctxMenu.visible && ctxMenu.folder && (
        <ul style={{
          position: 'fixed',
          top: ctxMenu.y + 'px',
          left: ctxMenu.x + 'px',
          background: isDarkMode ? '#333' : '#fff',
          color: isDarkMode ? 'white' : '#222',
          listStyle: 'none',
          padding: '4px 0',
          margin: 0,
          borderRadius: '4px',
          boxShadow: isDarkMode
            ? '0 2px 8px rgba(0,0,0,0.5)'
            : '0 2px 8px rgba(0,0,0,0.12)',
          zIndex: 9999,
          border: isDarkMode ? '1px solid #444' : '1px solid #ddd',
        }}>
          <li
            style={{ padding: '4px 12px', cursor: 'pointer', userSelect: 'none' }}
            onClick={(e) => {
              e.stopPropagation();
              setEditingFolder(ctxMenu.folder);
              setEditingName(ctxMenu.folder);
              setCtxMenu({ ...ctxMenu, visible: false });
            }}
            onMouseOver={e => e.currentTarget.style.background = isDarkMode ? '#444' : '#f0f0f0'}
            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
          >
            Rename Folder
          </li>
          {ctxMenu.folder !== 'Default' && (
            <li
              style={{ padding: '4px 12px', cursor: 'pointer', color: isDarkMode ? '#ff6b6b' : '#c00', userSelect: 'none' }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDeleteFolder(ctxMenu.folder);
                setCtxMenu({ ...ctxMenu, visible: false });
              }}
              onMouseOver={e => e.currentTarget.style.background = isDarkMode ? '#444' : '#f0f0f0'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >
              Delete Folder
            </li>
          )}
        </ul>
      )}
      {/* Note context menu */}
      {noteCtxMenu.visible && noteCtxMenu.note && (
        <ul style={{
          position: 'fixed',
          top: noteCtxMenu.y + 'px',
          left: noteCtxMenu.x + 'px',
          background: isDarkMode ? '#333' : '#fff',
          color: isDarkMode ? 'white' : '#222',
          listStyle: 'none',
          padding: '4px 0',
          margin: 0,
          borderRadius: '4px',
          boxShadow: isDarkMode
            ? '0 2px 8px rgba(0,0,0,0.5)'
            : '0 2px 8px rgba(0,0,0,0.12)',
          zIndex: 9999,
          border: isDarkMode ? '1px solid #444' : '1px solid #ddd',
        }}>
          <li
            style={{ padding: '4px 12px', cursor: 'pointer', color: isDarkMode ? '#ff6b6b' : '#c00', userSelect: 'none' }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const noteToDelete = notes.find(n => n.id === noteCtxMenu.note);
              if (noteToDelete) {
                handleDelete(noteToDelete);
              }
              setNoteCtxMenu({ ...noteCtxMenu, visible: false });
            }}
            onMouseOver={e => e.currentTarget.style.background = isDarkMode ? '#444' : '#f0f0f0'}
            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
          >
            Delete Note
          </li>
        </ul>
      )}
    </div>
  );
}

export default App;