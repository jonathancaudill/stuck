import React, { useState, useEffect } from 'react';
import { getDb } from './db';

export default function NotesList({ onEdit }) {
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    const sorted = [...notes].sort((a, b) => new Date(b.last_edited) - new Date(a.last_edited));
    setNotes(sorted);
  }, [notes.length]);

  const handleDelete = async (id) => {
    const db = await getDb();
    await db.execute('DELETE FROM notes WHERE id = ?', [id]);
    setNotes(notes.filter(n => n.id !== id));
  };

  return (
    <ul>
      {notes.map(note => (
        <li key={note.id} style={{ marginBottom: '1rem' }}>
          <h3>{note.title}</h3>
          <p style={{ whiteSpace: 'pre-wrap' }}>{note.body}</p>
          <small>{new Date(note.created_at).toLocaleString()}</small>
          <div>
            <button onClick={() => onEdit(note)}>Edit</button>
            <button onClick={() => handleDelete(note.id)}>Delete</button>
          </div>
        </li>
      ))}
    </ul>
  );
}