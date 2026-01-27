import { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import EventRegistrationModal from '../components/EventRegistrationModal';
import { calculateEventStatus, getStatusLabel } from '../utils/eventStatus';
import './Workshops.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function Workshops() {
  const [workshops, setWorkshops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const { isSignedIn, isLoaded: isUserLoaded, user } = useUser();
  const { getToken } = useAuth();
  const [selectedWorkshop, setSelectedWorkshop] = useState(null);
  const [myRegistrations, setMyRegistrations] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [isAutoRegistering, setIsAutoRegistering] = useState(searchParams.has('register'));
  const navigate = useNavigate();


  useEffect(() => {
    fetchWorkshops();
    if (isSignedIn) {
      fetchMyRegistrations();
    }
  }, [isSignedIn]);

  useEffect(() => {
    const registerId = searchParams.get('register');
    if (registerId && workshops.length > 0 && isUserLoaded) {
      if (!isSignedIn) {
        toast.error('Please sign in to register');
        // Clear search params to prevent loop
        searchParams.delete('register');
        setSearchParams(searchParams);
        return;
      }

      const workshopToRegister = workshops.find(w => w._id === registerId);
      if (workshopToRegister) {
        setSelectedWorkshop(workshopToRegister);
      }
      setIsAutoRegistering(false);
    }
  }, [searchParams, workshops, isSignedIn, isUserLoaded]);


  const fetchWorkshops = async () => {
    try {
      const response = await axios.get(`${API_URL}/public-events?type=workshop`);
      setWorkshops(response.data.events);
    } catch (error) {
      setError('Failed to fetch workshops');
    } finally {
      setLoading(false);
    }
  };


  const fetchMyRegistrations = async () => {
    try {
      const token = await getToken();
      const response = await axios.get(`${API_URL}/registrations/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMyRegistrations(response.data.registrations);
    } catch (error) {
      console.error('Failed to fetch registrations:', error);
    }
  };

  const isRegistered = (workshopId) => {
    return myRegistrations.some(reg => reg.workshop._id === workshopId);
  };

  const handleRegisterClick = async (workshop) => {
    if (!isSignedIn) {
      toast.error('Please sign in to register for workshops');
      return;
    }

    // Free event - Auto register directly
    if (workshop.price == 0) {
      try {
        const token = await getToken();
        // Use a generic placeholder for free workshops. 
        // The backend will generate a unique FREE-ID if it detects isFree, so this dummy value is just to pass basic non-empty validation if any.
        // Actually, our backend now skips validation if isFree, but passing a string doesn't hurt.
        const response = await axios.post(`${API_URL}/registrations`, {
          workshopId: workshop._id,
          nameOnCertificate: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User',
          upiReference: 'FREE-WORKSHOP'
        }, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (response.data.success) {
          toast.success(response.data.message);
          fetchWorkshops();
          fetchMyRegistrations();
        }
      } catch (error) {
        toast.error(error.response?.data?.error || 'Failed to register for workshop');
      }
      return;
    }

    // Paid event - show modal
    setSelectedWorkshop(workshop);
  };

  const handleImageClick = (imageUrl, title) => {
    setPreviewImage({ url: imageUrl, title });
  };

  const closePreview = () => {
    setPreviewImage(null);
  };

  if (loading || isAutoRegistering) {
    return (
      <div className="events-loading">
        <div className="loading-spinner"></div>
        <p>{isAutoRegistering ? 'Preparing registration form...' : 'Loading workshops...'}</p>
      </div>
    );
  }


  return (
    <div>
      <div className="events-container">
        <div className="events-header">
          <h1>Workshops</h1>
          <p>Hands-on learning experiences with expert guidance</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        {workshops.length === 0 ? (
          <div className="no-events">
            <h3>No workshops scheduled yet</h3>
            <p>Check back soon for upcoming workshops!</p>
          </div>
        ) : (
          <div className="events-grid">
            {workshops.map((workshop) => (
              <div key={workshop._id} className="event-card">
                <div className="event-image">
                  {workshop.imageUrl ? (
                    <img
                      src={`${API_URL.replace('/api', '')}${workshop.imageUrl}`}
                      alt={workshop.title}
                      onClick={() => handleImageClick(`${API_URL.replace('/api', '')}${workshop.imageUrl}`, workshop.title)}
                      className="event-image-clickable"
                    />
                  ) : (
                    <div className="event-placeholder">
                      <div className="event-type-badge workshop">Workshop</div>
                    </div>
                  )}
                </div>

                <div className="event-content">
                  <div className="event-header">
                    <h3>{workshop.title}</h3>
                    <div className="event-badges">
                      <span className={`status-badge-inline ${calculateEventStatus(workshop.date, workshop.endDate)}`}>
                        {getStatusLabel(calculateEventStatus(workshop.date, workshop.endDate))}
                      </span>

                      <span className="event-price">
                        {workshop.price === 0 ? 'Free' : `$${workshop.price}`}
                      </span>
                    </div>
                  </div>


                  <p className="event-description">{workshop.description}</p>

                  <div className="event-details">
                    <div className="event-detail">
                      <strong>Start Date:</strong> {new Date(workshop.date).toLocaleDateString()}
                    </div>
                    <div className="event-detail">
                      <strong>End Date:</strong> {workshop.endDate ? new Date(workshop.endDate).toLocaleDateString() : 'N/A'}
                    </div>
                    <div className="event-detail">
                      <strong>Time:</strong> {new Date(workshop.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="event-detail">
                      <strong>Duration:</strong> {workshop.duration}
                    </div>
                    <div className="event-detail">
                      <strong>Instructor:</strong> {workshop.instructor}
                    </div>
                    <div className="event-detail">
                      <strong>Location:</strong> {workshop.location || 'Online'}
                    </div>
                  </div>

                  {workshop.tags && workshop.tags.length > 0 && (
                    <div className="event-tags">
                      {workshop.tags.map((tag, index) => (
                        <span key={index} className="tag">{tag}</span>
                      ))}
                    </div>
                  )}

                  <div className="event-actions">
                    {(() => {
                      const registration = myRegistrations.find(reg => reg.workshop?._id === workshop._id);

                      if (!registration) {
                        return (
                          <button
                            onClick={() => handleRegisterClick(workshop)}
                            className="register-btn"
                          >
                            Register Now
                          </button>
                        );
                      }

                      const status = registration.status;
                      const paymentStatus = registration.paymentStatus;
                      const rejectionReason = registration.rejectionReason;

                      if (status === 'approved' || paymentStatus === 'APPROVED') {
                        return (
                          <div className="registered-actions">
                            <button className="register-btn registered" disabled>
                              Registered
                            </button>
                            {registration.workshop?.meetingLink && (
                              <a
                                href={registration.workshop.meetingLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="join-meeting-btn"
                              >
                                Join Meeting
                              </a>
                            )}
                          </div>
                        );
                      }

                      if (status === 'rejected' || paymentStatus === 'REJECTED') {
                        return (
                          <div className="rejected-container">
                            <div className="status-badge-container">
                              <span className="rejected-badge">❌ Rejected</span>
                              {rejectionReason && (
                                <p className="rejection-reason-text">
                                  Reason: {rejectionReason}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => handleRegisterClick(workshop)}
                              className="register-btn re-register"
                            >
                              Register Again
                            </button>
                          </div>
                        );
                      }

                      return (
                        <button className="register-btn pending" disabled>
                          Verification Pending
                        </button>
                      );
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

      {selectedWorkshop && (
        <EventRegistrationModal
          event={selectedWorkshop}
          onClose={() => {
            setSelectedWorkshop(null);
            if (searchParams.has('register')) {
              searchParams.delete('register');
              setSearchParams(searchParams);
            }
          }}
          onSuccess={() => {
            fetchWorkshops();
            if (isSignedIn) fetchMyRegistrations();
          }}
        />
      )}

    </div>
  );
}

export default Workshops;





