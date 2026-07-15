'use client';

import { useState, useEffect, useCallback } from 'react';

interface Slot {
  id: string;
  name: string;
  capacity: number;
  bookingsCount: number;
  remainingCapacity: number;
}

interface Booking {
  slotId: string;
  slotName: string;
  bookedAt: string;
}

const API_BASE = 'http://localhost:5000';

export default function Dashboard() {
  const [userId, setUserId] = useState<string>('User_1');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [bookingSlotId, setBookingSlotId] = useState<string | null>(null);
  
  // Notification states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Suggested quick user IDs for easy testing
  const defaultUserIds = ['User_1', 'User_2', 'User_3', 'User_4'];

  // Clear notifications after 4 seconds
  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // Fetch slots
  const fetchSlots = useCallback(async (showSilentSpinner = false) => {
    if (showSilentSpinner) {
      setIsSyncing(true);
    } else {
      setIsLoading(true);
    }
    
    try {
      const res = await fetch(`${API_BASE}/slots`);
      if (!res.ok) throw new Error('Failed to fetch slots');
      const data = await res.json();
      setSlots(data);
      setErrorMsg(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to connect to backend server';
      setErrorMsg(`Connection error: ${message}`);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, []);

  // Fetch user bookings
  const fetchUserBookings = useCallback(async (currentUserId: string) => {
    if (!currentUserId.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/bookings?userId=${encodeURIComponent(currentUserId)}`);
      if (!res.ok) throw new Error('Failed to fetch bookings');
      const data = await res.json();
      setBookings(data);
    } catch (err: unknown) {
      console.error('Error fetching user bookings:', err);
    }
  }, []);

  // Poll for live availability
  useEffect(() => {
    fetchSlots();
    // Poll slots every 3 seconds
    const interval = setInterval(() => {
      fetchSlots(true);
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchSlots]);

  // Fetch bookings when userId changes
  useEffect(() => {
    fetchUserBookings(userId);
  }, [userId, fetchUserBookings]);

  // Handle Book Action
  const handleBookSlot = async (slotId: string) => {
    if (!userId.trim()) {
      setErrorMsg('Please select or input a User ID first.');
      return;
    }

    // Double-click and concurrent click guard: Set slot loading immediately
    setBookingSlotId(slotId);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`${API_BASE}/slots/${slotId}/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccessMsg(`Successfully booked!`);
        // Refresh data immediately
        await Promise.all([fetchSlots(true), fetchUserBookings(userId)]);
      } else {
        // Display precise error returned from server (400 or 409)
        setErrorMsg(data.error || 'Booking failed');
        // Refresh slots in case the error was "Slot is full" to sync state
        await fetchSlots(true);
      }
    } catch (err: unknown) {
      setErrorMsg('Network error. Check if backend is running.');
    } finally {
      // Re-enable button after response
      setBookingSlotId(null);
    }
  };

  return (
    <main className="app-container">
      <header className="header">
        <h1>SecureSlot Dashboard</h1>
        <p>Real-Time, Race-Safe Event Slot Booking System</p>
      </header>

      {/* Global Toast Alerts */}
      {errorMsg && (
        <div className="alert alert-error">
          <span>⚠️</span> {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success">
          <span>✅</span> {successMsg}
        </div>
      )}

      <div className="dashboard-grid">
        {/* Left Column: Controls & User Info */}
        <div className="slots-section">
          <div className="card">
            <h2 className="card-title">👤 Identity Control</h2>
            <div className="user-panel">
              <label className="input-label" htmlFor="user-id-input">Current Tester User ID</label>
              <div className="user-input-group">
                <input
                  id="user-id-input"
                  type="text"
                  className="input-text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="Enter User ID"
                />
              </div>
              <div className="user-chips">
                {defaultUserIds.map((id) => (
                  <button
                    key={id}
                    className={`user-chip ${userId === id ? 'active' : ''}`}
                    onClick={() => setUserId(id)}
                  >
                    {id}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="card-title">🎟️ My Bookings ({bookings.length})</h2>
            {bookings.length === 0 ? (
              <div className="no-bookings">
                No active bookings for this user.
              </div>
            ) : (
              <div className="bookings-list">
                {bookings.map((booking) => (
                  <div key={booking.slotId} className="booking-item">
                    <span className="booking-title">{booking.slotName}</span>
                    <span className="booking-time">
                      Booked at: {new Date(booking.bookedAt).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Slots */}
        <div className="slots-section">
          <div className="slots-header">
            <h2>Available Sessions</h2>
            <div className="status-badge">
              <div className={`status-indicator ${isSyncing ? 'syncing' : ''}`}></div>
              <span>Live Updates Auto-Syncing</span>
            </div>
          </div>

          {isLoading && slots.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
              <div className="spinner" style={{ width: '32px', height: '32px' }}></div>
            </div>
          ) : (
            <div className="slots-grid">
              {slots.map((slot) => {
                const isFull = slot.remainingCapacity === 0;
                const isBookingThis = bookingSlotId === slot.id;
                const hasUserBooked = bookings.some((b) => b.slotId === slot.id);

                return (
                  <div key={slot.id} className={`card slot-card ${isFull ? 'full' : ''}`}>
                    <div className="slot-header">
                      <h3 className="slot-title">{slot.name}</h3>
                    </div>

                    <div>
                      <div className="capacity-info">
                        <span>Capacity: {slot.bookingsCount} / {slot.capacity}</span>
                        <span>{slot.remainingCapacity} left</span>
                      </div>
                      
                      <div className="progress-bar-bg">
                        <div
                          className={`progress-bar-fill ${isFull ? 'full' : (slot.remainingCapacity === 1 ? 'warning' : '')}`}
                          style={{ width: `${(slot.bookingsCount / slot.capacity) * 100}%` }}
                        ></div>
                      </div>

                      {hasUserBooked ? (
                        <button className="btn btn-primary" disabled style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-green)', border: '1px solid rgba(16, 185, 129, 0.3)', cursor: 'default' }}>
                          ✓ Booked
                        </button>
                      ) : isFull ? (
                        <button className="btn btn-full" disabled>
                          Fully Booked
                        </button>
                      ) : (
                        <button
                          className="btn btn-primary"
                          onClick={() => handleBookSlot(slot.id)}
                          disabled={bookingSlotId !== null}
                        >
                          {isBookingThis ? (
                            <>
                              <div className="spinner"></div> Booking...
                            </>
                          ) : (
                            'Book Slot'
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
