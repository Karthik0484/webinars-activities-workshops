import { useState, useEffect } from 'react';
import { SignIn as ClerkSignIn, useAuth, useUser } from '@clerk/clerk-react';
import { useSocket } from '../contexts/SocketContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import EventRegistrationModal from '../components/EventRegistrationModal';
import { calculateEventStatus, getStatusLabel } from '../utils/eventStatus';
import { formatPrice } from '../utils/currency';
import './Webinars.css';


const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function Webinars() {
  const [webinars, setWebinars] = useState([]);
  const [myRegistrations, setMyRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [selectedWebinar, setSelectedWebinar] = useState(null);
  const { isSignedIn, isLoaded: isUserLoaded, user } = useUser();
  const { getToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleStatusUpdate = (data) => {
      setMyRegistrations(prev => prev.map(reg => {
        if (reg.id === data.workshop.id) {
          return {
            ...reg,
            registrationStatus: data.status,
            status: data.status === 'approved' ? 'Approved' :
              data.status === 'rejected' ? 'Rejected' : 'Pending',
            meetingLink: data.meetingLink || reg.meetingLink,
            rejectionReason: data.status === 'rejected' ? (data.message || 'Rejected by admin') : null
          };
        }
        return reg;
      }));

      // If needed, show toast or rely on notification component
      // toast(data.message, { icon: data.status === 'approved' ? '✅' : 'ℹ️' });
    };

    const handleRegistrationCreated = () => {
      fetchMyRegistrations();
      fetchWebinars();
    };

    socket.on('registration:status-updated', handleStatusUpdate);
    socket.on('registration:created', handleRegistrationCreated);

    return () => {
      socket.off('registration:status-updated', handleStatusUpdate);
      socket.off('registration:created', handleRegistrationCreated);
    };
  }, [socket]);

  useEffect(() => {
    fetchWebinars();
    if (isSignedIn) {
      fetchMyRegistrations();
    }
  }, [isSignedIn]);

  // Handle Auto-Registration from Dashboard/Link
  useEffect(() => {
    const registerId = searchParams.get('register');
    if (registerId && webinars.length > 0 && isUserLoaded) {
      if (!isSignedIn) {
        toast.error('Please sign in to register');
        // Clear param to avoid loop/confusing state
        searchParams.delete('register');
        setSearchParams(searchParams);
        return;
      }

      const webinarToRegister = webinars.find(w => w._id === registerId);
      if (webinarToRegister) {
        // If it's a paid event or we want to show details first in modal
        if (webinarToRegister.price > 0) {
          setSelectedWebinar(webinarToRegister);
        } else {
          // For free events, we could auto-trigger handleRegister, 
          // but opening the modal (or triggering logic) is safer.
          // Workshops uses modal for all. Webinars handleRegister handles logic.
          // Let's open logic directly? 
          // "Payment page opens immediately".
          // If price > 0, modal is payment page.
          // If price == 0, handleRegister does it instantly.
          // Let's trigger handleRegister directly for free if that's the desired flow,
          // OR just open selectedWebinar (which might open modal?)
          // logic in return statement:
          // {selectedWebinar && <EventRegistrationModal ... />}

          // If free, handleRegister calls API directly.
          // If paid, it setsSelectedWebinar.

          // Let's reuse handleRegister logic but we need to wait for render?
          // No, let's just call it.
          handleRegister(webinarToRegister);
        }

        // Clear param after handling
        searchParams.delete('register');
        setSearchParams(searchParams);
      }
    }
  }, [searchParams, webinars, isSignedIn, isUserLoaded]);

  const fetchMyRegistrations = async () => {
    try {
      const token = await getToken();
      const response = await axios.get(`${API_URL}/registrations/history`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (response.data.success) {
        setMyRegistrations(response.data.history.webinars || []);
      }
    } catch (error) {
      console.error('Failed to fetch registrations', error);
    }
  };

  const fetchWebinars = async () => {
    try {
      const response = await axios.get(`${API_URL}/public-events?type=webinar`);
      setWebinars(response.data.events);
    } catch (error) {
      setError('Failed to fetch webinars');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (webinar) => {
    if (!isSignedIn) {
      toast.error('Please sign in to register for webinars');
      return;
    }

    // If paid event, show modal
    if (webinar.price > 0) {
      setSelectedWebinar(webinar);
      return;
    }

    // Free event - Auto register using unified endpoint
    try {
      const token = await getToken();
      const response = await axios.post(`${API_URL}/registrations`, {
        workshopId: webinar._id,
        nameOnCertificate: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User',
        upiReference: 'FREE-WEBINAR' // Dummy ref for validation pass (controller handles proper ID)
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success) {
        toast.success(response.data.message);
        fetchWebinars();
        fetchMyRegistrations();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to register for webinar');
    }
  };

  const handleImageClick = (imageUrl, title) => {
    setPreviewImage({ url: imageUrl, title });
  };

  const closePreview = () => {
    setPreviewImage(null);
  };

  if (loading) {
    return (
      <div>
        <div className="events-loading">
          <div className="loading-spinner"></div>
          <p>Loading webinars...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="events-container">
        <div className="events-header">
          <h1>Webinars</h1>
          <p>Join our live online sessions and learn from industry experts</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        {webinars.length === 0 ? (
          <div className="no-events">
            <h3>No webinars scheduled yet</h3>
            <p>Check back soon for upcoming webinars!</p>
          </div>
        ) : (
          <div className="events-grid">
            {webinars.map((webinar) => (
              <div key={webinar._id} className="event-card">
                <div className="event-image">
                  {webinar.imageUrl ? (
                    <img
                      src={`${API_URL.replace('/api', '')}${webinar.imageUrl}`}
                      alt={webinar.title}
                      onClick={() => handleImageClick(`${API_URL.replace('/api', '')}${webinar.imageUrl}`, webinar.title)}
                      className="event-image-clickable"
                    />
                  ) : (
                    <div className="event-placeholder">
                      <div className="event-type-badge webinar">Webinar</div>
                    </div>
                  )}
                </div>

                <div className="event-content">
                  <div className="event-header">
                    <h3>{webinar.title}</h3>
                    <div className="event-badges">
                      <span className={`status-badge-inline ${calculateEventStatus(webinar.date, webinar.endDate)}`}>
                        {getStatusLabel(calculateEventStatus(webinar.date, webinar.endDate))}
                      </span>

                      <span className="event-price">
                        {formatPrice(webinar.price)}
                      </span>
                    </div>
                  </div>


                  <p className="event-description">{webinar.description}</p>

                  <div className="event-details">
                    <div className="event-detail">
                      <strong>Start Date:</strong> {new Date(webinar.date).toLocaleDateString()}
                    </div>
                    <div className="event-detail">
                      <strong>End Date:</strong> {webinar.endDate ? new Date(webinar.endDate).toLocaleDateString() : 'N/A'}
                    </div>
                    <div className="event-detail">
                      <strong>Time:</strong> {new Date(webinar.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="event-detail">
                      <strong>Duration:</strong> {webinar.duration}
                    </div>
                    <div className="event-detail">
                      <strong>Instructor:</strong> {webinar.instructor}
                    </div>
                    <div className="event-detail">
                      <strong>Participants:</strong> {webinar.participants?.length || 0} enrolled
                    </div>
                  </div>

                  {webinar.tags && webinar.tags.length > 0 && (
                    <div className="event-tags">
                      {webinar.tags.map((tag, index) => (
                        <span key={index} className="tag">{tag}</span>
                      ))}
                    </div>
                  )}

                  <div className="event-actions">
                    {(() => {
                      // Check our participation history first (source of truth for pending/paid)
                      const myRegistration = myRegistrations.find(r => r.id === webinar._id);

                      // Also check the public participant list (fallback for legacy/free auto-approved)
                      const isInParticipantList = webinar.participants?.some(
                        participant => participant.userId === user?.id
                      );

                      const registrationStatus = myRegistration?.registrationStatus || (isInParticipantList ? 'approved' : null);
                      const meetingLink = myRegistration?.meetingLink || webinar.meetingLink;

                      if (!isSignedIn) {
                        return (
                          <button
                            className="register-btn"
                            onClick={() => toast.error('Please sign in to register')}
                          >
                            Sign In to Register
                          </button>
                        );
                      }

                      if (registrationStatus) {
                        if (registrationStatus === 'pending') {
                          return (
                            <button className="register-btn pending" disabled style={{ background: '#f59e0b', cursor: 'not-allowed' }}>
                              Verification Pending
                            </button>
                          );
                        }

                        if (registrationStatus === 'rejected') {
                          return (
                            <div className="rejected-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                              {myRegistration.rejectionReason && (
                                <p style={{ color: '#ef4444', fontSize: '13px', margin: 0, textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', padding: '6px', borderRadius: '4px' }}>
                                  Reason: {myRegistration.rejectionReason}
                                </p>
                              )}
                              <button
                                className="register-btn"
                                onClick={() => handleRegister(webinar)}
                                style={{ background: '#ef4444' }}
                              >
                                Register Again
                              </button>
                            </div>
                          );
                        }

                        // Approved / Registered
                        return (
                          <div className="registered-actions" style={{ display: 'flex', gap: '10px' }}>
                            <button className="register-btn registered" disabled>
                              ✓ Registered
                            </button>
                            {meetingLink ? (
                              <a
                                href={meetingLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="register-btn"
                                style={{ textDecoration: 'none', textAlign: 'center', background: '#4f46e5' }}
                              >
                                Join Meeting
                              </a>
                            ) : (
                              // Fallback if meeting link is not yet available but user is approved (e.g. legacy or not yet added to event)
                              webinar.meetingLink && registrationStatus === 'approved' && (
                                <a
                                  href={webinar.meetingLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="register-btn"
                                  style={{ textDecoration: 'none', textAlign: 'center', background: '#4f46e5' }}
                                >
                                  Join Meeting
                                </a>
                              )
                            )}
                          </div>
                        );
                      } else {
                        return (
                          <button
                            className="register-btn"
                            onClick={() => handleRegister(webinar)}
                          >
                            Register Now
                          </button>
                        );
                      }
                    })()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {previewImage && (
        <div className="image-preview-modal" onClick={closePreview}>
          <div className="preview-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-preview" onClick={closePreview}>×</button>
            <img src={previewImage.url} alt={previewImage.title} />
            <p className="preview-title">{previewImage.title}</p>
          </div>
        </div>
      )}

      {selectedWebinar && (
        <EventRegistrationModal
          event={selectedWebinar}
          onClose={() => setSelectedWebinar(null)}
          onSuccess={() => {
            fetchWebinars();
            if (isSignedIn) fetchMyRegistrations();
            setSelectedWebinar(null);
          }}
        />
      )}
    </div>
  );
}

export default Webinars;





