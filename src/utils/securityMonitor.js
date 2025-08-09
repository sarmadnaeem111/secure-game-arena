/**
 * Advanced Security Monitoring & Threat Detection System
 * Provides real-time monitoring, user education, and zero-day protection
 */

import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';

class ThreatDetectionSystem {
  constructor() {
    this.threatPatterns = [
      {
        name: 'SQL_INJECTION',
        patterns: [
          /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b.*\b(from|where|order\s+by|group\s+by)\b)/i,
          /(\b(or|and)\s*\d+=\d+)/i,
          /(\b(or|and)\s*['"].*['"]\s*=\s*['"].*['"])/i
        ],
        severity: 'CRITICAL'
      },
      {
        name: 'XSS_ATTACK',
        patterns: [
          /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
          /javascript:/i,
          /on\w+\s*=/i,
          /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi
        ],
        severity: 'HIGH'
      },
      {
        name: 'PATH_TRAVERSAL',
        patterns: [
          /\.\.\//g,
          /\.\.\\/g,
          /\/etc\/passwd/i,
          /\/windows\/system32/i
        ],
        severity: 'HIGH'
      },
      {
        name: 'COMMAND_INJECTION',
        patterns: [
          /(\b(cmd|powershell|bash|sh|exec|system)\b)/i,
          /[;&|`]/,
          /\$\(/,
          /\`\s*\w+/i
        ],
        severity: 'CRITICAL'
      }
    ];
    
    this.suspiciousBehavior = {
      rapidRequests: 0,
      lastRequestTime: 0,
      userAgents: new Set(),
      ipAddresses: new Set()
    };
    
    this.startMonitoring();
  }

  /**
   * Analyze incoming requests for threats
   */
  async analyzeRequest(requestData) {
    const { ip, userAgent, url, method, body, timestamp } = requestData;
    
    const threats = [];
    
    // Check for known attack patterns
    this.threatPatterns.forEach(threat => {
      threat.patterns.forEach(pattern => {
        const combinedData = `${url} ${JSON.stringify(body)} ${userAgent}`;
        if (pattern.test(combinedData)) {
          threats.push({
            type: threat.name,
            severity: threat.severity,
            pattern: pattern.source,
            detected: new Date().toISOString()
          });
        }
      });
    });
    
    // Detect suspicious behavior patterns
    const behaviorThreats = this.detectSuspiciousBehavior(requestData);
    threats.push(...behaviorThreats);
    
    // Log threats
    if (threats.length > 0) {
      await this.logThreat({
        ip,
        userAgent,
        url,
        method,
        threats,
        timestamp: serverTimestamp()
      });
    }
    
    return threats;
  }

  /**
   * Detect suspicious behavior patterns
   */
  detectSuspiciousBehavior(requestData) {
    const { ip, userAgent, timestamp } = requestData;
    const threats = [];
    
    // Rapid request detection
    const timeDiff = timestamp - this.suspiciousBehavior.lastRequestTime;
    if (timeDiff < 100) { // Less than 100ms between requests
      this.suspiciousBehavior.rapidRequests++;
      if (this.suspiciousBehavior.rapidRequests > 10) {
        threats.push({
          type: 'RAPID_REQUESTS',
          severity: 'MEDIUM',
          details: `Detected ${this.suspiciousBehavior.rapidRequests} rapid requests`
        });
      }
    } else {
      this.suspiciousBehavior.rapidRequests = 0;
    }
    
    // Track unique IPs and user agents for session
    this.suspiciousBehavior.ipAddresses.add(ip);
    this.suspiciousBehavior.userAgents.add(userAgent);
    
    // Multiple IPs/Agents from same session (potential session hijacking)
    if (this.suspiciousBehavior.ipAddresses.size > 3) {
      threats.push({
        type: 'SESSION_ANOMALY',
        severity: 'HIGH',
        details: `Multiple IPs detected: ${this.suspiciousBehavior.ipAddresses.size}`
      });
    }
    
    this.suspiciousBehavior.lastRequestTime = timestamp;
    
    return threats;
  }

  /**
   * Log threat to Firestore for analysis
   */
  async logThreat(threatData) {
    try {
      await addDoc(collection(db, 'security_logs'), threatData);
    } catch (error) {
      console.error('Failed to log threat:', error);
    }
  }

  /**
   * Get security analytics
   */
  async getSecurityAnalytics(timeframe = '24h') {
    try {
      const startTime = new Date();
      startTime.setHours(startTime.getHours() - (timeframe === '24h' ? 24 : 1));
      
      const q = query(
        collection(db, 'security_logs'),
        where('timestamp', '>=', startTime)
      );
      
      const snapshot = await getDocs(q);
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const analytics = {
        totalThreats: logs.length,
        threatTypes: {},
        topIPs: {},
        severityDistribution: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
        hourlyActivity: new Array(24).fill(0)
      };
      
      logs.forEach(log => {
        log.threats.forEach(threat => {
          analytics.threatTypes[threat.type] = (analytics.threatTypes[threat.type] || 0) + 1;
          analytics.severityDistribution[threat.severity]++;
        });
        
        analytics.topIPs[log.ip] = (analytics.topIPs[log.ip] || 0) + 1;
        
        const hour = new Date(log.timestamp.toDate()).getHours();
        analytics.hourlyActivity[hour]++;
      });
      
      return analytics;
    } catch (error) {
      console.error('Failed to get security analytics:', error);
      return null;
    }
  }

  /**
   * Start continuous monitoring
   */
  startMonitoring() {
    // Monitor for zero-day exploits and new attack patterns
    setInterval(async () => {
      await this.checkForNewThreats();
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  /**
   * Check for new threat patterns
   */
  async checkForNewThreats() {
    // This would typically connect to threat intelligence feeds
    // For now, we'll simulate checking for new patterns
    const newPatterns = await this.fetchThreatIntelligence();
    
    if (newPatterns.length > 0) {
      this.threatPatterns = [...this.threatPatterns, ...newPatterns];
      await this.updateSecurityRules(newPatterns);
    }
  }

  /**
   * Fetch threat intelligence (placeholder)
   */
  async fetchThreatIntelligence() {
    // In production, this would fetch from:
    // - CVE databases
    // - Threat intelligence feeds
    // - Security vendor APIs
    // - GitHub security advisories
    
    return []; // Placeholder for now
  }

  /**
   * Update security rules based on new threats
   */
  async updateSecurityRules(newPatterns) {
    try {
      await addDoc(collection(db, 'security_updates'), {
        type: 'THREAT_INTELLIGENCE_UPDATE',
        patterns: newPatterns,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Failed to update security rules:', error);
    }
  }
}

/**
 * User Security Education System
 */
export class SecurityEducation {
  constructor() {
    this.tips = [
      {
        id: 'strong_password',
        title: 'Use Strong Passwords',
        content: 'Create passwords with at least 12 characters, including uppercase, lowercase, numbers, and symbols.',
        priority: 'HIGH'
      },
      {
        id: 'phishing',
        title: 'Beware of Phishing',
        content: 'Never click suspicious links or provide your credentials to unverified sources.',
        priority: 'CRITICAL'
      },
      {
        id: 'two_factor',
        title: 'Enable Two-Factor Authentication',
        content: 'Add an extra layer of security to your account with 2FA when available.',
        priority: 'HIGH'
      },
      {
        id: 'public_wifi',
        title: 'Avoid Public WiFi',
        content: 'Don\'t access sensitive accounts on public WiFi networks without VPN protection.',
        priority: 'MEDIUM'
      },
      {
        id: 'updates',
        title: 'Keep Software Updated',
        content: 'Regularly update your browser and operating system to patch security vulnerabilities.',
        priority: 'HIGH'
      }
    ];
  }

  /**
   * Get personalized security tips for user
   */
  getPersonalizedTips(userBehavior) {
    const relevantTips = [...this.tips];
    
    // Add behavior-specific tips
    if (userBehavior.weakPassword) {
      relevantTips.unshift({
        id: 'weak_password_alert',
        title: 'Password Security Alert',
        content: 'Your current password appears weak. Consider updating to a stronger password immediately.',
        priority: 'CRITICAL'
      });
    }
    
    if (userBehavior.phishingAttempt) {
      relevantTips.unshift({
        id: 'phishing_attempt',
        title: 'Phishing Attempt Detected',
        content: 'We detected suspicious activity. Please review recent emails and report any phishing attempts.',
        priority: 'CRITICAL'
      });
    }
    
    return relevantTips.slice(0, 3);
  }

  /**
   * Track user security awareness
   */
  async trackUserEducation(userId, tipId, action) {
    try {
      await addDoc(collection(db, 'user_security_education'), {
        userId,
        tipId,
        action,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Failed to track user education:', error);
    }
  }

  /**
   * Generate security report for user
   */
  async generateUserSecurityReport(userId) {
    try {
      const q = query(
        collection(db, 'security_logs'),
        where('userId', '==', userId)
      );
      
      const snapshot = await getDocs(q);
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const report = {
        userId,
        totalIncidents: logs.length,
        lastIncident: logs.length > 0 ? logs[logs.length - 1].timestamp : null,
        securityScore: this.calculateSecurityScore(logs),
        recommendations: this.generateRecommendations(logs)
      };
      
      return report;
    } catch (error) {
      console.error('Failed to generate security report:', error);
      return null;
    }
  }

  /**
   * Calculate security score
   */
  calculateSecurityScore(logs) {
    if (logs.length === 0) return 100;
    
    const recentLogs = logs.filter(log => 
      new Date(log.timestamp.toDate()) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );
    
    let score = 100;
    recentLogs.forEach(log => {
      log.threats.forEach(threat => {
        switch (threat.severity) {
          case 'CRITICAL': score -= 20; break;
          case 'HIGH': score -= 10; break;
          case 'MEDIUM': score -= 5; break;
          case 'LOW': score -= 2; break;
        }
      });
    });
    
    return Math.max(0, score);
  }

  /**
   * Generate security recommendations
   */
  generateRecommendations(logs) {
    const recommendations = [];
    const threatTypes = {};
    
    logs.forEach(log => {
      log.threats.forEach(threat => {
        threatTypes[threat.type] = (threatTypes[threat.type] || 0) + 1;
      });
    });
    
    if (threatTypes.BRUTE_FORCE > 3) {
      recommendations.push('Enable two-factor authentication and use stronger passwords');
    }
    
    if (threatTypes.PHISHING_ATTEMPT > 0) {
      recommendations.push('Review and update your email security settings');
    }
    
    if (threatTypes.SESSION_ANOMALY > 2) {
      recommendations.push('Review your account activity and change your password');
    }
    
    return recommendations;
  }
}

// Initialize systems
const threatDetection = new ThreatDetectionSystem();
const securityEducation = new SecurityEducation();

export { threatDetection, securityEducation };
export default { threatDetection, securityEducation };