import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SimpleLogin from './components/SimpleLogin';
import SimpleDashboard from './components/SimpleDashboard';
import SiteDetails from './components/SiteDetails';
import SiteManagement from './components/SiteManagement';
import Reporting from './components/Reporting';
import SimpleLayout from './components/SimpleLayout';
import { authAPI } from './services/api';
import websocketService from './services/websocket';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        const response = await authAPI.getCurrentUser();
        setUser(response.user);
        setIsAuthenticated(true);
        
        // Connect to WebSocket
        websocketService.connect(token);
        websocketService.startHeartbeat();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (token, userData) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user_data', JSON.stringify(userData));
    setUser(userData);
    setIsAuthenticated(true);
    
    // Connect to WebSocket
    websocketService.connect(token);
    websocketService.startHeartbeat();
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');
      setUser(null);
      setIsAuthenticated(false);
      
      // Disconnect WebSocket
      websocketService.disconnect();
      websocketService.stopHeartbeat();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route 
            path="/login" 
            element={
              !isAuthenticated ? (
                <SimpleLogin onLogin={handleLogin} />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            } 
          />
          <Route 
            path="/" 
            element={
              isAuthenticated ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          <Route 
            path="/*" 
            element={
              isAuthenticated ? (
                <SimpleLayout user={user} onLogout={handleLogout}>
                  <Routes>
                    <Route path="/dashboard" element={<SimpleDashboard user={user} />} />
                    <Route path="/sites/:id" element={<SiteDetails user={user} />} />
                    <Route 
                      path="/site-management" 
                      element={
                        user?.role === 'admin' ? (
                          <SiteManagement user={user} />
                        ) : (
                          <Navigate to="/dashboard" replace />
                        )
                      } 
                    />
                    <Route 
                      path="/reporting" 
                      element={
                        ['admin', 'analyst'].includes(user?.role) ? (
                          <Reporting user={user} />
                        ) : (
                          <Navigate to="/dashboard" replace />
                        )
                      } 
                    />
                  </Routes>
                </SimpleLayout>
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
