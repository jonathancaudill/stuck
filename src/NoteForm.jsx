import React, { useState, useEffect } from 'react';
import { getDb } from './db';

export default function NoteForm({ existing, onSaved, onCancel }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setBody(existing.body);
    }
  }, [existing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const db = await getDb();
    if (existing) {
      await db.execute(
        'UPDATE notes SET title = ?, body = ? WHERE id = ?',
        [title, body, existing.id]
      );
    } else {
      await db.execute(
        'INSERT INTO notes (title, body, created_at) VALUES (?, ?, datetime("now"))',
        [title, body]
      );
    }
    onSaved();
    setTitle(''); setBody('');
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: '2rem' }}>
      <input
        type="text"
        placeholder="Title"
        value={title}
        onChange={e => setTitle(e.target.value)}
        required
      />
      <textarea
        placeholder="Body"
        value={body}
        onChange={e => setBody(e.target.value)}
        required
      />
      <button type="submit">{existing ? 'Save Changes' : 'Add Note'}</button>
      {existing && <button type="button" onClick={onCancel}>Cancel</button>}
    </form>
  );
}