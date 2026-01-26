import { useState, useEffect, useCallback } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Cropper from 'react-easy-crop';
import { useDbUser } from '../contexts/UserContext';
import './Profile.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function Profile() {
    const { user } = useUser();
    const { getToken } = useAuth();
    const { isBlocked: globalBlocked, refreshUser } = useDbUser();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [akvoraId, setAkvoraId] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [avatarPreview, setAvatarPreview] = useState('');
    const [avatarFile, setAvatarFile] = useState(null);
    const [cropModalOpen, setCropModalOpen] = useState(false);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const [localImage, setLocalImage] = useState('');
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        certificateName: ''
    });


    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            setFetching(true);
            const token = await getToken();
            const response = await axios.get(`${API_URL}/users/profile`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (response.data.success) {
                const userData = response.data.user;
                setFormData({
                    firstName: userData.firstName || '',
                    lastName: userData.lastName || '',
                    email: userData.email || user?.primaryEmailAddress?.emailAddress || '',
                    phone: userData.phone || '',
                    certificateName: userData.certificateName || ''
                });
                setAkvoraId(userData.akvoraId || '');
                setAvatarUrl(userData.avatarUrl || '');
                setAvatarPreview(userData.avatarUrl || '');


            }
        } catch (error) {
            // Pre-fill with Clerk data for new users
            if (error.response?.status === 404 || !error.response) {
                if (user) {
                    const email = user.primaryEmailAddress?.emailAddress ||
                        user.emailAddresses?.[0]?.emailAddress ||
                        '';
                    setFormData({
                        firstName: user.firstName || '',
                        lastName: user.lastName || '',
                        email: email,
                        phone: user.primaryPhoneNumber?.phoneNumber || '',
                        certificateName: ''
                    });
                }
            } else {
                console.error('Error fetching profile:', error);
                setError('Failed to load profile. Please try again.');
            }
        } finally {
            setFetching(false);
        }
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleAvatarChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            setError('File too large. Please upload an image under 2MB.');
            return;
        }

        const objectUrl = URL.createObjectURL(file);
        setLocalImage(objectUrl);
        setCropModalOpen(true);
    };

    const onCropComplete = useCallback((_, croppedPixels) => {
        setCroppedAreaPixels(croppedPixels);
    }, []);

    const getCroppedBlob = async () => {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.src = localImage;
            image.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const { width, height, x, y } = croppedAreaPixels;
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(image, x, y, width, height, 0, 0, width, height);
                canvas.toBlob(
                    (blob) => {
                        if (!blob) return reject(new Error('Canvas is empty'));
                        resolve(blob);
                    },
                    'image/jpeg',
                    0.9
                );
            };
            image.onerror = reject;
        });
    };

    const handleCropSave = async () => {
        try {
            const blob = await getCroppedBlob();
            const croppedUrl = URL.createObjectURL(blob);
            const croppedFile = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
            setAvatarFile(croppedFile);
            setAvatarPreview(croppedUrl);
            setCropModalOpen(false);
            setError('');
        } catch (err) {
            setError('Failed to crop image. Please try again.');
        }
    };

    const uploadAvatarIfNeeded = async (token) => {
        if (!avatarFile) return avatarUrl;
        const form = new FormData();
        form.append('avatar', avatarFile);
        const response = await axios.post(`${API_URL}/users/avatar`, form, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'multipart/form-data'
            }
        }).catch((err) => {
            if (err.response?.data?.error) {
                throw new Error(err.response.data.error);
            }
            throw err;
        });
        return response.data.avatarUrl;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (globalBlocked) return;

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const token = await getToken();
            const uploadedAvatarUrl = await uploadAvatarIfNeeded(token);

            const response = await axios.post(
                `${API_URL}/users/create-profile`,
                { ...formData, avatarUrl: uploadedAvatarUrl },
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            if (response.data.success) {
                setSuccess('Profile saved successfully!');
                setAkvoraId(response.data.user.akvoraId);
                setAvatarUrl(uploadedAvatarUrl || response.data.user.avatarUrl || '');
                refreshUser(); // Update global context
                setTimeout(() => {
                    navigate('/dashboard');
                }, 1200);
            }
        } catch (err) {
            const errorMessage = err.response?.data?.error || err.message || 'Failed to save profile';
            console.error('Profile save error:', err);
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <div className="profile-container">
                <div>Loading profile...</div>
            </div>
        );
    }

    return (
        <div className="profile-container">
            {globalBlocked && (
                <div className="blocked-alert">
                    <div className="blocked-alert-header">
                        <h3 className="blocked-title">⚠️ Account Blocked</h3>
                    </div>
                    <div className="blocked-alert-body">
                        <p className="blocked-message">
                            Your account has been blocked by the AKVORA admin.
                        </p>
                        <div className="blocked-contact">
                            <p>Please contact support if you believe this is an error:</p>
                            <div className="contact-info">
                                <p>📧 Email: <strong>support@akvora.com</strong></p>
                                <p>📞 Phone: <strong>+91-XXXXXXXXXX</strong></p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="profile-header-card">
                <div className="avatar-block">
                    <div className="avatar-preview">
                        {avatarPreview ? (
                            <img src={avatarPreview} alt="Avatar" />
                        ) : (
                            <div className="avatar-placeholder">Add Photo</div>
                        )}
                    </div>
                    {!globalBlocked && (
                        <label className="avatar-upload-btn">
                            Upload Photo
                            <input type="file" accept="image/*" onChange={handleAvatarChange} />
                        </label>
                    )}
                    <p className="avatar-hint">PNG/JPG, up to 2MB</p>
                </div>

                <div className="id-block">
                    <p className="label">AKVORA ID</p>
                    <h2>{akvoraId || 'Pending'}</h2>
                    <p className="muted">{formData.email}</p>
                    {success && <div className="success-message compact">{success}</div>}
                    {error && <div className="error-message compact">{error}</div>}
                </div>
            </div>

            <div className="profile-box">
                <h1>{globalBlocked ? 'Your Profile' : 'Complete Your Profile'}</h1>

                <form onSubmit={handleSubmit} className="profile-form">
                    <div className="form-group">
                        <label>AKVORA ID (Read-only)</label>
                        <input
                            type="text"
                            value={akvoraId || 'Will Be Generated On Save'}
                            disabled
                            style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold' }}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="firstName">First Name</label>
                        <input
                            type="text"
                            id="firstName"
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleChange}
                            required
                            disabled={globalBlocked}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="lastName">Last Name</label>
                        <input
                            type="text"
                            id="lastName"
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleChange}
                            required
                            disabled={globalBlocked}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            disabled={globalBlocked}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="phone">Phone</label>
                        <input
                            type="tel"
                            id="phone"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            disabled={globalBlocked}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="certificateName">Name in Certificate </label>
                        <input
                            type="text"
                            id="certificateName"
                            name="certificateName"
                            value={formData.certificateName}
                            onChange={handleChange}
                            disabled={globalBlocked}
                            required
                        />
                    </div>

                    {!globalBlocked && (
                        <div className="form-actions">
                            <button type="submit" disabled={loading} className="submit-btn">
                                {loading ? 'Saving...' : 'Save Profile'}
                            </button>
                        </div>
                    )}
                </form>
            </div>



            {cropModalOpen && (
                <div className="cropper-overlay">
                    <div className="cropper-modal">
                        <h3>Crop your photo</h3>
                        <div className="cropper-area">
                            <Cropper
                                image={localImage}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onCropComplete={onCropComplete}
                            />
                        </div>
                        <div className="cropper-controls">
                            <label>
                                Zoom
                                <input
                                    type="range"
                                    min="1"
                                    max="3"
                                    step="0.1"
                                    value={zoom}
                                    onChange={(e) => setZoom(Number(e.target.value))}
                                />
                            </label>
                            <div className="cropper-actions">
                                <button type="button" className="secondary-btn" onClick={() => setCropModalOpen(false)}>
                                    Cancel
                                </button>
                                <button type="button" className="primary-btn" onClick={handleCropSave}>
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Profile;
