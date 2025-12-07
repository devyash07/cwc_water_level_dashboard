class WebSocketService {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimeout = null;
    this.subscribers = new Map();
    this.messageQueue = [];
    this.baseUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:5000';
  }

  connect(token) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    try {
      this.ws = new WebSocket(this.baseUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;

        // Authenticate
        this.send({
          type: 'auth',
          token: token
        });

        // Process queued messages
        while (this.messageQueue.length > 0) {
          const message = this.messageQueue.shift();
          this.send(message);
        }

        this.notifySubscribers('connection', {
          status: 'connected',
          timestamp: new Date().toISOString()
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        this.isConnected = false;
        
        this.notifySubscribers('connection', {
          status: 'disconnected',
          code: event.code,
          reason: event.reason
        });

        // Attempt to reconnect
        this.attemptReconnect(token);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.notifySubscribers('error', { error: error.message });
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.clearReconnectTimeout();
  }

  send(message) {
    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message for when connection is established
      this.messageQueue.push(message);
    }
  }

  handleMessage(message) {
    switch (message.type) {
      case 'auth_success':
        console.log('WebSocket authentication successful');
        this.notifySubscribers('auth_success', message);
        break;

      case 'auth_error':
        console.error('WebSocket authentication failed:', message.message);
        this.notifySubscribers('auth_error', message);
        break;

      case 'system_status':
        this.notifySubscribers('system_status', message.data);
        break;

      case 'new_alert':
        this.notifySubscribers('new_alert', message.alert);
        break;

      case 'alert_acknowledged':
        this.notifySubscribers('alert_acknowledged', message);
        break;

      case 'new_reading':
        this.notifySubscribers('new_reading', message);
        break;

      case 'site_status_update':
        this.notifySubscribers('site_status_update', message);
        break;

      case 'current_alerts':
        this.notifySubscribers('current_alerts', message.alerts);
        break;

      case 'pong':
        // Handle ping/pong for connection health
        break;

      case 'error':
        console.error('WebSocket server error:', message.message);
        this.notifySubscribers('error', message);
        break;

      default:
        console.log('Unknown WebSocket message type:', message.type);
    }
  }

  subscribe(eventType, callback) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType).add(callback);

    // Return unsubscribe function
    return () => {
      const eventSubscribers = this.subscribers.get(eventType);
      if (eventSubscribers) {
        eventSubscribers.delete(callback);
        if (eventSubscribers.size === 0) {
          this.subscribers.delete(eventType);
        }
      }
    };
  }

  notifySubscribers(eventType, data) {
    const eventSubscribers = this.subscribers.get(eventType);
    if (eventSubscribers) {
      eventSubscribers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in WebSocket subscriber callback:', error);
        }
      });
    }
  }

  attemptReconnect(token) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.clearReconnectTimeout();

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect(token);
    }, delay);
  }

  clearReconnectTimeout() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  // Specific subscription methods
  subscribeToSite(siteId) {
    this.send({
      type: 'subscribe_site',
      site_id: siteId
    });
  }

  unsubscribeFromSite(siteId) {
    this.send({
      type: 'unsubscribe_site',
      site_id: siteId
    });
  }

  requestCurrentAlerts() {
    this.send({
      type: 'get_alerts'
    });
  }

  ping() {
    this.send({
      type: 'ping',
      timestamp: new Date().toISOString()
    });
  }

  // Start periodic ping to keep connection alive
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.ping();
      }
    }, 30000); // Ping every 30 seconds
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

export default websocketService;