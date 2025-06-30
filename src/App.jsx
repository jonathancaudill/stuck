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
    
    // Update the notes array
    setNotes(prev => {
      // Find the note being moved
      const noteToMove = prev.find(n => n.id.toString() === draggableId);
      if (!noteToMove) return prev;
      
      // Create a new array without the moved note
      const notesWithoutMoved = prev.filter(n => n.id.toString() !== draggableId);
      
      // Create the updated note with the new folder
      const updatedNote = { ...noteToMove, folder: destFolder };
      
      // Return the new array with the updated note
      return [...notesWithoutMoved, updatedNote];
    });

    // Update selected folder to match the destination
    setSelectedFolder(destFolder);

    // Persist folder change in database
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
      // Font size shortcuts
      if (e.metaKey && (e.key === '+' || e.key === '=')) {
        setUiFontSize(size => size + 1);
      }
      if (e.metaKey && e.key === '-') {
        setUiFontSize(size => size - 1);
      }
      
      // New note shortcut (⌘N)
      if (e.metaKey && e.key === 'n') {
        e.preventDefault();
        handleNew();
      }
      
      // Save shortcut (⌘S)
      if (e.metaKey && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      
      // Delete note shortcut (⌘⌫)
      if (e.metaKey && e.key === 'Backspace') {
        e.preventDefault();
        if (selectedNote) {
          handleDelete(selectedNote);
        }
      }
      
      // Toggle compact mode (⌘M)
      if (e.metaKey && e.key === 'm') {
        e.preventDefault();
        toggleCompact();
      }
      
      // Toggle pin (⌘P)
      if (e.metaKey && e.key === 'p') {
        e.preventDefault();
        togglePin();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedNote]); // Add selectedNote as dependency since it's used in the handler
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
      
      try {
        // Load folders from database
        const folderRows = await db.select('SELECT name FROM folders ORDER BY order_idx ASC');
        let folderList = folderRows.map(r => r.name);
        
        // Always ensure default folders exist
        if (!folderList.includes('Default') || !folderList.includes('Trash')) {
          await db.execute(`
            INSERT OR IGNORE INTO folders (name, order_idx) VALUES 
            ('Default', 0),
            ('Trash', 999)
          `);
          // Reload folders after ensuring defaults exist
          const updatedFolderRows = await db.select('SELECT name FROM folders ORDER BY order_idx ASC');
          folderList = updatedFolderRows.map(r => r.name);
        }
        
        setFolders(folderList);
        setSelectedFolder(folderList[0] || 'Default');
        
        // Initialize open folders state
        const initialOpenFolders = {};
        folderList.forEach(folder => {
          initialOpenFolders[folder] = true; // Open all folders by default
        });
        setOpenFolders(initialOpenFolders);
        
        // Load notes
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
      } catch (error) {
        console.error('Error loading data:', error);
      }
    })();
  }, []);

  const handleNew = async () => {
    console.log('Creating new note');
    const now = new Date().toISOString();
    const newNote = {
      id: null, // Let SQLite auto-generate the ID
      title: '',
      body: editor?.getHTML() || '',
      created_at: now,
      last_edited: now,
      folder: selectedFolder
    };

    console.log('New note object:', newNote);
    const db = await getDb();
    console.log('Got database connection');

    try {
      console.log('Executing INSERT query...');
      await db.execute(
        'INSERT INTO notes (title, body, created_at, last_edited, folder) VALUES (?, ?, ?, ?, ?)',
        [newNote.title, newNote.body, newNote.created_at, newNote.last_edited, selectedFolder]
      );
      console.log('INSERT query executed successfully');

      console.log('Fetching inserted note...');
      const result = await db.select('SELECT * FROM notes WHERE created_at = ?', [now]);
      console.log('Query result:', result);
      const insertedNote = result[0];

      if (insertedNote) {
        console.log('Successfully retrieved inserted note:', insertedNote);
        setNotes((prevNotes) => [insertedNote, ...prevNotes]);
        setSelectedNote(insertedNote);
        setTitle('');
        editor?.commands.setContent('');
        if (titleInputRef.current) {
          titleInputRef.current.focus();
        }
      } else {
        console.error('Failed to retrieve inserted note - result was empty');
      }
    } catch (error) {
      console.error('Error creating new note:', error);
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
    console.log('Moving note to trash:', note.id, note.title);
    const db = await getDb();
    const now = new Date().toISOString();
    
    // Move note to Trash folder and set deleted_at timestamp
    await db.execute(
      'UPDATE notes SET folder = ?, deleted_at = ? WHERE id = ?',
      ['Trash', now, note.id]
    );
    
    const rows = await db.select('SELECT * FROM notes ORDER BY last_edited DESC');
    const parsedRows = rows.map(row => ({
      ...row,
      folder: row.folder || 'Default'
    }));
    setNotes(parsedRows);
    
    // If the deleted note was selected, select another note
    if (selectedNote?.id === note.id) {
      const nextNote = parsedRows.find(n => n.id !== note.id);
      if (nextNote) {
        setSelectedNote(nextNote);
        setTitle(nextNote.title);
        editor.commands.setContent(nextNote.body);
      } else {
        setSelectedNote(null);
        setTitle('');
        editor.commands.setContent('');
      }
    }
  };

  const handleRestore = async (note) => {
    console.log('Restoring note:', note.id, note.title);
    const db = await getDb();
    
    // Move note back to Default folder and clear deleted_at
    await db.execute(
      'UPDATE notes SET folder = ?, deleted_at = NULL WHERE id = ?',
      ['Default', note.id]
    );
    
    const rows = await db.select('SELECT * FROM notes ORDER BY last_edited DESC');
    const parsedRows = rows.map(row => ({
      ...row,
      folder: row.folder || 'Default'
    }));
    setNotes(parsedRows);
  };

  const handlePermanentDelete = async (note) => {
    console.log('Permanently deleting note:', note.id, note.title);
    const db = await getDb();
    await db.execute('DELETE FROM notes WHERE id = ?', [note.id]);
    
    const rows = await db.select('SELECT * FROM notes ORDER BY last_edited DESC');
    const parsedRows = rows.map(row => ({
      ...row,
      folder: row.folder || 'Default'
    }));
    setNotes(parsedRows);
    
    if (selectedNote?.id === note.id) {
      const nextNote = parsedRows.find(n => n.id !== note.id);
      if (nextNote) {
        setSelectedNote(nextNote);
        setTitle(nextNote.title);
        editor.commands.setContent(nextNote.body);
      } else {
        setSelectedNote(null);
        setTitle('');
        editor.commands.setContent('');
      }
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
      // Move notes to Trash folder instead of Default
      await db.execute('UPDATE notes SET folder = ?, deleted_at = ? WHERE folder = ?', 
        ['Trash', new Date().toISOString(), name]);
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
      n.folder === name ? { ...n, folder: 'Trash', deleted_at: new Date().toISOString() } : n
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
                  >
                    <img
                      src={newFolderIcon}
                      alt="New Folder"
                      style={{
                        width: '20px',
                        height: '20px',
                        filter: 'brightness(0) invert(1)'
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
                          setSelectedFolder(folder);
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
                                <Draggable key={note.id} draggableId={note.id.toString()} index={idx}>
                                  {(provided, snapshot) => {
                                    const style = {
                                      ...provided.draggableProps.style,
                                      transform: provided.draggableProps.style?.transform
                                        ? provided.draggableProps.style.transform.replace(/translate\(([^,]+),([^)]+)\)/, (_, x, y) => `translate(0px,${y})`)
                                        : undefined,
                                    };
                                    return (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        onClick={() => { setSelectedFolder(folder); handleSelect(note); }}
                                        onContextMenu={e => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setSelectedFolder(folder);
                                          handleSelect(note);
                                          setNoteCtxMenu({ visible: true, x: e.clientX, y: e.clientY, note: note.id });
                                          setCtxMenu({ visible: false, x: 0, y: 0, folder: null });
                                        }}
                                        style={{
                                          ...style,
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
                          {provided.placeholder}
                        </div>
                      )}
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
          {selectedFolder === 'Trash' ? (
            <>
              <li
                style={{ padding: '4px 12px', cursor: 'pointer', color: isDarkMode ? '#4CAF50' : '#2E7D32', userSelect: 'none' }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const noteToRestore = notes.find(n => n.id === noteCtxMenu.note);
                  if (noteToRestore) {
                    handleRestore(noteToRestore);
                  }
                  setNoteCtxMenu({ ...noteCtxMenu, visible: false });
                }}
                onMouseOver={e => e.currentTarget.style.background = isDarkMode ? '#444' : '#f0f0f0'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                Restore Note
              </li>
              <li
                style={{ padding: '4px 12px', cursor: 'pointer', color: isDarkMode ? '#ff6b6b' : '#c00', userSelect: 'none' }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const noteToDelete = notes.find(n => n.id === noteCtxMenu.note);
                  if (noteToDelete) {
                    handlePermanentDelete(noteToDelete);
                  }
                  setNoteCtxMenu({ ...noteCtxMenu, visible: false });
                }}
                onMouseOver={e => e.currentTarget.style.background = isDarkMode ? '#444' : '#f0f0f0'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                Delete Permanently
              </li>
            </>
          ) : (
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
          )}
        </ul>
      )}
    </div>
  );
}

export default App;