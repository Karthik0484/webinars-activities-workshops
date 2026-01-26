import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Upload, X, CheckCircle, Loader2, Type, AlertCircle } from 'lucide-react';
import { calculateEventStatus, getStatusLabel } from '../utils/eventStatus';
import './AdminEventDetail.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function AdminEventDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [registrations, setRegistrations] = useState([]);
    const [loadingRegistrations, setLoadingRegistrations] = useState(false);

    // Certificate Upload State
    const [showCertModal, setShowCertModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [certFile, setCertFile] = useState(null);
    const [certTitle, setCertTitle] = useState('');
    const [uploadingCert, setUploadingCert] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectingId, setRejectingId] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('Invalid UPI Reference');

    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (!token) {
            navigate('/admin/login');
            return;
        }
        fetchEventDetails();
    }, [id]);

    const fetchEventDetails = async () => {
        try {
            const token = localStorage.getItem('adminToken');
            const response = await axios.get(`${API_URL}/events/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const eventData = response.data.event;
            setEvent(eventData);

            // Fetch registrations for ALL event types (unified logic)
            fetchRegistrations();
        } catch (error) {
            console.error('Failed to fetch event:', error);
            setError('Event not found or unauthorized');
        } finally {
            setLoading(false);
        }
    };

    const fetchRegistrations = async () => {
        setLoadingRegistrations(true);
        try {
            const token = localStorage.getItem('adminToken');
            const response = await axios.get(`${API_URL}/registrations/event/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRegistrations(response.data.registrations);
        } catch (error) {
            console.error('Failed to fetch registrations:', error);
        } finally {
            setLoadingRegistrations(false);
        }
    };

    // Derived participants list - always use event.participants for approved list
    const displayedParticipants = event?.participants || [];

    const handleRejectClick = (regId) => {
        setRejectingId(regId);
        setRejectionReason('Invalid UPI Reference');
        setShowRejectModal(true);
    };

    const confirmReject = async () => {
        if (!rejectingId) return;
        await handleUpdateRegistrationStatus(rejectingId, 'rejected', rejectionReason);
        setShowRejectModal(false);
        setRejectingId(null);
    };

    const handleUpdateRegistrationStatus = async (regId, status, reason = '') => {
        try {
            const token = localStorage.getItem('adminToken');

            // Unified logic for all events
            const payload = { status };
            if (status === 'rejected') {
                payload.rejectionReason = reason;
            }

            const response = await axios.put(`${API_URL}/registrations/${regId}/status`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                setRegistrations(prev => prev.map(reg =>
                    reg._id === regId ? { ...reg, status } : reg
                ));
                fetchEventDetails();
                toast.success(`Registration ${status} successfully`);
            }
        } catch (error) {
            console.error('Update status error:', error);
            toast.error('Failed to update status');
        }
    };

    const openCertModal = (participant) => {
        let akvoraId = participant.akvoraId;
        if (!akvoraId && registrations.length > 0) {
            const reg = registrations.find(r => r.user.email === participant.email.trim());
            if (reg) akvoraId = reg.user.akvoraId;
        }

        setSelectedUser({ ...participant, akvoraId: akvoraId || 'Unknown' });
        setCertTitle(`${event.title} Certificate`);
        setShowCertModal(true);
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this event?')) return;
        try {
            const token = localStorage.getItem('adminToken');
            await axios.delete(`${API_URL}/events/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            navigate('/admin/dashboard');
        } catch (error) {
            toast.error('Failed to delete event');
        }
    };

    const validateFile = (file) => {
        const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            toast.error('Invalid file type. Please upload PDF, PNG or JPG.');
            return false;
        }
        // Optional: Check file size (e.g., max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error('File too large. Max size is 5MB.');
            return false;
        }
        return true;
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            if (validateFile(file)) {
                setCertFile(file);
            }
        }
    };

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (validateFile(file)) {
                setCertFile(file);
            }
        }
    };

    const handleCertUpload = async (e) => {
        e.preventDefault();
        if (!selectedUser || !certFile || !certTitle) {
            toast.error('Please fill in all fields');
            return;
        }

        setUploadingCert(true);
        const formData = new FormData();
        formData.append('akvoraId', selectedUser.akvoraId);
        formData.append('certificateTitle', certTitle);
        formData.append('eventId', event._id);
        formData.append('certificate', certFile);

        try {
            const token = localStorage.getItem('adminToken');
            await axios.post(`${API_URL}/certificates/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}`
                }
            });
            toast.success('Certificate uploaded successfully!');
            setShowCertModal(false);
            setCertFile(null);
            setCertTitle('');
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.error || 'Failed to upload certificate');
        } finally {
            setUploadingCert(false);
        }
    };

    if (loading) return <div className="admin-loading">Loading event details...</div>;
    if (error) return <div className="admin-error">{error} <button onClick={() => navigate('/admin/dashboard')}>Back</button></div>;
    if (!event) return null;

    return (
        <div className="admin-detail-page">
            <header className="detail-header">
                <button className="back-btn" onClick={() => navigate('/admin/dashboard')}>← Back to Dashboard</button>
                <div className="header-main">
                    <h1>{event.title}</h1>
                    <span className={`event-type-badge ${event.type}`}>{event.type}</span>
                </div>
            </header>

            <div className="detail-grid">
                <section className="detail-info-card">
                    <div className="info-section">
                        <img
                            src={event.imageUrl ? `${API_URL.replace('/api', '')}${event.imageUrl}` : '/placeholder.jpg'}
                            alt={event.title}
                            className="detail-img"
                        />
                        <div className="info-content">
                            <h3>Event Information</h3>
                            <p><strong>Description:</strong> {event.description}</p>
                            <p><strong>Start Date:</strong> {new Date(event.date).toLocaleString()}</p>
                            <p><strong>End Date:</strong> {event.endDate ? new Date(event.endDate).toLocaleString() : 'Not Set'}</p>
                            <p><strong>Instructor:</strong> {event.instructor}</p>

                            <p><strong>Location:</strong> {event.location || 'Online'}</p>
                            <p><strong>Price:</strong> ₹{event.price}</p>
                            <p><strong>Status:</strong> <span className={`status-badge-inline ${calculateEventStatus(event.date, event.endDate)}`}>
                                {getStatusLabel(calculateEventStatus(event.date, event.endDate))}
                            </span></p>

                            <div className="detail-actions">
                                <button className="edit-btn-main" onClick={() => navigate(`/admin/dashboard`, { state: { editEvent: event } })}>Edit Event</button>
                                <button className="delete-btn-main" onClick={handleDelete}>Delete Event</button>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="participants-section">
                    <h3>Current Participants ({displayedParticipants.length})</h3>
                    <div className="participants-table-wrapper">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Registered At</th>
                                    <th>Certificate</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayedParticipants.map((p, i) => (
                                    <tr key={i}>
                                        <td>{p.name}</td>
                                        <td>{p.email}</td>
                                        <td>{p.registeredAt ? new Date(p.registeredAt).toLocaleString() : '-'}</td>
                                        <td>
                                            <button
                                                className="upload-cert-btn-small"
                                                onClick={() => openCertModal(p)}
                                                style={{
                                                    padding: '6px 12px',
                                                    fontSize: '12px',
                                                    background: '#4f46e5',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}
                                            >
                                                <Upload size={12} /> Upload
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {displayedParticipants.length === 0 && (
                                    <tr><td colSpan="4" className="no-data">No active participants yet</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                {(event.type === 'workshop' || event.type === 'webinar' || event.type === 'internship') && (
                    <section className="registrations-verification-section">
                        <h3>Verify {event.type.charAt(0).toUpperCase() + event.type.slice(1)} Registrations</h3>
                        <div className="table-responsive">
                            <table className="registrations-table">
                                <thead>
                                    <tr>
                                        <th>Student</th>
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
                                                    <small>{reg.user.akvoraId}</small>
                                                </div>
                                            </td>
                                            <td><code>{reg.upiReference}</code></td>
                                            <td>
                                                <span className={`admin-status-badge ${(reg.status || reg.paymentStatus || 'pending').toLowerCase()}`}>
                                                    {reg.status || reg.paymentStatus || 'Pending'}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="action-buttons">
                                                    {reg.status === 'pending' && (
                                                        <>
                                                            <button onClick={() => handleUpdateRegistrationStatus(reg._id, 'approved')} className="approve-btn">Approve</button>
                                                            <button onClick={() => handleRejectClick(reg._id)} className="reject-btn">Reject</button>
                                                        </>
                                                    )}
                                                    {reg.status !== 'pending' && (
                                                        <button onClick={() => handleUpdateRegistrationStatus(reg._id, 'pending')} className="reset-btn">Reset</button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {registrations.length === 0 && (
                                        <tr><td colSpan={event.type === 'workshop' ? "4" : "3"} className="no-data">No registration requests found</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}
            </div>

            {/* Rejection Reason Modal */}
            {showRejectModal && (
                <div className="admin-modal-overlay">
                    <div className="admin-modal-content">
                        <div className="modal-header">
                            <div className="modal-title-group">
                                <AlertCircle className="modal-icon-danger" size={24} />
                                <h3>Reject Registration</h3>
                            </div>
                            <button className="modal-close-btn" onClick={() => setShowRejectModal(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body">
                            <p className="modal-desc">Please provide a reason for rejecting this registration. This will be sent to the student.</p>

                            <div className="form-group">
                                <label>Rejection Reason</label>
                                <textarea
                                    className="modal-textarea"
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    placeholder="Enter reason..."
                                />
                                <div className="quick-chips">
                                    <button
                                        className={`chip ${rejectionReason === 'Invalid UPI Reference' ? 'active' : ''}`}
                                        onClick={() => setRejectionReason('Invalid UPI Reference')}
                                    >
                                        Invalid UPI
                                    </button>
                                    <button
                                        className={`chip ${rejectionReason === 'Payment not received' ? 'active' : ''}`}
                                        onClick={() => setRejectionReason('Payment not received')}
                                    >
                                        Payment missing
                                    </button>
                                    <button
                                        className={`chip ${rejectionReason === 'Incomplete details' ? 'active' : ''}`}
                                        onClick={() => setRejectionReason('Incomplete details')}
                                    >
                                        Incomplete details
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setShowRejectModal(false)}>
                                Cancel
                            </button>
                            <button className="btn-danger" onClick={confirmReject}>
                                Confirm Reject
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Certificate Upload Modal */}
            {showCertModal && (
                <div className="admin-modal-overlay">
                    <div className="admin-modal-content">
                        <div className="modal-header">
                            <div className="modal-title-group">
                                <CheckCircle className="modal-icon-primary" size={24} />
                                <h3>Issue Certificate</h3>
                            </div>
                            <button className="modal-close-btn" onClick={() => setShowCertModal(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className="user-details-card">
                                <div className="user-avatar-placeholder">
                                    {selectedUser?.name?.charAt(0)}
                                </div>
                                <div className="user-text">
                                    <strong>{selectedUser?.name}</strong>
                                    <small>{selectedUser?.akvoraId || 'No ID'}</small>
                                </div>
                            </div>

                            <form onSubmit={handleCertUpload}>
                                <div className="form-group">
                                    <label>Certificate Title</label>
                                    <div className="input-with-icon">
                                        <Type size={18} className="input-icon" />
                                        <input
                                            type="text"
                                            className="modal-input"
                                            value={certTitle}
                                            onChange={e => setCertTitle(e.target.value)}
                                            placeholder="   e.g. Workshop Completion"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Certificate File</label>
                                    <div className="file-upload-wrapper">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="file-input-hidden"
                                            onChange={handleFileSelect}
                                            accept="application/pdf,image/*"
                                        />
                                        <div
                                            className={`file-upload-box ${isDragging ? 'dragging' : ''}`}
                                            onDragOver={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <Upload size={32} className={isDragging ? 'bounce' : ''} />
                                            <div className="upload-text">
                                                <span className="upload-main-text">
                                                    {certFile ? certFile.name : 'Click to upload or Drag & Drop'}
                                                </span>
                                                <span className="upload-sub-text">
                                                    Supported formats: PDF, PNG, JPG (Max 5MB)
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="modal-footer">
                                    <button
                                        type="submit"
                                        className="btn-primary full-width"
                                        disabled={uploadingCert || !selectedUser?.akvoraId}
                                    >
                                        {uploadingCert ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                                        Upload & Issue
                                    </button>
                                </div>
                                {!selectedUser?.akvoraId && (
                                    <p className="error-text-sm">
                                        Cannot upload: User Akvora ID not found.
                                    </p>
                                )}
                            </form>
                        </div>
                    </div>
                </div >
            )
            }
        </div >
    );
}

export default AdminEventDetail;
