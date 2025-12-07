# CWC Water Level Monitoring Dashboard

A real-time web dashboard for monitoring water levels across Central Water Commission sites using React, NeonDB, and Leaflet maps.

## Features

### 🌊 Real-Time Monitoring
- Interactive map view of all monitoring sites
- Color-coded markers based on water level status (Normal/Warning/Critical)
- Live updates via WebSocket connections
- Real-time alerts and notifications

### 👥 Role-Based Access Control
- **Admin**: Full system access, user management, site configuration
- **Supervisor**: Dashboard access, alert acknowledgment, site monitoring
- **Analyst**: Data access, reporting, export functionality

### 📊 Data Visualization
- Interactive charts showing water level history
- Site details with comprehensive readings log
- Statistical summaries and trend analysis
- Photo viewing for field readings

### 🚨 Alert System
- Automatic alerts for critical/warning levels
- Real-time alert panel with acknowledgment
- Stale data detection and notifications

## Technology Stack

### Backend
- **Node.js** with Express.js framework
- **NeonDB** (Serverless PostgreSQL) with PostGIS extension
- **WebSocket** for real-time communication
- **JWT** authentication with bcrypt password hashing
- **Multer** for file uploads

### Frontend
- **React** with modern hooks and functional components
- **React Router** for navigation and routing
- **Leaflet** with React-Leaflet for interactive maps
- **Chart.js** with react-chartjs-2 for data visualization
- **Tailwind CSS** for responsive styling
- **Axios** for API communication

### Database
- **NeonDB** (PostgreSQL) with PostGIS spatial extension
- Optimized queries for geospatial data
- Automated triggers and constraints

## Quick Start

### Prerequisites
- Node.js 16+ and npm
- Internet connection for NeonDB

### 1. Clone and Setup Backend

```bash
cd backend
npm install
```

### 2. Configure Environment
The `.env` file is already configured with your NeonDB connection:
```env
DATABASE_URL=postgresql://neondb_owner:npg_gn0HJmQbt3lT@ep-falling-haze-a1gi7c0u-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
PORT=5000
```

### 3. Initialize Database
```bash
npm run init-db
```

### 4. Start Backend Server
```bash
npm run dev
# or
npm start
```

### 5. Setup and Start Frontend
```bash
cd ../frontend
npm install
npm start
```

## Login Credentials

The system includes demo accounts:

| Role | Username | Password | Access Level |
|------|----------|----------|--------------|
| Admin | `admin` | `admin123` | Full access, user/site management |
| Supervisor | `supervisor1` | `supervisor123` | Dashboard, alert acknowledgment |
| Analyst | `analyst1` | `analyst123` | Dashboard, reporting, data export |

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/refresh` - Refresh JWT token

### Sites Management
- `GET /api/sites` - Get all sites with latest readings
- `GET /api/sites/:id` - Get site details with readings
- `POST /api/sites` - Create new site (Admin only)
- `PUT /api/sites/:id` - Update site (Admin only)
- `DELETE /api/sites/:id` - Delete site (Admin only)

### Readings
- `GET /api/readings` - Get readings with filters
- `GET /api/readings/:id` - Get specific reading
- `GET /api/readings/stats/summary` - Get reading statistics
- `GET /api/readings/export/data` - Export readings (CSV/JSON)

### Alerts
- `GET /api/alerts` - Get alerts with filters
- `PUT /api/alerts/:id/acknowledge` - Acknowledge alert
- `POST /api/alerts` - Create new alert
- `GET /api/alerts/stats/summary` - Get alert statistics

### Users (Admin Only)
- `GET /api/users` - Get all users
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Deactivate user

## WebSocket Events

### Client → Server
- `auth` - Authenticate with JWT token
- `subscribe_site` - Subscribe to site updates
- `unsubscribe_site` - Unsubscribe from site
- `get_alerts` - Request current alerts
- `ping` - Connection health check

### Server → Client
- `auth_success` - Authentication successful
- `system_status` - System statistics update
- `new_alert` - New alert created
- `alert_acknowledged` - Alert acknowledged
- `site_status_update` - Site status changed
- `current_alerts` - Current unacknowledged alerts

## Database Schema

### Key Tables
- **users** - User accounts with role-based permissions
- **sites** - Monitoring site locations with PostGIS geometry
- **readings** - Water level measurements with timestamps
- **alerts** - System alerts and notifications
- **sessions** - JWT token management

### Sample Sites
The system includes 3 sample monitoring sites:
- **CWC001** - Yamuna at Delhi (28.6139°N, 77.2090°E)
- **CWC002** - Ganga at Haridwar (29.9457°N, 78.1642°E)
- **CWC003** - Godavari at Nashik (19.9975°N, 73.7898°E)

## Features Overview

### Dashboard
- Interactive Leaflet map with real-time site markers
- Status indicators (Normal/Warning/Critical/Stale/No Data)
- Live alerts panel with acknowledgment capability
- System statistics and site status summary

### Site Details
- Historical water level charts
- Comprehensive readings table
- Site information and statistics
- Photo viewing for field readings

### Real-time Features
- WebSocket-powered live updates
- Automatic map marker updates
- Real-time alert notifications
- Connection health monitoring

### Security
- JWT-based authentication
- Role-based access control (RBAC)
- Password hashing with bcrypt
- SQL injection protection
- Rate limiting on API endpoints

## Development

### Backend Scripts
```bash
npm run dev          # Start with nodemon (development)
npm start           # Start production server
npm run init-db     # Initialize database schema
npm run check-schema # Check database structure
```

### Frontend Scripts
```bash
npm start       # Start development server (port 3000)
npm run build   # Build for production
npm test        # Run tests
```

## Architecture

### High-Level Architecture
```
Frontend (React) ←→ Backend (Express.js) ←→ NeonDB (PostgreSQL + PostGIS)
       ↕                    ↕
   WebSocket Client ←→ WebSocket Server
```

### Key Components
1. **Authentication Layer** - JWT-based with role permissions
2. **API Layer** - RESTful endpoints with error handling
3. **Real-time Layer** - WebSocket for live updates
4. **Data Layer** - NeonDB with spatial queries
5. **Frontend Layer** - React SPA with routing

## Monitoring Features

### Site Status Detection
- **Normal**: Recent reading within acceptable range
- **Warning**: Reading above warning threshold
- **Critical**: Reading above critical threshold
- **Stale**: No reading in last 24 hours
- **No Data**: No readings available

### Alert Types
- **Critical**: Water level exceeds critical threshold
- **Warning**: Water level exceeds warning threshold
- **Stale Data**: No recent readings from site
- **No Data**: Site has never reported data

## Future Enhancements

- [ ] Advanced site management interface
- [ ] Comprehensive reporting system
- [ ] Data export scheduling
- [ ] Mobile app integration
- [ ] Historical trend analysis
- [ ] Predictive analytics
- [ ] Email/SMS notifications
- [ ] Multi-language support

## License

This project is developed for the Central Water Commission (CWC) water level monitoring system.

---

**Note**: This is a demonstration system. In production, ensure to:
1. Change default passwords and JWT secrets
2. Configure proper SSL/TLS certificates
3. Set up database backups
4. Implement proper logging and monitoring
5. Add comprehensive error handling and validation