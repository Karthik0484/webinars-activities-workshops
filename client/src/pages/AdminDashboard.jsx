import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import './AdminDashboard.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function AdminDashboard() {
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'workshop',
    date: '',
    duration: '',
    location: '',
    isOnline: false,
    meetingLink: '',
    maxParticipants: null,
    instructor: '',
    instructorBio: '',
    imageUrl: '',
    tags: '',
    requirements: '',
    whatYouWillLearn: '',
    price: 0,
    upiId: '',
    payeeName: '',
    status: 'upcoming'
  });
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [selectedEventParticipants, setSelectedEventParticipants] = useState([]);
  const [showRegistrationsModal, setShowRegistrationsModal] = useState(false);
  const [registrations, setRegistrations] = useState([]);
  const [selectedWorkshopForReg, setSelectedWorkshopForReg] = useState(null);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin/login');
      return;
    }

    fetchEvents();
    fetchStats();

    // Check if we came here with an event to edit
    if (location.state?.editEvent) {
      handleEdit(location.state.editEvent);
      // Clean up the state so it doesn't re-open on refresh
      window.history.replaceState({}, document.title);
    }
  }, [navigate]);

  const fetchEvents = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(`${API_URL}/events`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setEvents(response.data.events);
    } catch (error) {
      setError('Failed to fetch events');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(`${API_URL}/events/stats/dashboard`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setStats(response.data.stats);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('adminToken');

      // Create FormData for file upload
      const formDataToSend = new FormData();

      // Add all form fields
      Object.keys(formData).forEach(key => {
        if (key !== 'imageUrl') {
          if (key === 'tags') {
            formDataToSend.append(key, formData[key].split(',').map(tag => tag.trim()).filter(tag => tag));
          } else if (key === 'requirements' || key === 'whatYouWillLearn') {
            formDataToSend.append(key, formData[key].split('\n').map(item => item.trim()).filter(item => item));
          } else {
            formDataToSend.append(key, formData[key]);
          }
        }
      });

      // Add image if selected
      if (selectedImage) {
        formDataToSend.append('eventImage', selectedImage);
      }

      let response;
      if (editingEvent) {
        response = await axios.put(`${API_URL}/events/${editingEvent._id}`, formDataToSend, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
      } else {
        response = await axios.post(`${API_URL}/events`, formDataToSend, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
      }

      setShowCreateForm(false);
      setEditingEvent(null);
      resetForm();
      fetchEvents();
      fetchStats();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to save event');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (event) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description,
      type: event.type,
      date: new Date(event.date).toISOString().slice(0, 16),
      duration: event.duration,
      location: event.location,
      isOnline: event.isOnline,
      meetingLink: event.meetingLink,
      maxParticipants: event.maxParticipants,
      instructor: event.instructor,
      instructorBio: event.instructorBio,
      imageUrl: event.imageUrl || '',
      tags: event.tags.join(', '),
      requirements: event.requirements.join('\n'),
      whatYouWillLearn: event.whatYouWillLearn.join('\n'),
      price: event.price,
      upiId: event.upiId || '',
      payeeName: event.payeeName || '',
      status: event.status
    });

    // Set image preview if existing image
    if (event.imageUrl) {
      setImagePreview(`${API_URL.replace('/api', '')}${event.imageUrl}`);
    }

    setShowCreateForm(true);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview('');
    if (document.getElementById('eventImage')) {
      document.getElementById('eventImage').value = '';
    }
  };

  const handleDelete = async (eventId) => {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      const token = localStorage.getItem('adminToken');
      await axios.delete(`${API_URL}/events/${eventId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      fetchEvents();
      fetchStats();
    } catch (error) {
      setError('Failed to delete event');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      type: 'workshop',
      date: '',
      duration: '',
      location: '',
      isOnline: false,
      meetingLink: '',
      maxParticipants: null,
      instructor: '',
      instructorBio: '',
      imageUrl: '',
      tags: '',
      requirements: '',
      whatYouWillLearn: '',
      price: 0,
      upiId: '',
      payeeName: '',
      status: 'upcoming'
    });
    setSelectedImage(null);
    setImagePreview('');
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminData');
    navigate('/admin/login');
  };

  const handleViewParticipants = (event) => {
    setSelectedEventParticipants(event.participants || []);
    setShowParticipantsModal(true);
  };

  const handleViewRegistrations = async (workshop) => {
    setSelectedWorkshopForReg(workshop);
    setLoadingRegistrations(true);
    setShowRegistrationsModal(true);
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(`${API_URL}/registrations/event/${workshop._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRegistrations(response.data.registrations);
    } catch (error) {
      console.error('Failed to fetch registrations:', error);
      setError('Failed to fetch registrations');
    } finally {
      setLoadingRegistrations(false);
    }
  };

  const handleUpdateRegistrationStatus = async (regId, status) => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.put(`${API_URL}/registrations/${regId}/status`, { status }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        // Update local state
        setRegistrations(prev => prev.map(reg =>
          reg._id === regId ? { ...reg, status } : reg
        ));
        // Refresh events as participant list might have changed
        fetchEvents();
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('Failed to update status');
    }
  };

  if (loading && events.length === 0) {
    return <div className="admin-loading">Loading...</div>;
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="admin-header-content">
          <h1>AKVORA Admin Dashboard</h1>
          <div className="admin-user-info">
            <nav className="admin-nav">
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="nav-btn active"
              >
                Events
              </button>
              <button
                onClick={() => navigate('/admin/users')}
                className="nav-btn"
              >
                Users
              </button>
              <button
                onClick={() => navigate('/admin/user-profiles')}
                className="nav-btn"
              >
                User Profiles
              </button>
            </nav>
            <span>Admin</span>
            <button onClick={handleLogout} className="logout-btn">Logout</button>
          </div>
        </div>
      </header>

      <main className="admin-main">
        {error && <div className="error-message">{error}</div>}

        {stats && (
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Total Events</h3>
              <p className="stat-number">{stats.totalEvents}</p>
            </div>
            <div className="stat-card">
              <h3>Total Participants</h3>
              <p className="stat-number">{stats.totalParticipants}</p>
            </div>
            {stats.byType.map((stat, index) => (
              <div key={index} className="stat-card">
                <h3>{stat._id.charAt(0).toUpperCase() + stat._id.slice(1)}s</h3>
                <p className="stat-number">{stat.count}</p>
              </div>
            ))}
          </div>
        )}

        <div className="events-section">
          <div className="section-header">
            <h2>Events Management</h2>
            <button
              onClick={() => {
                setShowCreateForm(true);
                setEditingEvent(null);
                resetForm();
              }}
              className="create-btn"
            >
              Create New Event
            </button>
          </div>

          <div className="events-grid">
            {events.map((event) => (
              <div
                key={event._id}
                className="event-card-clickable"
                onClick={() => navigate(`/admin/events/${event._id}`)}
              >
                <div className="event-header">
                  <h3>{event.title}</h3>
                  <span className={`event-type ${event.type}`}>{event.type}</span>
                </div>
                <div className="event-details">
                  <p><strong>Date:</strong> {new Date(event.date).toLocaleDateString()}</p>
                  <p><strong>Instructor:</strong> {event.instructor}</p>
                  <p><strong>Participants:</strong> {event.participants?.length || 0} registered</p>
                  <p><strong>Status:</strong> {event.status}</p>
                  {event.type === 'workshop' && (
                    <p><strong>UPI:</strong> {event.upiId || 'Not set'}</p>
                  )}
                </div>
                <div className="event-card-footer">
                  <span className="view-details-hint">Click to manage event →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {showCreateForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>{editingEvent ? 'Edit Event' : 'Create New Event'}</h2>
            <form onSubmit={handleSubmit} className="event-form">
              <div className="form-grid">
                <div className="form-group">
                  <label>Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  >
                    <option value="workshop">Workshop</option>
                    <option value="webinar">Webinar</option>
                    <option value="internship">Internship</option>
                  </select>
                </div>
                <div className="form-group full-width">
                  <label>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                    rows={3}
                  />
                </div>
                <div className="form-group">
                  <label>Date & Time</label>
                  <input
                    type="datetime-local"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Duration</label>
                  <input
                    type="text"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    placeholder="e.g., 2 hours, 3 days"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Online or physical address"
                  />
                </div>
                <div className="form-group">
                  <label>Max Participants</label>
                  <input
                    type="number"
                    value={formData.maxParticipants || ''}
                    onChange={(e) => setFormData({ ...formData, maxParticipants: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="Leave empty for unlimited"
                  />
                </div>
                <div className="form-group">
                  <label>Instructor</label>
                  <input
                    type="text"
                    value={formData.instructor}
                    onChange={(e) => setFormData({ ...formData, instructor: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group full-width">
                  <label>Event Image</label>
                  <div className="image-upload-container">
                    <input
                      id="eventImage"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="image-input"
                    />
                    {imagePreview && (
                      <div className="image-preview-container" onClick={() => document.getElementById('eventImage').click()}>
                        <img src={imagePreview} alt="Event preview" className="image-preview" />
                        <button type="button" onClick={(e) => { e.stopPropagation(); handleRemoveImage(); }} className="remove-image-btn">
                          Remove Image
                        </button>
                      </div>
                    )}
                    {!imagePreview && (
                      <div className="image-upload-placeholder" onClick={() => document.getElementById('eventImage').click()}>
                        <p>Click to upload event image</p>
                        <small>Recommended: 16:9 aspect ratio, max 5MB</small>
                      </div>
                    )}
                  </div>
                </div>
                <div className="form-group full-width">
                  <label>Meeting Link (for online events)</label>
                  <input
                    type="url"
                    value={formData.meetingLink}
                    onChange={(e) => setFormData({ ...formData, meetingLink: e.target.value })}
                    placeholder="https://zoom.us/j/..."
                  />
                </div>
                <div className="form-group full-width">
                  <label>Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    placeholder="web development, react, nodejs"
                  />
                </div>
                <div className="form-group full-width">
                  <label>Requirements (one per line)</label>
                  <textarea
                    value={formData.requirements}
                    onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                    rows={3}
                    placeholder="Basic programming knowledge&#10;Computer with internet access"
                  />
                </div>
                <div className="form-group full-width">
                  <label>What You'll Learn (one per line)</label>
                  <textarea
                    value={formData.whatYouWillLearn}
                    onChange={(e) => setFormData({ ...formData, whatYouWillLearn: e.target.value })}
                    rows={4}
                    placeholder="React fundamentals&#10;Node.js and Express.js"
                  />
                </div>
                <div className="form-group">
                  <label>Price ()</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                {formData.type === 'workshop' && (
                  <>
                    <div className="form-group">
                      <label>UPI ID for Payments</label>
                      <input
                        type="text"
                        value={formData.upiId}
                        onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
                        placeholder="akvora@upi"
                      />
                    </div>
                    <div className="form-group">
                      <label>Payee Name</label>
                      <input
                        type="text"
                        value={formData.payeeName}
                        onChange={(e) => setFormData({ ...formData, payeeName: e.target.value })}
                        placeholder="Akvora Learning"
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowCreateForm(false)} className="cancel-btn">Cancel</button>
                <button type="submit" disabled={loading} className="submit-btn">
                  {loading ? 'Saving...' : (editingEvent ? 'Update Event' : 'Create Event')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showParticipantsModal && (
        <div className="modal-overlay">
          <div className="modal-content participants-modal">
            <div className="modal-header">
              <h2>Event Participants</h2>
              <button
                onClick={() => setShowParticipantsModal(false)}
                className="close-modal"
              >
                ×
              </button>
            </div>
            <div className="participants-list">
              {selectedEventParticipants.length === 0 ? (
                <p className="no-participants">No participants registered yet</p>
              ) : (
                <div className="participants-grid">
                  {selectedEventParticipants.map((participant, index) => (
                    <div key={index} className="participant-card">
                      <div className="participant-info">
                        <h4>{participant.name}</h4>
                        <p>{participant.email}</p>
                        <small>Registered: {new Date(participant.registeredAt).toLocaleDateString()}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <p>Total Participants: {selectedEventParticipants.length}</p>
              <button
                onClick={() => setShowParticipantsModal(false)}
                className="close-btn"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {showRegistrationsModal && (
        <div className="modal-overlay">
          <div className="modal-content registrations-modal">
            <div className="modal-header">
              <h2>Verify Workshop Registrations</h2>
              <button
                onClick={() => setShowRegistrationsModal(false)}
                className="close-modal"
              >
                &times;
              </button>
            </div>

            <p className="modal-subtitle">{selectedWorkshopForReg?.title}</p>

            <div className="registrations-list">
              {loadingRegistrations ? (
                <div className="loading-spinner"></div>
              ) : registrations.length === 0 ? (
                <p className="no-registrations">No registrations found for this workshop.</p>
              ) : (
                <div className="table-responsive">
                  <table className="registrations-table">
                    <thead>
                      <tr>
                        <th>Student Details</th>
                        <th>UPI Reference</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registrations.map((reg) => (
                        <tr key={reg._id}>
                          <td>
                            <div className="student-info">
                              <strong>{reg.user.firstName} {reg.user.lastName}</strong>
                              <span>{reg.user.akvoraId}</span>
                              <small>{reg.user.email}</small>
                            </div>
                          </td>
                          <td>
                            <code>{reg.upiReference}</code>
                          </td>
                          <td>
                            <span className={`status-badge ${reg.status}`}>
                              {reg.status}
                            </span>
                          </td>
                          <td>
                            <div className="action-buttons">
                              {reg.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => handleUpdateRegistrationStatus(reg._id, 'approved')}
                                    className="approve-btn"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleUpdateRegistrationStatus(reg._id, 'rejected')}
                                    className="reject-btn"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              {reg.status !== 'pending' && (
                                <button
                                  onClick={() => handleUpdateRegistrationStatus(reg._id, 'pending')}
                                  className="reset-btn"
                                >
                                  Reset to Pending
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setShowRegistrationsModal(false)}
                className="close-btn"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
