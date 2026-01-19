import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import './AdminUsers.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [blockModal, setBlockModal] = useState(null);
  const [blockReason, setBlockReason] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Check if admin is authenticated
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin/login');
      return;
    }

    fetchUsers();
  }, [navigate]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('adminToken');

      const response = await axios.get(`${API_URL}/admin/users`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success) {
        setUsers(response.data.users);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setError(error.response?.data?.error || 'Failed to fetch users');
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
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const openBlockModal = (user) => {
    setBlockModal(user);
    setBlockReason('');
  };

  const closeBlockModal = () => {
    setBlockModal(null);
    setBlockReason('');
  };

  const handleBlock = async () => {
    if (!blockReason.trim()) {
      toast.error('Please provide a block reason');
      return;
    }

    try {
      setActionLoading({ ...actionLoading, [blockModal._id]: true });
      const token = localStorage.getItem('adminToken');
      
      const response = await axios.put(
        `${API_URL}/admin/users/${blockModal._id}/block`,
        { blockReason: blockReason.trim() },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        toast.success('User blocked successfully');
        closeBlockModal();
        fetchUsers(); // Refresh the list
      }
    } catch (error) {
      console.error('Failed to block user:', error);
      toast.error(error.response?.data?.error || 'Failed to block user');
    } finally {
      setActionLoading({ ...actionLoading, [blockModal?._id]: false });
    }
  };

  const handleUnblock = async (userId) => {
    try {
      setActionLoading({ ...actionLoading, [userId]: true });
      const token = localStorage.getItem('adminToken');
      
      const response = await axios.put(
        `${API_URL}/admin/users/${userId}/unblock`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        toast.success('User unblocked successfully');
        fetchUsers(); // Refresh the list
      }
    } catch (error) {
      console.error('Failed to unblock user:', error);
      toast.error(error.response?.data?.error || 'Failed to unblock user');
    } finally {
      setActionLoading({ ...actionLoading, [userId]: false });
    }
  };

  const handleDelete = async (userId) => {
    try {
      setActionLoading({ ...actionLoading, [userId]: true });
      const token = localStorage.getItem('adminToken');
      
      const response = await axios.delete(
        `${API_URL}/admin/users/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        toast.success('User deleted successfully');
        setDeleteConfirm(null);
        fetchUsers(); // Refresh the list
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast.error(error.response?.data?.error || 'Failed to delete user');
    } finally {
      setActionLoading({ ...actionLoading, [userId]: false });
    }
  };

  const confirmDelete = (user) => {
    setDeleteConfirm(user);
  };

  const cancelDelete = () => {
    setDeleteConfirm(null);
  };

  if (loading) {
    return (
      <div className="admin-users">
        <header className="admin-header">
          <div className="admin-header-content">
            <h1>AKVORA Admin Dashboard</h1>
            <div className="admin-user-info">
              <span>Admin</span>
              <button onClick={handleLogout} className="logout-btn">Logout</button>
            </div>
          </div>
        </header>
        <main className="admin-main">
          <div className="admin-loading">Loading users...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="admin-users">
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
                className="nav-btn active"
              >
                Users
              </button>
              <button
                onClick={() => navigate('/admin/user-profiles')}
                className="nav-btn"
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
        <div className="users-section">
          <div className="section-header">
            <h2>Email/Password Users</h2>
            <div className="header-actions">
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="back-btn"
              >
                ← Back to Dashboard
              </button>
              <button
                onClick={fetchUsers}
                className="refresh-btn"
                disabled={loading}
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="users-stats">
            <p>Total Users: <strong>{users.length}</strong></p>
          </div>

          {users.length === 0 ? (
            <div className="no-users">
              <p>No email/password registered users found.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>AKVORA ID</th>
                    <th>Email</th>
                    <th>Auth Provider</th>
                    <th>Status</th>
                    <th>Created Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, index) => (
                    <tr key={user._id}>
                      <td>{index + 1}</td>
                      <td>
                        <span className="akvora-id-badge">
                          {user.akvoraId || 'Pending'}
                        </span>
                      </td>
                      <td>{user.email}</td>
                      <td>
                        <span className="auth-provider-badge">
                          {user.authProvider || 'email'}
                        </span>
                      </td>
                      <td>
                        {(() => {
                          const status = user.status || (user.isDeleted ? 'DELETED' : user.isBlocked ? 'BLOCKED' : 'ACTIVE');
                          if (status === 'DELETED') {
                            return <span className="status-badge deleted">Deleted</span>;
                          } else if (status === 'BLOCKED') {
                            return <span className="status-badge blocked">Blocked</span>;
                          } else {
                            return <span className="status-badge active">Active</span>;
                          }
                        })()}
                      </td>
                      <td>{formatDate(user.createdAt)}</td>
                      <td>
                        <div className="action-buttons">
                          {!user.isDeleted && (
                            <>
                              {(() => {
                                const status = user.status || (user.isDeleted ? 'DELETED' : user.isBlocked ? 'BLOCKED' : 'ACTIVE');
                                if (status === 'BLOCKED') {
                                  return (
                                    <button
                                      onClick={() => handleUnblock(user._id)}
                                      className="action-btn unblock-btn"
                                      disabled={actionLoading[user._id]}
                                      title="Unblock user"
                                    >
                                      {actionLoading[user._id] ? '...' : 'Unblock'}
                                    </button>
                                  );
                                } else if (status === 'ACTIVE') {
                                  return (
                                    <button
                                      onClick={() => openBlockModal(user)}
                                      className="action-btn block-btn"
                                      disabled={actionLoading[user._id]}
                                      title="Block user"
                                    >
                                      Block
                                    </button>
                                  );
                                }
                                return null;
                              })()}
                              <button
                                onClick={() => confirmDelete(user)}
                                className="action-btn delete-btn"
                                disabled={actionLoading[user._id]}
                                title="Delete user permanently"
                              >
                                Delete
                              </button>
                            </>
                          )}
                          {user.isDeleted && (
                            <span className="deleted-label">Deleted</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Block Reason Modal */}
      {blockModal && (
        <div className="modal-overlay">
          <div className="modal-content block-reason-modal">
            <h2>Block User</h2>
            <p>
              Please provide a reason for blocking <strong>{blockModal.email}</strong>
            </p>
            <div className="block-reason-form">
              <label htmlFor="blockReason">
                Block Reason <span className="required">*</span>
              </label>
              <textarea
                id="blockReason"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Enter the reason for blocking this user..."
                rows={5}
                required
                className="block-reason-textarea"
              />
              <p className="block-reason-hint">
                This reason will be displayed to the user when they try to access their account.
              </p>
            </div>
            <div className="modal-actions">
              <button
                onClick={closeBlockModal}
                className="cancel-btn"
                disabled={actionLoading[blockModal._id]}
              >
                Cancel
              </button>
              <button
                onClick={handleBlock}
                className="confirm-block-btn"
                disabled={actionLoading[blockModal._id] || !blockReason.trim()}
              >
                {actionLoading[blockModal._id] ? 'Blocking...' : 'Confirm Block'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content delete-confirm-modal">
            <h2>Confirm Delete</h2>
            <p>
              Are you sure you want to <strong>permanently delete</strong> this user?
            </p>
            <div className="delete-confirm-details">
              <p><strong>Email:</strong> {deleteConfirm.email}</p>
              <p className="warning-text">
                ⚠️ This action cannot be undone. The user will be deleted from Clerk and MongoDB.
              </p>
            </div>
            <div className="modal-actions">
              <button
                onClick={cancelDelete}
                className="cancel-btn"
                disabled={actionLoading[deleteConfirm._id]}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm._id)}
                className="confirm-delete-btn"
                disabled={actionLoading[deleteConfirm._id]}
              >
                {actionLoading[deleteConfirm._id] ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminUsers;

