import { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
    Search,
    User,
    X,
    FileText,
    BadgeCheck,
    Loader2,
    Edit2,
    Trash2,
    ExternalLink,
    Save
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function AdminCertificateManage() {
    const [selectedYear, setSelectedYear] = useState('2025');
    const [idSuffix, setIdSuffix] = useState('');
    const [manageUser, setManageUser] = useState(null);
    const [userCertificates, setUserCertificates] = useState([]);
    const [loadingManage, setLoadingManage] = useState(false);
    const [editingCertId, setEditingCertId] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [error, setError] = useState(null);

    const handleManageSearch = async (e) => {
        e.preventDefault();
        setLoadingManage(true);
        setError(null);
        setManageUser(null);
        setUserCertificates([]);

        const akvoraId = `AKVORA:${selectedYear}:${idSuffix}`;

        try {
            const token = localStorage.getItem('adminToken');
            const response = await axios.get(`${API_URL}/certificates/user/${akvoraId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                setManageUser(response.data.user);
                setUserCertificates(response.data.certificates);
            }
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || 'User not found');
            setError('User not found or no certificates');
        } finally {
            setLoadingManage(false);
        }
    };

    const startEditing = (cert) => {
        setEditingCertId(cert._id);
        setEditTitle(cert.certificateTitle);
    };

    const cancelEditing = () => {
        setEditingCertId(null);
        setEditTitle('');
    };

    const saveTitle = async (id) => {
        try {
            const token = localStorage.getItem('adminToken');
            await axios.put(`${API_URL}/certificates/${id}`,
                { certificateTitle: editTitle },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Update local state
            setUserCertificates(prev => prev.map(c =>
                c._id === id ? { ...c, certificateTitle: editTitle } : c
            ));

            toast.success('Title updated successfully');
            setEditingCertId(null);
        } catch (error) {
            toast.error('Failed to update title');
        }
    };

    const deleteCertificate = async (id) => {
        if (!confirm('Are you sure you want to delete this certificate? This cannot be undone.')) return;

        try {
            const token = localStorage.getItem('adminToken');
            await axios.delete(`${API_URL}/certificates/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Update local state
            setUserCertificates(prev => prev.filter(c => c._id !== id));
            toast.success('Certificate deleted successfully');
        } catch (error) {
            toast.error('Failed to delete certificate');
        }
    };

    return (
        <div className="certificate-management-container animate-fade-in">
            <div className="step-header">
                <h2>Manage User Certificates</h2>
            </div>

            <form onSubmit={handleManageSearch} className="search-form">
                <div className="search-input-group compound-search-group">
                    <div className="year-select-wrapper">
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="year-select"
                        >
                            <option value="2023">2023</option>
                            <option value="2024">2024</option>
                            <option value="2025">2025</option>
                            <option value="2026">2026</option>
                        </select>
                    </div>
                    <div className="search-input-wrapper flex-grow">
                        <div className="prefix-display">AKVORA:{selectedYear}:</div>
                        <input
                            type="text"
                            placeholder="001"
                            value={idSuffix}
                            onChange={(e) => setIdSuffix(e.target.value)}
                            className="search-input with-prefix"
                            required
                        />
                    </div>
                </div>
                <button type="submit" className="action-btn search-btn" disabled={loadingManage}>
                    {loadingManage ? <Loader2 size={20} className="animate-spin" /> : 'Search & Manage'}
                </button>
            </form>

            {manageUser && (
                <div className="manage-results-section animate-slide-up">
                    <div className="user-found-card" style={{ marginTop: '24px', background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                        <div className="user-avatar-placeholder" style={{ color: '#16a34a' }}>
                            <User size={24} />
                        </div>
                        <div className="user-info">
                            <h3>{manageUser.firstName} {manageUser.lastName}</h3>
                            <p>
                                <span className="user-detail-item"><BadgeCheck size={14} /> {manageUser.akvoraId}</span>
                                <span style={{ opacity: 0.5 }}>|</span>
                                <span>{manageUser.email}</span>
                            </p>
                        </div>
                    </div>

                    <h3 style={{ marginBottom: '16px', color: '#374151', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BadgeCheck size={20} className="icon-primary" /> Issued Certificates ({userCertificates.length})
                    </h3>

                    {userCertificates.length === 0 ? (
                        <div className="no-data-message" style={{ textAlign: 'center', padding: '2rem', color: '#6b7280', background: '#f9fafb', borderRadius: '12px', border: '1px dashed #e5e7eb' }}>
                            <FileText size={32} style={{ opacity: 0.5, marginBottom: '8px' }} />
                            <p>No certificates found for this user.</p>
                        </div>
                    ) : (
                        <div className="certificates-list">
                            {userCertificates.map(cert => (
                                <div key={cert._id} className="admin-cert-card">
                                    <div className="cert-card-icon">
                                        <FileText size={24} />
                                    </div>
                                    <div className="cert-card-content">
                                        {editingCertId === cert._id ? (
                                            <div className="edit-title-group">
                                                <input
                                                    type="text"
                                                    value={editTitle}
                                                    onChange={(e) => setEditTitle(e.target.value)}
                                                    className="edit-title-input"
                                                    autoFocus
                                                />
                                                <div className="edit-actions">
                                                    <button onClick={() => saveTitle(cert._id)} className="icon-btn save-btn" title="Save">
                                                        <Save size={16} />
                                                    </button>
                                                    <button onClick={cancelEditing} className="icon-btn cancel-btn" title="Cancel">
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <h4>{cert.certificateTitle}</h4>
                                        )}
                                        <div className="cert-meta">
                                            <span>Issued: {new Date(cert.createdAt).toLocaleDateString()}</span>
                                            {cert.eventId && <span> • Event: {cert.eventId.title}</span>}
                                        </div>
                                    </div>
                                    <div className="cert-card-actions">
                                        <a
                                            href={cert.certificateFileId
                                                ? `${API_URL}/files/admin/view/${cert.certificateFileId}`
                                                : `${API_URL.replace('/api', '')}${cert.certificateUrl}`
                                            }
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="icon-btn view-btn"
                                            title="View"
                                        >
                                            <ExternalLink size={18} />
                                        </a>
                                        {!editingCertId && (
                                            <button onClick={() => startEditing(cert)} className="icon-btn edit-btn" title="Edit Title">
                                                <Edit2 size={18} />
                                            </button>
                                        )}
                                        <button onClick={() => deleteCertificate(cert._id)} className="icon-btn delete-btn" title="Delete">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default AdminCertificateManage;
