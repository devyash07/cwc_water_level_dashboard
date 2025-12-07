const jwt = require('jsonwebtoken');
const pool = require('../config/database');

// Store connected clients with their user information
const connectedClients = new Map();

const handleWebSocketConnection = (ws, req) => {
  console.log('New WebSocket connection attempt');

  // Handle authentication
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'auth') {
        await handleAuthentication(ws, data);
      } else if (data.type === 'ping') {
        // Respond to ping with pong
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      } else {
        // Handle other message types from authenticated users
        if (connectedClients.has(ws)) {
          await handleClientMessage(ws, data);
        } else {
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Authentication required' 
          }));
        }
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Invalid message format' 
      }));
    }
  });

  // Handle connection close
  ws.on('close', () => {
    if (connectedClients.has(ws)) {
      const clientInfo = connectedClients.get(ws);
      console.log(`WebSocket connection closed for user: ${clientInfo.user.full_name}`);
      connectedClients.delete(ws);
    }
  });

  // Handle connection error
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    if (connectedClients.has(ws)) {
      connectedClients.delete(ws);
    }
  });

  // Send initial connection message
  ws.send(JSON.stringify({ 
    type: 'connection', 
    message: 'Connected to water monitoring WebSocket server',
    timestamp: new Date().toISOString()
  }));
};

const handleAuthentication = async (ws, data) => {
  try {
    const { token } = data;

    if (!token) {
      ws.send(JSON.stringify({ 
        type: 'auth_error', 
        message: 'Token is required' 
      }));
      return;
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user still exists and is active
    const userResult = await pool.query(
      'SELECT id, username, email, role, full_name, is_active FROM users WHERE id = $1',
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      ws.send(JSON.stringify({ 
        type: 'auth_error', 
        message: 'User not found' 
      }));
      return;
    }

    const user = userResult.rows[0];
    if (!user.is_active) {
      ws.send(JSON.stringify({ 
        type: 'auth_error', 
        message: 'Account deactivated' 
      }));
      return;
    }

    // Store client information
    connectedClients.set(ws, {
      user,
      connectedAt: new Date(),
      lastPing: new Date()
    });

    console.log(`WebSocket authenticated: ${user.full_name} (${user.role})`);

    // Send authentication success
    ws.send(JSON.stringify({ 
      type: 'auth_success', 
      message: 'Authentication successful',
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role
      },
      timestamp: new Date().toISOString()
    }));

    // Send current system status
    await sendSystemStatus(ws);

  } catch (error) {
    console.error('WebSocket authentication error:', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      ws.send(JSON.stringify({ 
        type: 'auth_error', 
        message: 'Invalid or expired token' 
      }));
    } else {
      ws.send(JSON.stringify({ 
        type: 'auth_error', 
        message: 'Authentication failed' 
      }));
    }
  }
};

const handleClientMessage = async (ws, data) => {
  const clientInfo = connectedClients.get(ws);
  
  switch (data.type) {
    case 'subscribe_site':
      // Subscribe to updates for a specific site
      await handleSiteSubscription(ws, data);
      break;
      
    case 'unsubscribe_site':
      // Unsubscribe from site updates
      await handleSiteUnsubscription(ws, data);
      break;
      
    case 'get_alerts':
      // Send current unacknowledged alerts
      await sendCurrentAlerts(ws);
      break;
      
    default:
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: `Unknown message type: ${data.type}` 
      }));
  }
};

const handleSiteSubscription = async (ws, data) => {
  const { site_id } = data;
  
  if (!site_id) {
    ws.send(JSON.stringify({ 
      type: 'error', 
      message: 'site_id is required for subscription' 
    }));
    return;
  }

  // Store subscription info
  const clientInfo = connectedClients.get(ws);
  if (!clientInfo.subscriptions) {
    clientInfo.subscriptions = new Set();
  }
  clientInfo.subscriptions.add(site_id);

  ws.send(JSON.stringify({ 
    type: 'subscription_success', 
    site_id,
    message: `Subscribed to updates for site ${site_id}` 
  }));
};

const handleSiteUnsubscription = async (ws, data) => {
  const { site_id } = data;
  const clientInfo = connectedClients.get(ws);
  
  if (clientInfo.subscriptions) {
    clientInfo.subscriptions.delete(site_id);
  }

  ws.send(JSON.stringify({ 
    type: 'unsubscription_success', 
    site_id,
    message: `Unsubscribed from site ${site_id}` 
  }));
};

const sendSystemStatus = async (ws) => {
  try {
    // Get basic system statistics
    const statsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM sites WHERE is_active = true) as total_sites,
        (SELECT COUNT(*) FROM alerts WHERE is_acknowledged = false) as pending_alerts,
        (SELECT COUNT(*) FROM readings WHERE reading_time > NOW() - INTERVAL '24 hours') as recent_readings
    `;

    const result = await pool.query(statsQuery);
    const stats = result.rows[0];

    ws.send(JSON.stringify({
      type: 'system_status',
      data: {
        total_sites: parseInt(stats.total_sites),
        pending_alerts: parseInt(stats.pending_alerts),
        recent_readings: parseInt(stats.recent_readings),
        server_time: new Date().toISOString()
      }
    }));

  } catch (error) {
    console.error('Error sending system status:', error);
  }
};

const sendCurrentAlerts = async (ws) => {
  try {
    const alertsQuery = `
      SELECT 
        a.id, a.alert_type, a.message, a.created_at,
        s.site_id, s.name as site_name, s.latitude, s.longitude
      FROM alerts a
      JOIN sites s ON a.site_id = s.id
      WHERE a.is_acknowledged = false
      ORDER BY a.created_at DESC
      LIMIT 10
    `;

    const result = await pool.query(alertsQuery);

    ws.send(JSON.stringify({
      type: 'current_alerts',
      alerts: result.rows
    }));

  } catch (error) {
    console.error('Error sending current alerts:', error);
  }
};

// Broadcast message to all connected clients
const broadcastToAll = (message) => {
  connectedClients.forEach((clientInfo, ws) => {
    if (ws.readyState === 1) { // WebSocket.OPEN
      ws.send(JSON.stringify(message));
    }
  });
};

// Broadcast message to clients with specific roles
const broadcastToRoles = (message, roles) => {
  connectedClients.forEach((clientInfo, ws) => {
    if (ws.readyState === 1 && roles.includes(clientInfo.user.role)) {
      ws.send(JSON.stringify(message));
    }
  });
};

// Broadcast message to subscribers of a specific site
const broadcastToSiteSubscribers = (message, site_id) => {
  connectedClients.forEach((clientInfo, ws) => {
    if (ws.readyState === 1 && 
        clientInfo.subscriptions && 
        clientInfo.subscriptions.has(site_id)) {
      ws.send(JSON.stringify(message));
    }
  });
};

// Cleanup inactive connections
const cleanupConnections = () => {
  const now = new Date();
  const timeout = 5 * 60 * 1000; // 5 minutes

  connectedClients.forEach((clientInfo, ws) => {
    if (now - clientInfo.lastPing > timeout) {
      console.log(`Cleaning up inactive connection for user: ${clientInfo.user.full_name}`);
      ws.terminate();
      connectedClients.delete(ws);
    }
  });
};

// Run cleanup every 5 minutes
setInterval(cleanupConnections, 5 * 60 * 1000);

module.exports = {
  handleWebSocketConnection,
  broadcastToAll,
  broadcastToRoles,
  broadcastToSiteSubscribers,
  connectedClients
};