import { Link, useLocation } from 'react-router-dom';
import { useUser, SignOutButton } from '@clerk/clerk-react';
import { useState } from 'react';
import './Navbar.css';

function Navbar() {
  const { user } = useUser();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          <img src="/akvora-logo.png" alt="Akvora" className="navbar-logo" />
          <span>Aravind</span>
        </Link>

        {/* Hamburger Menu Button */}
        <button
          className={`mobile-menu-toggle ${mobileMenuOpen ? 'active' : ''}`}
          onClick={toggleMobileMenu}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <div className={`navbar-menu ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          <Link
            to="/webinars"
            className={location.pathname === '/webinars' ? 'active' : ''}
            onClick={closeMobileMenu}
          >
            Webinars
          </Link>
          <Link
            to="/workshops"
            className={location.pathname === '/workshops' ? 'active' : ''}
            onClick={closeMobileMenu}
          >
            Workshops
          </Link>
          <Link
            to="/internships"
            className={location.pathname === '/internships' ? 'active' : ''}
            onClick={closeMobileMenu}
          >
            Internships
          </Link>
        </div>

        <div className="navbar-user">
          {user && (
            <div className="user-info">
              <Link to="/profile" className="profile-link" onClick={closeMobileMenu}>Profile</Link>
              <span className="user-name">{user.firstName || user.emailAddresses[0]?.emailAddress}</span>
              <SignOutButton>
                <button className="sign-out-btn">Sign Out</button>
              </SignOutButton>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={closeMobileMenu}></div>
      )}
    </nav>
  );
}

export default Navbar;




