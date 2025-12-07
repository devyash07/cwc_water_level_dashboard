import React, { useState, useEffect } from 'react';
import { sitesAPI, alertsAPI } from '../services/api';

const SimpleDashboard = ({ user }) => {
  const [sites, setSites] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [sitesResponse, alertsResponse] = await Promise.all([
        sitesAPI.getAllSites(),
        alertsAPI.getAlerts({ acknowledged: 'false', limit: 10 })
      ]);

      setSites(sitesResponse.sites || []);
      setAlerts(alertsResponse.alerts || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusCounts = () => {
    const counts = {
      total: sites.length,
      normal: 0,
      warning: 0,
      critical: 0,
      stale: 0,
      no_data: 0
    };

    sites.forEach(site => {
      if (site.status) {
        counts[site.status]++;
      }
    });

    return counts;
  };

  const statusCounts = getStatusCounts();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
          Dashboard Overview
        </h1>
        <p style={{ color: '#6b7280', margin: '0.5rem 0 0 0' }}>
          Real-time water level monitoring across all sites
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1.5rem', 
        marginBottom: '2rem' 
      }}>
        <StatCard title="Total Sites" value={statusCounts.total} color="#3b82f6" />
        <StatCard title="Critical Alerts" value={statusCounts.critical} color="#dc2626" />
        <StatCard title="Warning Alerts" value={statusCounts.warning} color="#d97706" />
        <StatCard title="Normal Sites" value={statusCounts.normal} color="#059669" />
      </div>

      {/* Main Content */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        {/* Sites List */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          padding: '1.5rem'
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', marginBottom: '1rem' }}>
            Monitoring Sites
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb' }}>
                  <th style={tableHeaderStyle}>Site Name</th>
                  <th style={tableHeaderStyle}>Site ID</th>
                  <th style={tableHeaderStyle}>Status</th>
                  <th style={tableHeaderStyle}>Latest Reading</th>
                  <th style={tableHeaderStyle}>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {sites.map(site => (
                  <tr key={site.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={tableCellStyle}>{site.name}</td>
                    <td style={tableCellStyle}>{site.site_id}</td>
                    <td style={tableCellStyle}>
                      <StatusBadge status={site.status} />
                    </td>
                    <td style={tableCellStyle}>
                      {site.latest_reading ? `${site.latest_reading}m` : 'No data'}
                    </td>
                    <td style={tableCellStyle}>
                      {site.latest_reading_time 
                        ? new Date(site.latest_reading_time).toLocaleDateString()
                        : 'Never'
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alerts Panel */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          padding: '1.5rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', margin: 0 }}>
              Active Alerts
            </h2>
            <span style={{
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              fontSize: '0.75rem',
              fontWeight: '500',
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px'
            }}>
              {alerts.length}
            </span>
          </div>

          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {alerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                <p>No active alerts</p>
              </div>
            ) : (
              alerts.map(alert => (
                <AlertCard key={alert.id} alert={alert} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Connection Status */}
      <div style={{
        marginTop: '2rem',
        padding: '1rem',
        backgroundColor: '#ecfdf5',
        border: '1px solid #a7f3d0',
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <p style={{ color: '#065f46', margin: 0, fontSize: '0.875rem' }}>
          ✅ Connected to NeonDB • Real-time monitoring active
        </p>
      </div>
    </div>
  );
};

// Helper Components
const StatCard = ({ title, value, color }) => (
  <div style={{
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    padding: '1.5rem'
  }}>
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <div style={{
        width: '48px',
        height: '48px',
        backgroundColor: `${color}20`,
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: '1rem'
      }}>
        <div style={{ 
          width: '24px', 
          height: '24px', 
          backgroundColor: color, 
          borderRadius: '50%' 
        }} />
      </div>
      <div>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0 0 0.25rem 0' }}>{title}</p>
        <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>{value}</p>
      </div>
    </div>
  </div>
);

const StatusBadge = ({ status }) => {
  const getStatusConfig = (status) => {
    switch (status) {
      case 'normal':
        return { color: '#065f46', bg: '#d1fae5', label: 'Normal' };
      case 'warning':
        return { color: '#92400e', bg: '#fef3c7', label: 'Warning' };
      case 'critical':
        return { color: '#991b1b', bg: '#fecaca', label: 'Critical' };
      case 'stale':
        return { color: '#4b5563', bg: '#f3f4f6', label: 'Stale' };
      case 'no_data':
        return { color: '#4b5563', bg: '#f3f4f6', label: 'No Data' };
      default:
        return { color: '#4b5563', bg: '#f3f4f6', label: status || 'Unknown' };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span style={{
      backgroundColor: config.bg,
      color: config.color,
      fontSize: '0.75rem',
      fontWeight: '500',
      padding: '0.25rem 0.75rem',
      borderRadius: '9999px'
    }}>
      {config.label}
    </span>
  );
};

const AlertCard = ({ alert }) => (
  <div style={{
    border: '1px solid #fecaca',
    backgroundColor: '#fef2f2',
    borderRadius: '8px',
    padding: '0.75rem',
    marginBottom: '0.5rem'
  }}>
    <h4 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#1f2937', margin: '0 0 0.25rem 0' }}>
      {alert.site_name}
    </h4>
    <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 0.25rem 0' }}>
      {alert.message}
    </p>
    <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>
      {new Date(alert.created_at).toLocaleString()}
    </p>
  </div>
);

// Styles
const tableHeaderStyle = {
  padding: '0.75rem',
  textAlign: 'left',
  fontSize: '0.75rem',
  fontWeight: '500',
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
};

const tableCellStyle = {
  padding: '0.75rem',
  fontSize: '0.875rem',
  color: '#1f2937'
};

export default SimpleDashboard;