import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';
import toast from 'react-hot-toast';
import { Download, Award, Calendar, Eye, Search, X } from 'lucide-react';
import './UserCertificates.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function UserCertificates() {
    const [certificates, setCertificates] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const { getToken } = useAuth();
    const [error, setError] = useState(null);
    const [viewingCert, setViewingCert] = useState(null);

    useEffect(() => {
        fetchCertificates();
    }, []);

    const fetchCertificates = async () => {
        try {
            const token = await getToken();
            const response = await axios.get(`${API_URL}/certificates/my`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCertificates(response.data.certificates);
        } catch (err) {
            console.error('Error fetching certificates:', err);
            setError('Failed to load certificates');
        } finally {
            setLoading(false);
        }
    };

    const fetchSecureFile = async (url) => {
        try {
            const token = await getToken();
            const response = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });
            return URL.createObjectURL(response.data);
        } catch (error) {
            console.error('Secure fetch error:', error);
            throw error;
        }
    };

    const handleView = async (cert) => {
        const url = `${API_URL.replace('/api', '')}${cert.certificateUrl}`;

        try {
            // For mobile, we might want to try opening a new tab, but with Auth it's hard.
            // Best to show a modal with a "Download" button that triggers the blob download.
            // Or just use the same modal logic for all.

            setViewingCert({ ...cert, loading: true });

            const objectUrl = await fetchSecureFile(url);

            setViewingCert({
                ...cert,
                fullUrl: objectUrl,
                originalUrl: url, // Keep original for reference if needed
                loading: false
            });

        } catch (error) {
            toast.error('Failed to load certificate file');
            setViewingCert(null);
        }
    };

    const handleDownload = async (cert) => {
        try {
            const url = `${API_URL.replace('/api', '')}${cert.certificateUrl}`;
            const token = await getToken();
            const response = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });

            // Create download link
            const objectUrl = URL.createObjectURL(response.data);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = cert.certificateTitle || 'Certificate';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(objectUrl);

        } catch (error) {
            console.error("Download error", error);
            toast.error("Failed to download certificate");
        }
    };

    const closeModal = () => {
        if (viewingCert?.fullUrl) {
            URL.revokeObjectURL(viewingCert.fullUrl);
        }
        setViewingCert(null);
    };

    const filteredCertificates = certificates.filter(cert => {
        const title = cert.certificateTitle || cert.eventId?.title || 'Achievement Certificate';
        return title.toLowerCase().includes(searchTerm.toLowerCase());
    });

    if (loading) return <div className="loading">Loading certificates...</div>;

    return (
        <div className="certificates-page">
            <div className="page-header">
                <h1>My Certificates</h1>
                <p>Verify and download your earned achievements</p>
            </div>

            <div className="certificates-search-container" style={{ maxWidth: '600px', margin: '0 0 2rem 0', position: 'relative' }}>
                <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                <input
                    type="text"
                    placeholder="Search certificates..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '12px 12px 12px 48px',
                        borderRadius: '12px',
                        border: '1px solid #e5e7eb',
                        fontSize: '16px',
                        outline: 'none',
                        transition: 'all 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
            </div>

            {filteredCertificates.length === 0 ? (
                <div className="no-certificates">
                    <Award size={48} className="placeholder-icon" />
                    <h3>{searchTerm ? `No certificates found matching "${searchTerm}"` : 'No certificates yet'}</h3>
                    {!searchTerm && <p>Complete workshops and events to earn certificates!</p>}
                </div>
            ) : (
                <div className="certificates-grid">
                    {filteredCertificates.map((cert) => (
                        <div key={cert._id} className="certificate-card">
                            <div className="certificate-preview" onClick={() => handleView(cert)}>
                                <div className="pdf-preview">
                                    <Award size={40} />
                                    <span>View Certificate</span>
                                </div>
                            </div>
                            <div className="certificate-info">
                                <h3 title={cert.certificateTitle || cert.eventId?.title}>{cert.certificateTitle || cert.eventId?.title || 'Achievement Certificate'}</h3>
                                <div className="certificate-meta">
                                    <span><Calendar size={14} /> Issued: {new Date(cert.issuedAt).toLocaleDateString()}</span>
                                </div>
                                <div className="certificate-actions" style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                    <button
                                        onClick={() => handleView(cert)}
                                        className="view-btn"
                                        style={{
                                            flex: 1,
                                            padding: '8px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px',
                                            background: '#f3f4f6',
                                            color: '#374151',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontWeight: 500
                                        }}
                                    >
                                        <Eye size={16} /> View
                                    </button>
                                    <button
                                        onClick={() => handleDownload(cert)}
                                        className="download-btn"
                                        style={{
                                            flex: 1,
                                            padding: '8px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px',
                                            background: '#4f46e5',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontWeight: 500
                                        }}
                                    >
                                        <Download size={16} /> Download
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* PREVIEW MODAL */}
            {viewingCert && (
                <div className="modal-overlay" onClick={closeModal} style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)', zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
                }}>
                    <div className="preview-modal-content" onClick={e => e.stopPropagation()} style={{
                        background: 'transparent', maxWidth: '90vw', maxHeight: '90vh', position: 'relative'
                    }}>
                        <button onClick={closeModal} style={{
                            position: 'absolute', top: '-40px', right: 0,
                            background: 'none', border: 'none', color: 'white', cursor: 'pointer'
                        }}>
                            <X size={32} />
                        </button>

                        {viewingCert.loading ? (
                            <div style={{ color: 'white' }}>Loading certificate...</div>
                        ) : (
                            <>
                                {/* Check extension from ORIGINAL URL string to decide iframe (PDF) vs Img */}
                                {viewingCert.certificateUrl.toLowerCase().endsWith('.pdf') ? (
                                    <iframe
                                        src={viewingCert.fullUrl}
                                        style={{ width: '80vw', height: '80vh', border: 'none', background: 'white', borderRadius: '8px' }}
                                        title="Certificate Preview"
                                    />
                                ) : (
                                    <img
                                        src={viewingCert.fullUrl}
                                        alt="Certificate Full View"
                                        style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '8px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}
                                    />
                                )}
                            </>
                        )}

                        <div style={{ textAlign: 'center', marginTop: '16px' }}>
                            <button
                                onClick={() => handleDownload(viewingCert)}
                                className="download-btn"
                                style={{ display: 'inline-flex', padding: '10px 24px', fontSize: '16px', cursor: 'pointer', border: 'none', borderRadius: '6px', background: 'white', color: '#4f46e5', alignItems: 'center', gap: '8px' }}
                            >
                                <Download size={20} /> Download Original
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default UserCertificates;
