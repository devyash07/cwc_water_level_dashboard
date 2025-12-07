import React, { useState } from 'react';
import { authAPI } from '../services/api';

const SimpleLogin = ({ onLogin }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.username || !formData.password) {
      setError('Please enter both username and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await authAPI.login({
        username: formData.username,
        password: formData.password
      });

      if (response.token && response.user) {
        onLogin(response.token, response.user);
      } else {
        setError('Invalid response from server');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(error.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        maxWidth: '400px',
        width: '100%',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        padding: '2rem'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '64px',
            height: '64px',
            backgroundColor: '#3b82f6',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem auto',
            color: 'white',
            fontSize: '24px'
          }}>
            🌊
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937', margin: '0 0 0.5rem 0' }}>
            CWC Water Monitoring
          </h2>
          <p style={{ color: '#6b7280', margin: 0 }}>Real-Time Dashboard Access</p>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#dc2626',
            fontSize: '0.875rem'
          }}>
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Username
            </label>
            <input
              name="username"
              type="text"
              value={formData.username}
              onChange={handleChange}
              placeholder="Enter your username"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
              disabled={loading}
              required
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Password
            </label>
            <input
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
              disabled={loading}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              backgroundColor: loading ? '#9ca3af' : '#3b82f6',
              color: 'white',
              padding: '0.75rem',
              borderRadius: '8px',
              border: 'none',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              if (!loading) e.target.style.backgroundColor = '#2563eb';
            }}
            onMouseLeave={(e) => {
              if (!loading) e.target.style.backgroundColor = '#3b82f6';
            }}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        {/* Demo Accounts Info */}
        <div style={{
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: '#f9fafb',
          borderRadius: '8px'
        }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151', margin: '0 0 0.5rem 0' }}>
            Demo Accounts:
          </h3>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', lineHeight: '1.5' }}>
            <p style={{ margin: '0.25rem 0' }}><strong>Admin:</strong> admin / admin123</p>
            <p style={{ margin: '0.25rem 0' }}><strong>Supervisor:</strong> supervisor1 / supervisor123</p>
            <p style={{ margin: '0.25rem 0' }}><strong>Analyst:</strong> analyst1 / analyst123</p>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.75rem', color: '#9ca3af' }}>
          <p style={{ margin: '0.25rem 0' }}>Central Water Commission</p>
          <p style={{ margin: '0.25rem 0' }}>Water Level Monitoring System</p>
        </div>
      </div>
    </div>
  );
};

export default SimpleLogin;