import { rateLimitMiddleware, trackLoginAttempt, SecurityMonitor } from '../utils/rateLimiter';
import { threatDetection, SecurityEducation } from '../utils/securityMonitor';
import { validateUserPermission } from './securityMiddleware';
import { getAuth } from 'firebase/auth';

const securityMonitor = new SecurityMonitor();
const education = new SecurityEducation();

// Enhanced security middleware combining all security features
export const advancedSecurityMiddleware = {
  
  // API Security Middleware
  apiSecurity: async (req, res, next) => {
    try {
      const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      
      // Check if IP is blocked
      if (securityMonitor.isIPBlocked(clientIP)) {
        await threatDetection.logThreat({
          type: 'BLOCKED_IP_ACCESS',
          severity: 'HIGH',
          source: clientIP,
          details: 'Attempted access from blocked IP',
          timestamp: new Date()
        });
        return res.status(403).json({ error: 'Access denied from this IP address' });
      }

      // Rate limiting
      const rateLimitResult = await rateLimitMiddleware(clientIP, req.originalUrl);
      if (!rateLimitResult.allowed) {
        await threatDetection.logThreat({
          type: 'RATE_LIMIT_EXCEEDED',
          severity: 'MEDIUM',
          source: clientIP,
          details: `Rate limit exceeded for ${req.originalUrl}`,
          timestamp: new Date()
        });
        return res.status(429).json({ error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter });
      }

      // Threat detection
      const threatResult = await threatDetection.analyzeRequest(req);
      if (threatResult.isThreat) {
        await threatDetection.logThreat({
          type: threatResult.type,
          severity: threatResult.severity,
          source: clientIP,
          details: threatResult.details,
          timestamp: new Date()
        });

        if (threatResult.severity === 'CRITICAL') {
          securityMonitor.blockIP(clientIP, 24 * 60 * 60 * 1000); // Block for 24 hours
          return res.status(403).json({ error: 'Security threat detected' });
        }
      }

      next();
    } catch (error) {
      console.error('Security middleware error:', error);
      next();
    }
  },

  // Authentication Security Middleware
  authSecurity: async (req, res, next) => {
    try {
      const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      const { email, password } = req.body;

      // Track login attempt
      const loginResult = await trackLoginAttempt(clientIP, email);
      if (loginResult.blocked) {
        await threatDetection.logThreat({
          type: 'BRUTE_FORCE_ATTEMPT',
          severity: 'HIGH',
          source: clientIP,
          details: `Multiple failed login attempts for ${email}`,
          timestamp: new Date()
        });
        return res.status(429).json({ 
          error: 'Too many failed login attempts', 
          retryAfter: loginResult.retryAfter 
        });
      }

      next();
    } catch (error) {
      console.error('Auth security middleware error:', error);
      next();
    }
  },

  // Permission Security Middleware
  permissionSecurity: async (req, res, next) => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { resourceType, action, resourceId } = req.params;
      
      // Check user permissions
      const hasPermission = await validateUserPermission(user.uid, resourceType, action, resourceId);
      
      if (!hasPermission) {
        await threatDetection.logThreat({
          type: 'UNAUTHORIZED_ACCESS_ATTEMPT',
          severity: 'MEDIUM',
          source: user.uid,
          details: `Attempted ${action} on ${resourceType}/${resourceId}`,
          timestamp: new Date()
        });
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    } catch (error) {
      console.error('Permission security middleware error:', error);
      next();
    }
  },

  // Input Validation Security
  inputValidation: async (req, res, next) => {
    try {
      // Check for suspicious patterns in input
      const suspiciousPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /\.\.\//g,
        /\/etc\/passwd/g,
        /cmd\.exe/gi,
        /powershell/gi
      ];

      const checkInput = (obj) => {
        if (typeof obj === 'string') {
          for (const pattern of suspiciousPatterns) {
            if (pattern.test(obj)) {
              throw new Error(`Suspicious input detected: ${obj}`);
            }
          }
        } else if (typeof obj === 'object' && obj !== null) {
          Object.values(obj).forEach(checkInput);
        }
      };

      checkInput(req.body);
      checkInput(req.query);
      checkInput(req.params);

      next();
    } catch (error) {
      await threatDetection.logThreat({
        type: 'MALICIOUS_INPUT',
        severity: 'HIGH',
        source: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        details: error.message,
        timestamp: new Date()
      });
      return res.status(400).json({ error: 'Invalid input detected' });
    }
  },

  // Security Headers Middleware
  securityHeaders: (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://www.googletagmanager.com; " +
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "img-src 'self' data: https:; " +
      "connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com;"
    );
    next();
  },

  // User Education Middleware
  userEducation: async (req, res, next) => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (user) {
        // Track user behavior for personalized tips
        await education.trackUserBehavior(user.uid, {
          action: req.method,
          endpoint: req.originalUrl,
          timestamp: new Date()
        });

        // Check if user should receive security tips
        const shouldShowTips = await education.shouldShowSecurityTips(user.uid);
        if (shouldShowTips) {
          const tips = education.getPersonalizedTips({ userId: user.uid });
          res.setHeader('X-Security-Tips', JSON.stringify(tips));
        }
      }

      next();
    } catch (error) {
      console.error('User education middleware error:', error);
      next();
    }
  }
};

// Combined security middleware
export const applySecurityMiddleware = (app) => {
  // Apply security headers to all requests
  app.use(advancedSecurityMiddleware.securityHeaders);
  
  // Apply API security to all API routes
  app.use('/api', advancedSecurityMiddleware.apiSecurity);
  
  // Apply authentication security to auth routes
  app.use('/api/auth', advancedSecurityMiddleware.authSecurity);
  
  // Apply permission security to protected routes
  app.use('/api/protected', advancedSecurityMiddleware.permissionSecurity);
  
  // Apply input validation to all routes
  app.use(advancedSecurityMiddleware.inputValidation);
  
  // Apply user education
  app.use(advancedSecurityMiddleware.userEducation);
};

// Security monitoring functions
export const startSecurityMonitoring = () => {
  // Start threat detection monitoring
  threatDetection.startMonitoring();
  
  // Schedule regular security audits
  setInterval(async () => {
    const audit = await threatDetection.performSecurityAudit();
    console.log('Security audit completed:', audit);
  }, 24 * 60 * 60 * 1000); // Daily
};

// Emergency security response
export const emergencySecurityResponse = async (threatType, source) => {
  const response = {
    blocked: false,
    message: ''
  };

  switch (threatType) {
    case 'CRITICAL_ATTACK':
      securityMonitor.blockIP(source, 7 * 24 * 60 * 60 * 1000); // 7 days
      response.blocked = true;
      response.message = 'IP blocked due to critical security threat';
      break;
    case 'DDoS_ATTACK':
      securityMonitor.blockIP(source, 24 * 60 * 60 * 1000); // 24 hours
      response.blocked = true;
      response.message = 'IP blocked due to DDoS attack';
      break;
    default:
      response.message = 'Threat logged for analysis';
  }

  await threatDetection.logThreat({
    type: 'EMERGENCY_RESPONSE',
    severity: 'CRITICAL',
    source: source,
    details: response.message,
    timestamp: new Date()
  });

  return response;
};