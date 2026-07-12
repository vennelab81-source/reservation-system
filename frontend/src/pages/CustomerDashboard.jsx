import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const TIME_SLOTS = ['11:00', '12:30', '14:00', '18:00', '19:30', '21:00'];

export default function CustomerDashboard() {
  const { user, logout } = useAuth();
  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState(TIME_SLOTS[0]);
  const [guests, setGuests] = useState(2);
  const [availableTables, setAvailableTables] = useState(null);
  const [selectedTable, setSelectedTable] = useState('');
  const [reservations, setReservations] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadReservations = async () => {
    const { data } = await api.get('/reservations/mine');
    setReservations(data.reservations);
  };

  useEffect(() => {
    loadReservations();
  }, []);

  const checkAvailability = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setAvailableTables(null);
    setSelectedTable('');
    if (!date) {
      setError('Please choose a date');
      return;
    }
    try {
      const { data } = await api.get('/reservations/availability', {
        params: { date, timeSlot, guests },
      });
      setAvailableTables(data.availableTables);
      if (data.availableTables.length === 0) {
        setError('No tables available for that date, time and party size.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to check availability');
    }
  };

  const bookTable = async () => {
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await api.post('/reservations', {
        tableId: selectedTable,
        date,
        timeSlot,
        guests: Number(guests),
      });
      setMessage('Reservation confirmed!');
      setAvailableTables(null);
      setSelectedTable('');
      loadReservations();
    } catch (err) {
      setError(err.response?.data?.message || 'Booking failed');
    } finally {
      setLoading(false);
    }
  };

  const cancelReservation = async (id) => {
    if (!confirm('Cancel this reservation?')) return;
    try {
      await api.delete(`/reservations/${id}`);
      loadReservations();
    } catch (err) {
      setError(err.response?.data?.message || 'Cancel failed');
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="page">
      <header className="topbar">
        <h1>Welcome, {user.name}</h1>
        <button onClick={logout}>Log out</button>
      </header>

      <section className="card">
        <h2>Book a table</h2>
        <form className="booking-form" onSubmit={checkAvailability}>
          <label>
            Date
            <input type="date" min={todayStr} value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label>
            Time
            <select value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)}>
              {TIME_SLOTS.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </label>
          <label>
            Guests
            <input
              type="number"
              min={1}
              max={12}
              value={guests}
              onChange={(e) => setGuests(e.target.value)}
            />
          </label>
          <button type="submit">Check availability</button>
        </form>

        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}

        {availableTables && availableTables.length > 0 && (
          <div className="table-picker">
            <h3>Available tables</h3>
            <ul>
              {availableTables.map((t) => (
                <li key={t._id}>
                  <label>
                    <input
                      type="radio"
                      name="table"
                      value={t._id}
                      checked={selectedTable === t._id}
                      onChange={(e) => setSelectedTable(e.target.value)}
                    />
                    Table {t.tableNumber} — seats {t.capacity}
                  </label>
                </li>
              ))}
            </ul>
            <button disabled={!selectedTable || loading} onClick={bookTable}>
              {loading ? 'Booking…' : 'Confirm reservation'}
            </button>
          </div>
        )}
      </section>

      <section className="card">
        <h2>My reservations</h2>
        {reservations.length === 0 && <p>No reservations yet.</p>}
        <ul className="reservation-list">
          {reservations.map((r) => (
            <li key={r._id} className={r.status}>
              <div>
                <strong>{r.date}</strong> at {r.timeSlot} — Table {r.table?.tableNumber} — {r.guests} guests
                <span className={`badge ${r.status}`}>{r.status}</span>
              </div>
              {r.status === 'confirmed' && (
                <button onClick={() => cancelReservation(r._id)}>Cancel</button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
