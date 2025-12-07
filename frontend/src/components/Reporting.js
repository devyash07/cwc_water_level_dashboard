import React from 'react';

const Reporting = ({ user }) => {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports & Data Export</h1>
        <p className="text-gray-600">Generate reports and export data for analysis</p>
      </div>

      <div className="bg-white rounded-lg shadow p-8 text-center">
        <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Coming Soon</h3>
        <p className="text-gray-600">Advanced reporting and data export functionality will be available soon.</p>
        <p className="text-sm text-gray-500 mt-2">
          This will include customizable reports, data filtering, CSV exports, and scheduled reports.
        </p>
      </div>
    </div>
  );
};

export default Reporting;