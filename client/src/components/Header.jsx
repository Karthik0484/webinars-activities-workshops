import { useState, useEffect } from 'react';
import { Search, Sun, Moon, LogOut } from 'lucide-react';
import { SignOutButton, useUser } from '@clerk/clerk-react';
import { useDbUser } from '../contexts/UserContext';
import NotificationIcon from './NotificationIcon';
import './Header.css';

function Header() {
    const { user } = useUser();
    const { isBlocked } = useDbUser();
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    return (
        <header className="header">
            {!isBlocked ? (
                <div className="header-search">
                    <Search size={18} className="search-icon" />
                    <input type="text" placeholder="Search workshops, webinars..." />
                </div>
            ) : <div className="header-search-empty" />}

            <div className="header-actions">
                <button className="icon-btn theme-toggle" onClick={toggleTheme} title="Toggle Theme">
                    {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                </button>

                {!isBlocked && <NotificationIcon />}

                <div className="header-divider" />

                {user && (
                    <SignOutButton>
                        <button className="logout-action" title="Sign Out">
                            <LogOut size={18} />
                            <span className="logout-text">Sign Out</span>
                        </button>
                    </SignOutButton>
                )}
            </div>
        </header>
    );
}

export default Header;
