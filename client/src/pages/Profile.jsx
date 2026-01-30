import { useState, useEffect, useCallback } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import Cropper from 'react-easy-crop';
import { useDbUser } from '../contexts/UserContext';
import './Profile.css';
import api, { setAuthToken, API_URL } from '../services/api';
import { Camera } from 'lucide-react';


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
            setAuthToken(token);
            const response = await api.get('/users/profile');


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
        const response = await api.post('/users/avatar', form, {
            headers: {
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

            const response = await api.post(
                '/users/create-profile',
                { ...formData, avatarUrl: uploadedAvatarUrl }
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
                            <p>Your account has been blocked due to some of your actions. Contact the details provided below to unblock your Akvora account.</p>
                            <div className="contact-info">
                                <p>📧 Email: <strong>unblockakvora@gmail.com</strong></p>
                                <p>📞 Phone: <strong>9361992041</strong></p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="profile-header-card">
                <div className="avatar-block">
                    <div className="avatar-wrapper">
                        <div className="avatar-preview">
                            {avatarPreview ? (
                                <img src={avatarPreview} alt="Avatar" />
                            ) : (
                                <div className="avatar-placeholder">
                                    {formData.firstName?.[0] || 'U'}
                                </div>
                            )}
                        </div>

                        {!globalBlocked && (
                            <label className="avatar-camera-btn" title="Change Photo">
                                <Camera size={18} />
                                <input type="file" accept="image/*" onChange={handleAvatarChange} />
                            </label>
                        )}
                    </div>
                </div>

                <div className="id-block">
                    {/* Name can go here if desired, otherwise just Email -> ID */}
                    <h2 className="user-name">
                        {formData.firstName} {formData.lastName}
                    </h2>
                    <p className="user-email">{formData.email}</p>

                    <div className="akvora-id-container">
                        <span className="id-label">ID:</span>
                        <code className="akvora-id-text">{akvoraId || 'PENDING'}</code>
                    </div>

                    {success && <div className="success-message compact">{success}</div>}
                    {error && <div className="error-message compact">{error}</div>}
                </div>
            </div>

            <div className="profile-box">
                <h1>{globalBlocked ? 'Your Profile' : 'Complete Your Profile'}</h1>

                <form onSubmit={handleSubmit} className="profile-form">
                    <div className="form-row">
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
                    </div>

                    <div className="form-row">
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

                    <div className="form-group">
                        <label>AKVORA ID (Read-only)</label>
                        <input
                            type="text"
                            value={akvoraId || 'Will Be Generated On Save'}
                            disabled
                            className="akvora-id-input"
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



            {
                cropModalOpen && (
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
