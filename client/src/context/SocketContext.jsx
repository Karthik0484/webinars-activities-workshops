import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useUser } from '@clerk/clerk-react';

const SocketContext = createContext();

export const useSocket = () => {
    return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const { user, isSignedIn } = useUser();
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    // Remove /api from URL if present for socket connection
    const SOCKET_URL = API_URL.replace('/api', '');

    useEffect(() => {
        // Create socket connection
        const newSocket = io(SOCKET_URL, {
            withCredentials: true,
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        setSocket(newSocket);

        // Clean up on unmount
        return () => {
            newSocket.disconnect();
        };
    }, [SOCKET_URL]);

    // Handle authentication/rooms when user signs in
    useEffect(() => {
        if (socket && isSignedIn && user) {
            // Join user-specific room
            socket.emit('join', user.id);

            // If user is admin (check metadata or role if available locally)
            // For now, we'll rely on the server validation or separate admin login flow
            // But if we have admin context, we should emit 'join-admin'
            const isAdmin = user.publicMetadata?.role === 'admin';
            if (isAdmin) {
                socket.emit('join-admin');
            }
        }
    }, [socket, isSignedIn, user]);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};
