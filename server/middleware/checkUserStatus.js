/**
 * Middleware to check user status and restrict access for blocked users
 * Blocked users can only access profile routes
 * This middleware should be applied AFTER verifyClerkToken
 */
export function checkUserStatus(req, res, next) {
  // Check if user status was set by verifyClerkToken middleware
  if (req.userStatus) {
    // Check status field first, then fallback to isDeleted/isBlocked
    const status = req.userStatus.status || 'ACTIVE';
    
    // Always block deleted users
    if (status === 'DELETED' || req.userStatus.isDeleted) {
      return res.status(403).json({ 
        error: 'Your account has been deleted by admin' 
      });
    }
    
    // Check if user is blocked
    if (status === 'BLOCKED' || req.userStatus.isBlocked) {
      // Block access to all routes (profile routes are handled before this middleware)
      return res.status(403).json({ 
        error: 'Your account has been blocked by admin. Please contact support.' 
      });
    }
  }
  
  // User is active, allow access
  next();
}

