import React from 'react';

const SimpleLayout = ({ children, user, onLogout }) => {
  const getRoleColor = (role) => {
    switch (role) {
      case 'admin':
        return '#dc2626';
      case 'supervisor':
        return '#2563eb';
      case 'analyst':
        return '#059669';
      default:
        return '#6b7280';
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* Top navigation */}
      <div style={{
        backgroundColor: 'white',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{ 
            fontSize: '1.25rem', 
            fontWeight: '600', 
            color: '#1f2937', 
            margin: 0,
            display: 'flex',
            alignItems: 'center'
          }}>
            🌊 CWC Water Monitoring Dashboard
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{
            padding: '0.25rem 0.75rem',
            fontSize: '0.75rem',
            fontWeight: '500',
            borderRadius: '9999px',
            backgroundColor: `${getRoleColor(user?.role)}20`,
            color: getRoleColor(user?.role)
          }}>
            {user?.role?.toUpperCase()}
          </span>
          <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#1f2937' }}>
            {user?.full_name}
          </span>
          <button
            onClick={onLogout}
            style={{
              backgroundColor: '#f3f4f6',
              border: 'none',
              borderRadius: '6px',
              padding: '0.5rem',
              cursor: 'pointer',
              color: '#6b7280',
              fontSize: '0.875rem'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#e5e7eb';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#f3f4f6';
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Page content */}
      <main>
        {children}
      </main>
    </div>
  );
};

export default SimpleLayout;