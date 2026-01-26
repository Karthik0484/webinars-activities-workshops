import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';
import toast from 'react-hot-toast';
import './EventRegistrationModal.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function EventRegistrationModal({ event, onClose, onSuccess }) {
    const { getToken } = useAuth();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [profile, setProfile] = useState(null);
    const [upiReference, setUpiReference] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const token = await getToken();
            const response = await axios.get(`${API_URL}/users/profile`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProfile(response.data.user);
        } catch (error) {
            console.error('Failed to fetch profile:', error);
            toast.error('Failed to load your profile details');
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const validateUpi = (value) => {
        const regex = /^[0-9]{10,18}$/;
        return regex.test(value);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateUpi(upiReference)) {
            setError('Invalid UPI reference number. Must be 10-18 digits.');
            return;
        }

        setSubmitting(true);
        try {
            const token = await getToken();
            const response = await axios.post(`${API_URL}/registrations`, {
                workshopId: event._id, // Sending event._id as workshopId for backend compatibility
                nameOnCertificate: profile.certificateName || `${profile.firstName} ${profile.lastName}`,
                upiReference
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                toast.success(response.data.message);
                onSuccess();
                onClose();
            }
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to submit registration');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="registration-modal-overlay">
                <div className="registration-modal-content loading">
                    <div className="loading-spinner"></div>
                    <p>Fetching your details...</p>
                </div>
            </div>
        );
    }

    const upiId = event.upiId || 'akvora@upi'; // Fallback UPI ID
    const payeeName = event.payeeName || 'Akvora';
    const amount = event.price || 0;

    // Format: upi://pay?pa=UPI_ID&pn=NAME&am=AMOUNT&cu=INR
    const upiString = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR`;

    return (
        <div className="registration-modal-overlay" onClick={onClose}>
            <div className="registration-modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={onClose}>&times;</button>

                <h2>Event Registration</h2>
                <p className="modal-subtitle">{event.title}</p>

                <form onSubmit={handleSubmit} className="registration-form">
                    <div className="form-section">
                        <h3>Personal Details (Read-only)</h3>
                        <div className="readonly-fields">
                            <div className="form-group">
                                <label>Full Name</label>
                                <input type="text" value={`${profile.firstName} ${profile.lastName}`} readOnly />
                            </div>
                            <div className="form-group">
                                <label>Akvora ID</label>
                                <input type="text" value={profile.akvoraId || 'Not set'} readOnly />
                            </div>
                            <div className="form-group">
                                <label>Email</label>
                                <input type="text" value={profile.email} readOnly />
                            </div>
                            <div className="form-group">
                                <label>Name on Certificate</label>
                                <input type="text" value={profile.certificateName || `${profile.firstName} ${profile.lastName}`} readOnly />
                            </div>
                        </div>
                        <p className="helper-text">If these details are incorrect, please update your profile first.</p>
                    </div>

                    <div className="form-section payment-section">
                        <h3>Payment</h3>
                        <div className="qr-container">
                            <div className="qr-image-wrapper">
                                <QRCodeSVG
                                    value={upiString}
                                    size={200}
                                    level="H"
                                    includeMargin={false}
                                    imageSettings={{
                                        src: "/gpay-logo.png", // We'll add this logo
                                        x: undefined,
                                        y: undefined,
                                        height: 40,
                                        width: 40,
                                        excavate: true,
                                    }}
                                />
                            </div>
                            <div className="qr-details">
                                <p><strong>Payee:</strong> {payeeName}</p>
                                <p><strong>UPI ID:</strong> {upiId}</p>
                                <p className="amount-highlight"><strong>Amount:</strong> ₹{amount}</p>
                                <div className="dynamic-qr-hint">
                                    <p>✨ Auto-fills amount (₹{amount})</p>
                                    <small>Scan with GPay, PhonePe, or Paytm</small>
                                </div>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>UPI Reference Number (UTR)</label>
                            <input
                                type="text"
                                placeholder="Enter 12-digit UPI Reference Number"
                                value={upiReference}
                                onChange={(e) => {
                                    setUpiReference(e.target.value);
                                    setError('');
                                }}
                                required
                            />
                            {error && <span className="error-text">{error}</span>}
                            <p className="helper-text">Enter the correct UPI reference number. Incorrect entries will lead to rejection.</p>
                        </div>
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
                        <button
                            type="submit"
                            className="submit-btn"
                            disabled={submitting || !upiReference || !validateUpi(upiReference)}
                        >
                            {submitting ? 'Submitting...' : 'Register Now'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default EventRegistrationModal;
