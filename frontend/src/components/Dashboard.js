import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Icon } from 'leaflet';
import { sitesAPI, alertsAPI, readingsAPI } from '../services/api';
import websocketService from '../services/websocket';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in React Leaflet
delete Icon.Default.prototype._getIconUrl;
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icons for different statuses
const createMarkerIcon = (status) => {
  let color;
  switch (status) {
    case 'critical':
      color = '#DC2626'; // Red
      break;
    case 'warning':
      color = '#F59E0B'; // Amber
      break;
    case 'normal':
      color = '#10B981'; // Green
      break;
    case 'stale':
    case 'no_data':
    default:
      color = '#6B7280'; // Gray
      break;
  }
  
  return new Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 41" width="25" height="41">
        <path fill="${color}" stroke="#000" stroke-width="1" d="M12.5 0C5.596 0 0 5.596 0 12.5c0 12.5 12.5 28.5 12.5 28.5S25 25 25 12.5C25 5.596 19.404 0 12.5 0z"/>
        <circle fill="#fff" cx="12.5" cy="12.5" r="6"/>
      </svg>
    `)}`,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34]
  });
};

const Dashboard = ({ user }) => {
  const [sites, setSites] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [mapCenter] = useState([20.5937, 78.9629]); // Center of India
  const [mapZoom] = useState(5);

  useEffect(() => {
    fetchData();
    setupWebSocketListeners();
  }, []);

  const fetchData = async () => {
    try {
      const [sitesResponse, alertsResponse, statsResponse] = await Promise.all([
        sitesAPI.getAllSites(),
        alertsAPI.getAlerts({ acknowledged: 'false', limit: 10 }),
        readingsAPI.getReadingStats({ days: 7 })
      ]);

      setSites(sitesResponse.sites || []);
      setAlerts(alertsResponse.alerts || []);
      setStats(statsResponse.statistics || {});
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupWebSocketListeners = () => {
    // Listen for new alerts
    const unsubscribeNewAlert = websocketService.subscribe('new_alert', (alert) => {
      setAlerts(prev => [alert, ...prev.slice(0, 9)]);
    });

    // Listen for site status updates
    const unsubscribeSiteUpdate = websocketService.subscribe('site_status_update', (update) => {
      setSites(prev => prev.map(site => 
        site.id === update.site_id ? { ...site, ...update } : site
      ));
    });

    // Listen for alert acknowledgments
    const unsubscribeAlertAck = websocketService.subscribe('alert_acknowledged', (data) => {
      setAlerts(prev => prev.filter(alert => alert.id !== data.alert_id));
    });

    // Cleanup on component unmount
    return () => {
      unsubscribeNewAlert();
      unsubscribeSiteUpdate();
      unsubscribeAlertAck();
    };
  };

  const handleAcknowledgeAlert = async (alertId) => {
    try {
      await alertsAPI.acknowledgeAlert(alertId);
      setAlerts(prev => prev.filter(alert => alert.id !== alertId));
    } catch (error) {
      console.error('Error acknowledging alert:', error);
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
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="text-gray-600">Real-time water level monitoring across all sites</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Sites"
          value={statusCounts.total}
          icon="🏢"
          color="bg-blue-50 text-blue-700"
        />
        <StatCard
          title="Critical Alerts"
          value={statusCounts.critical}
          icon="🔴"
          color="bg-red-50 text-red-700"
        />
        <StatCard
          title="Warning Alerts"
          value={statusCounts.warning}
          icon="🟡"
          color="bg-yellow-50 text-yellow-700"
        />
        <StatCard
          title="Normal Sites"
          value={statusCounts.normal}
          icon="🟢"
          color="bg-green-50 text-green-700"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Map View */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Site Locations</h2>
            <div className="h-96 rounded-lg overflow-hidden">
              <MapContainer 
                center={mapCenter} 
                zoom={mapZoom} 
                className="h-full w-full"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {sites.map(site => (
                  <Marker
                    key={site.id}
                    position={[site.latitude, site.longitude]}
                    icon={createMarkerIcon(site.status)}
                  >
                    <Popup>
                      <div className="p-2">
                        <h3 className="font-semibold">{site.name}</h3>
                        <p className="text-sm text-gray-600">Site ID: {site.site_id}</p>
                        {site.latest_reading && (
                          <p className="text-sm">
                            Latest Reading: {site.latest_reading}m
                          </p>
                        )}
                        {site.latest_reading_time && (
                          <p className="text-xs text-gray-500">
                            Last Updated: {new Date(site.latest_reading_time).toLocaleString()}
                          </p>
                        )}
                        <Link
                          to={`/sites/${site.id}`}
                          className="text-blue-600 hover:text-blue-800 text-sm underline"
                        >
                          View Details
                        </Link>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        </div>

        {/* Alerts Panel */}
        <div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Active Alerts</h2>
              <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                {alerts.length}
              </span>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="mt-2">No active alerts</p>
                </div>
              ) : (
                alerts.map(alert => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    onAcknowledge={handleAcknowledgeAlert}
                    canAcknowledge={['supervisor', 'admin'].includes(user.role)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Site Status Summary */}
      <div className="mt-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Site Status Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatusSummaryCard status="normal" count={statusCounts.normal} />
            <StatusSummaryCard status="warning" count={statusCounts.warning} />
            <StatusSummaryCard status="critical" count={statusCounts.critical} />
            <StatusSummaryCard status="stale" count={statusCounts.stale} />
            <StatusSummaryCard status="no_data" count={statusCounts.no_data} />
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper Components
const StatCard = ({ title, value, icon, color }) => (
  <div className="bg-white rounded-lg shadow p-6">
    <div className="flex items-center">
      <div className={`flex-shrink-0 p-3 rounded-lg ${color}`}>
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="ml-4">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  </div>
);

const AlertCard = ({ alert, onAcknowledge, canAcknowledge }) => {
  const getAlertColor = (type) => {
    switch (type) {
      case 'critical':
        return 'border-red-200 bg-red-50';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  return (
    <div className={`border rounded-lg p-3 ${getAlertColor(alert.alert_type)}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-medium text-sm">{alert.site_name}</h4>
          <p className="text-xs text-gray-600 mt-1">{alert.message}</p>
          <p className="text-xs text-gray-500 mt-1">
            {new Date(alert.created_at).toLocaleString()}
          </p>
        </div>
        {canAcknowledge && (
          <button
            onClick={() => onAcknowledge(alert.id)}
            className="ml-2 text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
          >
            Ack
          </button>
        )}
      </div>
    </div>
  );
};

const StatusSummaryCard = ({ status, count }) => {
  const getStatusConfig = (status) => {
    switch (status) {
      case 'normal':
        return { color: 'text-green-600', bgColor: 'bg-green-100', label: 'Normal' };
      case 'warning':
        return { color: 'text-yellow-600', bgColor: 'bg-yellow-100', label: 'Warning' };
      case 'critical':
        return { color: 'text-red-600', bgColor: 'bg-red-100', label: 'Critical' };
      case 'stale':
        return { color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Stale Data' };
      case 'no_data':
        return { color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'No Data' };
      default:
        return { color: 'text-gray-600', bgColor: 'bg-gray-100', label: status };
    }
  };

  const config = getStatusConfig(status);

  return (
    <div className="text-center">
      <div className={`inline-flex items-center justify-center w-12 h-12 ${config.bgColor} rounded-full`}>
        <span className={`text-lg font-semibold ${config.color}`}>{count}</span>
      </div>
      <p className="text-sm text-gray-600 mt-2">{config.label}</p>
    </div>
  );
};

export default Dashboard;