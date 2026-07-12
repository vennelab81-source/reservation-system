import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [tables, setTables] = useState([]);
  const [dateFilter, setDateFilter] = useState('');
  const [error, setError] = useState('');
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState('');

  const loadReservations = async (date) => {
    const { data } = await api.get('/reservations', { params: date ? { date } : {} });
    setReservations(data.reservations);
  };

  const loadTables = async () => {
    const { data } = await api.get('/tables');
    setTables(data.tables);
  };

  useEffect(() => {
    loadReservations();
    loadTables();
  }, []);

  const applyFilter = (e) => {
    e.preventDefault();
    loadReservations(dateFilter);
  };

  const cancelReservation = async (id) => {
    if (!confirm('Cancel this reservation?')) return;
    try {
      await api.delete(`/reservations/${id}/admin`);
      loadReservations(dateFilter);
    } catch (err) {
      setError(err.response?.data?.message || 'Cancel failed');
    }
  };

  const addTable = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/tables', {
        tableNumber: Number(newTableNumber),
        capacity: Number(newTableCapacity),
      });
      setNewTableNumber('');
      setNewTableCapacity('');
      loadTables();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add table');
    }
  };

  return (
    <div className="page admin">
      <header className="topbar">
        <h1>Admin — {user.name}</h1>
        <button onClick={logout}>Log out</button>
      </header>

      {error && <p className="error">{error}</p>}

      <section className="card">
        <h2>All reservations</h2>
        <form className="filter-form" onSubmit={applyFilter}>
          <label>
            Filter by date
            <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
          </label>
          <button type="submit">Filter</button>
          <button
            type="button"
            onClick={() => {
              setDateFilter('');
              loadReservations();
            }}
          >
            Clear
          </button>
        </form>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Table</th>
              <th>Guests</th>
              <th>Customer</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((r) => (
              <tr key={r._id} className={r.status}>
                <td>{r.date}</td>
                <td>{r.timeSlot}</td>
                <td>{r.table?.tableNumber}</td>
                <td>{r.guests}</td>
                <td>
                  {r.user?.name} ({r.user?.email})
                </td>
                <td>{r.status}</td>
                <td>
                  {r.status === 'confirmed' && (
                    <button onClick={() => cancelReservation(r._id)}>Cancel</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>Manage tables</h2>
        <form className="booking-form" onSubmit={addTable}>
          <label>
            Table number
            <input
              type="number"
              min={1}
              value={newTableNumber}
              onChange={(e) => setNewTableNumber(e.target.value)}
              required
            />
          </label>
          <label>
            Capacity
            <input
              type="number"
              min={1}
              value={newTableCapacity}
              onChange={(e) => setNewTableCapacity(e.target.value)}
              required
            />
          </label>
          <button type="submit">Add table</button>
        </form>
        <ul>
          {tables.map((t) => (
            <li key={t._id}>
              Table {t.tableNumber} — seats {t.capacity}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
