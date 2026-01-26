import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, Edit2, Trash2, Clock, CheckCircle, XCircle } from 'lucide-react';
import './AdminAnnouncements.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function AdminAnnouncements() {
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        message: '',
        link: '',
        durationValue: 24,
        durationUnit: 'hours'
    });
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (!token) {
            navigate('/admin/login');
            return;
        }
        fetchAnnouncements();
    }, [navigate]);

    const fetchAnnouncements = async () => {
        try {
            const token = localStorage.getItem('adminToken');
            const response = await axios.get(`${API_URL}/announcements`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAnnouncements(response.data.announcements);
        } catch (error) {
            console.error('Error fetching announcements:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const token = localStorage.getItem('adminToken');

            if (editingId) {
                await axios.put(
                    `${API_URL}/announcements/${editingId}`,
                    formData,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            } else {
                await axios.post(
                    `${API_URL}/announcements`,
                    formData,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            }

            setShowForm(false);
            setEditingId(null);
            resetForm();
            fetchAnnouncements();
        } catch (error) {
            console.error('Error saving announcement:', error);
            alert('Failed to save announcement');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (announcement) => {
        setEditingId(announcement._id);
        setFormData({
            title: announcement.title,
            message: announcement.message,
            durationValue: announcement.durationValue,
            durationUnit: announcement.durationUnit
        });
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this announcement?')) return;

        try {
            const token = localStorage.getItem('adminToken');
            await axios.delete(`${API_URL}/announcements/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchAnnouncements();
        } catch (error) {
            console.error('Error deleting announcement:', error);
            alert('Failed to delete announcement');
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            message: '',
            durationValue: 24,
            durationUnit: 'hours'
        });
    };

    const getExpiryPreview = () => {
        const now = new Date();
        const expiry = new Date(now);

        if (formData.durationUnit === 'hours') {
            expiry.setHours(expiry.getHours() + parseInt(formData.durationValue));
        } else {
            expiry.setDate(expiry.getDate() + parseInt(formData.durationValue));
        }

        return expiry.toLocaleString();
    };

    const formatExpiry = (date) => {
        const expiry = new Date(date);
        const now = new Date();

        if (expiry < now) return 'Expired';

        const diffMs = expiry - now;
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffDays > 0) return `Expires in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
        if (diffHours > 0) return `Expires in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
        return 'Expiring soon';
    };

    return (
        <div className="admin-dashboard">
            <header className="admin-header">
                <div className="admin-header-content">
                   
                    <h1>AKVORA Admin Dashboard</h1>
                    <div className="admin-user-info">
                        <span>Admin</span>
                        <button onClick={() => {
                            localStorage.removeItem('adminToken');
                            localStorage.removeItem('adminData');
                            navigate('/admin/login');
                        }} className="logout-btn">Logout</button>
                    </div>
                </div>
                <nav className="admin-nav">
                    <button onClick={() => navigate('/admin/dashboard')} className="admin-nav-btn">
                        Dashboard
                    </button>
                    <button onClick={() => navigate('/admin/users')} className="admin-nav-btn">
                        Users
                    </button>
                    <button onClick={() => navigate('/admin/videos')} className="admin-nav-btn">
                        Videos
                    </button>
                    <button onClick={() => navigate('/admin/announcements')} className="admin-nav-btn active">
                        Announcements
                    </button>
                    <button onClick={() => navigate('/admin/certificates')} className="admin-nav-btn">
                        Certificates
                    </button>
                </nav>
            </header>

            <main className="admin-main">
                <div className="announcements-section">
                    <div className="section-header">
                        <h2>Announcements Management</h2>
                        <button
                            onClick={() => {
                                setShowForm(true);
                                setEditingId(null);
                                resetForm();
                            }}
                            className="create-btn"
                        >
                            <Plus size={20} />
                            Create Announcement
                        </button>
                    </div>

                    {loading && announcements.length === 0 ? (
                        <div className="loading">Loading...</div>
                    ) : (
                        <div className="announcements-grid">
                            {announcements.map((announcement) => (
                                <div key={announcement._id} className={`announcement-card ${announcement.status}`}>
                                    <div className="announcement-header">
                                        <h3>{announcement.title}</h3>
                                        <span className={`status-badge ${announcement.status}`}>
                                            {announcement.status === 'active' ? (
                                                <><CheckCircle size={14} /> Active</>
                                            ) : (
                                                <><XCircle size={14} /> Expired</>
                                            )}
                                        </span>
                                    </div>

                                    <p className="announcement-message">{announcement.message}</p>
                                    {announcement.link && (
                                        <a href={announcement.link} target="_blank" rel="noopener noreferrer" className="announcement-link">
                                            Visit Link
                                        </a>
                                    )}

                                    <div className="announcement-meta">
                                        <div className="meta-item">
                                            <Clock size={14} />
                                            <span>{formatExpiry(announcement.expiresAt)}</span>
                                        </div>
                                        <div className="meta-item">
                                            <span>Duration: {announcement.durationValue} {announcement.durationUnit}</span>
                                        </div>
                                    </div>

                                    <div className="announcement-actions">
                                        <button onClick={() => handleEdit(announcement)} className="edit-btn">
                                            <Edit2 size={16} />
                                            Edit
                                        </button>
                                        <button onClick={() => handleDelete(announcement._id)} className="delete-btn">
                                            <Trash2 size={16} />
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {showForm && (
                <div className="modal-overlay">
                    <div className="modal-content announcement-modal">
                        <h2>{editingId ? 'Edit Announcement' : 'Create New Announcement'}</h2>

                        <form onSubmit={handleSubmit} className="announcement-form">
                            <div className="form-group">
                                <label>Title</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="Enter announcement title"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Message</label>
                                <textarea
                                    value={formData.message}
                                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                    placeholder="Enter announcement message"
                                    rows={4}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Link (Optional)</label>
                                <input
                                    type="url"
                                    value={formData.link}
                                    onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                                    placeholder="https://example.com"
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Duration</label>
                                    <input
                                        type="number"
                                        value={formData.durationValue}
                                        onChange={(e) => setFormData({ ...formData, durationValue: e.target.value })}
                                        min="1"
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Unit</label>
                                    <select
                                        value={formData.durationUnit}
                                        onChange={(e) => setFormData({ ...formData, durationUnit: e.target.value })}
                                    >
                                        <option value="hours">Hours</option>
                                        <option value="days">Days</option>
                                    </select>
                                </div>
                            </div>

                            <div className="expiry-preview">
                                <Clock size={16} />
                                <span>Will expire on: {getExpiryPreview()}</span>
                            </div>

                            <div className="form-actions">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowForm(false);
                                        setEditingId(null);
                                        resetForm();
                                    }}
                                    className="cancel-btn"
                                >
                                    Cancel
                                </button>
                                <button type="submit" disabled={loading} className="submit-btn">
                                    {loading ? 'Saving...' : editingId ? 'Update' : 'Publish'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminAnnouncements;
