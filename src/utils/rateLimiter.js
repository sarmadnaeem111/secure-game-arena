/**
 * Rate Limiting and Security Monitoring System
 * Provides protection against DDoS, brute force, and API abuse
 */

class SecurityMonitor {
  constructor() {
    this.attempts = new Map();
    this.blockedIPs = new Map();
    this.requestCounts = new Map();
    this.lastReset = Date.now();
    this.securityAlerts = [];
    
    // Rate limiting configuration
    this.limits = {
      login: { maxAttempts: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15 minutes
      api: { maxRequests: 100, windowMs: 60 * 60 * 1000 }, // 100 requests per hour
      global: { maxRequests: 1000, windowMs: 60 * 60 * 1000 } // 1000 requests per hour
    };
    
    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Check if IP is blocked
   */
  isBlocked(ip) {
    const blocked = this.blockedIPs.get(ip);
    if (!blocked) return false;
    
    if (Date.now() > blocked.expires) {
      this.blockedIPs.delete(ip);
      return false;
    }
    
    return true;
  }

  /**
   * Record failed login attempt
   */
  recordFailedLogin(ip, email) {
    const key = `${ip}:${email}`;
    const attempts = this.attempts.get(key) || { count: 0, firstAttempt: Date.now() };
    
    attempts.count++;
    this.attempts.set(key, attempts);
    
    // Block IP if too many attempts
    if (attempts.count >= this.limits.login.maxAttempts) {
      this.blockIP(ip, 30 * 60 * 1000); // 30 minutes
      this.logSecurityAlert('BRUTE_FORCE', { ip, email, attempts: attempts.count });
    }
  }

  /**
   * Check API request limit
   */
  checkAPIRateLimit(ip, endpoint) {
    const key = `${ip}:${endpoint}`;
    const requests = this.requestCounts.get(key) || { count: 0, firstRequest: Date.now() };
    
    // Reset if window expired
    if (Date.now() - requests.firstRequest > this.limits.api.windowMs) {
      requests.count = 0;
      requests.firstRequest = Date.now();
    }
    
    requests.count++;
    this.requestCounts.set(key, requests);
    
    if (requests.count > this.limits.api.maxRequests) {
      this.blockIP(ip, 60 * 60 * 1000); // 1 hour
      this.logSecurityAlert('API_ABUSE', { ip, endpoint, requests: requests.count });
      return false;
    }
    
    return true;
  }

  /**
   * Block IP address
   */
  blockIP(ip, durationMs) {
    this.blockedIPs.set(ip, {
      blocked: true,
      expires: Date.now() + durationMs,
      reason: 'Rate limit exceeded'
    });
  }

  /**
   * Log security alerts
   */
  logSecurityAlert(type, data) {
    const alert = {
      type,
      data,
      timestamp: new Date().toISOString(),
      severity: this.getSeverity(type)
    };
    
    this.securityAlerts.push(alert);
    
    // Keep only last 100 alerts
    if (this.securityAlerts.length > 100) {
      this.securityAlerts = this.securityAlerts.slice(-100);
    }
    
    // Send to monitoring service if available
    this.sendToMonitoring(alert);
  }

  /**
   * Get severity level for alert type
   */
  getSeverity(type) {
    const severityMap = {
      'BRUTE_FORCE': 'HIGH',
      'API_ABUSE': 'MEDIUM',
      'DDOS_ATTEMPT': 'CRITICAL',
      'SUSPICIOUS_ACTIVITY': 'LOW'
    };
    
    return severityMap[type] || 'MEDIUM';
  }

  /**
   * Send alert to monitoring service
   */
  sendToMonitoring(alert) {
    // Placeholder for external monitoring service
    console.warn('SECURITY ALERT:', alert);
    
    // In production, this would send to services like:
    // - Sentry, LogRocket, or custom monitoring
    // - Email/SMS notifications for critical alerts
    // - SIEM integration for enterprise environments
  }

  /**
   * Get security statistics
   */
  getSecurityStats() {
    return {
      blockedIPs: this.blockedIPs.size,
      totalAlerts: this.securityAlerts.length,
      recentAlerts: this.securityAlerts.slice(-10),
      activeThreats: this.securityAlerts.filter(a => 
        new Date(a.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      ).length
    };
  }

  /**
   * Clean up old data
   */
  startCleanupInterval() {
    setInterval(() => {
      const now = Date.now();
      
      // Clean up old attempts
      for (const [key, data] of this.attempts.entries()) {
        if (now - data.firstAttempt > this.limits.login.windowMs) {
          this.attempts.delete(key);
        }
      }
      
      // Clean up old request counts
      for (const [key, data] of this.requestCounts.entries()) {
        if (now - data.firstRequest > this.limits.api.windowMs) {
          this.requestCounts.delete(key);
        }
      }
    }, 5 * 60 * 1000); // Clean every 5 minutes
  }
}

// Singleton instance
const securityMonitor = new SecurityMonitor();

/**
 * Rate limiting middleware for API calls
 */
export const rateLimitMiddleware = (endpoint) => {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    
    if (securityMonitor.isBlocked(ip)) {
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Your IP has been temporarily blocked due to excessive requests'
      });
    }
    
    if (!securityMonitor.checkAPIRateLimit(ip, endpoint)) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests to this endpoint'
      });
    }
    
    next();
  };
};

/**
 * Login attempt tracking
 */
export const trackLoginAttempt = (ip, email, success) => {
  if (!success) {
    securityMonitor.recordFailedLogin(ip, email);
  } else {
    // Clear failed attempts on successful login
    const key = `${ip}:${email}`;
    securityMonitor.attempts.delete(key);
  }
};

/**
 * Get security dashboard data
 */
export const getSecurityDashboard = () => {
  return securityMonitor.getSecurityStats();
};

export default securityMonitor;