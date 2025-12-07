import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { sitesAPI } from '../services/api';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const SiteDetails = ({ user }) => {
  const { id } = useParams();
  const [site, setSite] = useState(null);
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSiteDetails();
  }, [id]);

  const fetchSiteDetails = async () => {
    try {
      const response = await sitesAPI.getSite(id);
      setSite(response.site);
      setReadings(response.readings || []);
    } catch (error) {
      console.error('Error fetching site details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!site) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Site Not Found</h2>
          <p className="text-gray-600 mt-2">The requested site could not be found.</p>
          <Link 
            to="/dashboard" 
            className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const chartData = {
    labels: readings.map(r => new Date(r.reading_time).toLocaleDateString()),
    datasets: [
      {
        label: 'Water Level (m)',
        data: readings.map(r => r.water_level),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.1,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Water Level History'
      }
    },
    scales: {
      y: {
        beginAtZero: false
      }
    }
  };

  const getStatusColor = (reading) => {
    if (site.critical_level && reading.water_level >= site.critical_level) {
      return 'text-red-600';
    }
    if (site.warning_level && reading.water_level >= site.warning_level) {
      return 'text-yellow-600';
    }
    return 'text-green-600';
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{site.name}</h1>
          <p className="text-gray-600">Site ID: {site.site_id}</p>
        </div>
        <Link 
          to="/dashboard"
          className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* Site Information */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Site Information</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Latitude:</span>
              <span className="font-medium">{site.latitude}°</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Longitude:</span>
              <span className="font-medium">{site.longitude}°</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Warning Level:</span>
              <span className="font-medium">{site.warning_level || 'N/A'} m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Critical Level:</span>
              <span className="font-medium">{site.critical_level || 'N/A'} m</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Latest Reading</h3>
          {readings.length > 0 ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Water Level:</span>
                <span className={`font-bold text-xl ${getStatusColor(readings[0])}`}>
                  {readings[0].water_level} m
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Operator:</span>
                <span className="font-medium">{readings[0].operator_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Time:</span>
                <span className="font-medium text-sm">
                  {new Date(readings[0].reading_time).toLocaleString()}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">No readings available</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Readings:</span>
              <span className="font-medium">{site.total_readings || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">First Reading:</span>
              <span className="font-medium text-sm">
                {site.first_reading_time 
                  ? new Date(site.first_reading_time).toLocaleDateString()
                  : 'N/A'
                }
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Last Updated:</span>
              <span className="font-medium text-sm">
                {site.latest_reading_time 
                  ? new Date(site.latest_reading_time).toLocaleDateString()
                  : 'N/A'
                }
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      {readings.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <Line data={chartData} options={chartOptions} />
        </div>
      )}

      {/* Readings Table */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Readings</h3>
        {readings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Water Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Operator
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Photo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {readings.map((reading) => (
                  <tr key={reading.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {new Date(reading.reading_time).toLocaleString()}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${getStatusColor(reading)}`}>
                      {reading.water_level} m
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {reading.operator_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {reading.photo_url ? (
                        <button className="text-blue-600 hover:text-blue-800">
                          View Photo
                        </button>
                      ) : (
                        'No Photo'
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {reading.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No readings available for this site.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SiteDetails;