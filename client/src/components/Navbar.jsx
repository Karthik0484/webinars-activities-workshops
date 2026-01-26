import { Link, useLocation } from 'react-router-dom';
import { useUser, SignOutButton } from '@clerk/clerk-react';
import './Navbar.css';

function Navbar() {
  const { user } = useUser();
  const location = useLocation();

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          <img src="/akvora-logo.png" alt="Akvora" className="navbar-logo" />
          <span>Aravind</span>
        </Link>
        <div className="navbar-menu">
          <Link 
            to="/webinars" 
            className={location.pathname === '/webinars' ? 'active' : ''}
          >
            Webinars
          </Link>
          <Link 
            to="/workshops" 
            className={location.pathname === '/workshops' ? 'active' : ''}
          >
            Workshops
          </Link>
          <Link 
            to="/internships" 
            className={location.pathname === '/internships' ? 'active' : ''}
          >
            Internships
          </Link>
        </div>
        <div className="navbar-user">
          {user && (
            <div className="user-info">
              <Link to="/profile" className="profile-link">Profile</Link>
              <span>{user.firstName || user.emailAddresses[0]?.emailAddress}</span>
              <SignOutButton>
                <button className="sign-out-btn">Sign Out</button>
              </SignOutButton>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;



