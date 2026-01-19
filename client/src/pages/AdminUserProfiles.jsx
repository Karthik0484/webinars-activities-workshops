import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './AdminUserProfiles.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function AdminUserProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Check if admin is authenticated
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin/login');
      return;
    }

    fetchProfiles();
  }, [navigate]);

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('adminToken');
      
      const response = await axios.get(`${API_URL}/admin/user-profiles`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success) {
        setProfiles(response.data.profiles);
      }
    } catch (error) {
      console.error('Failed to fetch user profiles:', error);
      setError(error.response?.data?.error || 'Failed to fetch user profiles');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminData');
    navigate('/admin/login');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="admin-user-profiles">
        <header className="admin-header">
          <div className="admin-header-content">
            <h1>AKVORA Admin Dashboard</h1>
            <div className="admin-user-info">
              <nav className="admin-nav">
                <button
                  onClick={() => navigate('/admin/dashboard')}
                  className="nav-btn"
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
                  className="nav-btn active"
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
          <div className="admin-loading">Loading user profiles...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="admin-user-profiles">
      <header className="admin-header">
        <div className="admin-header-content">
          <h1>AKVORA Admin Dashboard</h1>
          <div className="admin-user-info">
            <nav className="admin-nav">
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="nav-btn"
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
                className="nav-btn active"
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
        <div className="profiles-section">
          <div className="section-header">
            <h2>User Profiles</h2>
            <div className="header-actions">
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="back-btn"
              >
                ← Back to Dashboard
              </button>
              <button
                onClick={fetchProfiles}
                className="refresh-btn"
                disabled={loading}
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="profiles-stats">
            <p>Total Profiles: <strong>{profiles.length}</strong></p>
            <p>Completed Profiles: <strong>{profiles.filter(p => p.profileCompleted).length}</strong></p>
          </div>

          {profiles.length === 0 ? (
            <div className="no-profiles">
              <p>No user profiles found.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="profiles-table">
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>AKVORA ID</th>
                    <th>User Email</th>
                    <th>First Name</th>
                    <th>Last Name</th>
                    <th>Phone</th>
                    <th>Name in Certificate</th>
                    <th>Profile Status</th>
                    <th>Created Date</th>
                    <th>Updated Date</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((profile, index) => (
                    <tr key={profile._id}>
                      <td>{index + 1}</td>
                      <td>
                        <span className="akvora-id-badge">
                          {profile.akvoraId}
                        </span>
                      </td>
                      <td>{profile.email}</td>
                      <td>{profile.firstName}</td>
                      <td>{profile.lastName}</td>
                      <td>{profile.phone}</td>
                      <td>{profile.certificateName}</td>
                      <td>
                        <span className={`status-badge ${profile.profileCompleted ? 'completed' : 'incomplete'}`}>
                          {profile.profileCompleted ? 'Completed' : 'Incomplete'}
                        </span>
                      </td>
                      <td>{formatDate(profile.createdAt)}</td>
                      <td>{formatDate(profile.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default AdminUserProfiles;

