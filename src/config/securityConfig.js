// Comprehensive security configuration
export const securityConfig = {
  // Rate Limiting Configuration
  rateLimit: {
    login: {
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000, // 15 minutes
      blockDuration: 30 * 60 * 1000 // 30 minutes
    },
    api: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // requests per window
      standardHeaders: true,
      legacyHeaders: false
    },
    global: {
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 1000 // requests per minute per IP
    }
  },

  // Threat Detection Configuration
  threatDetection: {
    enabled: true,
    patterns: {
      sqlInjection: [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC|SCRIPT)\b)/gi,
        /(\b(OR|AND)\s+\d+=\d+)/gi,
        /('|")\s*OR\s*\d+=\d+/gi
      ],
      xss: [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
        /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi
      ],
      pathTraversal: [
        /\.\.\//g,
        /\/etc\/passwd/g,
        /\/windows\/system32/gi,
        /\.\.\\/g,
        /%2e%2e%2f/gi
      ],
      commandInjection: [
        /;\s*rm\s+/gi,
        /;\s*cat\s+/gi,
        /\|\s*sh\s+/gi,
        /cmd\.exe/gi,
        /powershell/gi,
        /&\s*\w+/g
      ]
    },
    thresholds: {
      rapidRequests: 50, // requests in 1 second
      suspiciousBehavior: 10, // suspicious patterns in 1 minute
      sessionAnomalies: 5 // session anomalies before flagging
    },
    actions: {
      blockIP: true,
      logThreat: true,
      alertAdmin: true,
      notifyUser: true
    }
  },

  // User Education Configuration
  userEducation: {
    enabled: true,
    tips: {
      frequency: {
        daily: 1,
        weekly: 3,
        monthly: 10
      },
      categories: [
        'password_security',
        'phishing_awareness',
        'two_factor_auth',
        'secure_browsing',
        'device_security',
        'social_engineering'
      ]
    },
    scoring: {
      strongPassword: 10,
      twoFactorEnabled: 15,
      regularLogin: 5,
      suspiciousActivity: -20,
      passwordChange: 5,
      securityCheck: 10
    }
  },

  // Security Headers Configuration
  securityHeaders: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://cdn.jsdelivr.net",
          "https://www.googletagmanager.com",
          "https://www.google-analytics.com"
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://fonts.googleapis.com"
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com"
        ],
        imgSrc: [
          "'self'",
          "data:",
          "https:",
          "https://res.cloudinary.com"
        ],
        connectSrc: [
          "'self'",
          "https://firestore.googleapis.com",
          "https://identitytoolkit.googleapis.com",
          "https://www.google-analytics.com"
        ],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"]
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    noSniff: true,
    frameOptions: 'DENY',
    xssProtection: '1; mode=block'
  },

  // Encryption Configuration
  encryption: {
    algorithm: 'AES-256-CBC',
    keyLength: 256,
    saltLength: 64,
    iterations: 100000,
    keyDerivation: 'PBKDF2',
    hash: 'SHA256'
  },

  // Monitoring Configuration
  monitoring: {
    enabled: true,
    auditFrequency: 24 * 60 * 60 * 1000, // Daily
    alertThresholds: {
      failedLogins: 10,
      blockedIPs: 5,
      criticalThreats: 1,
      suspiciousActivity: 20
    },
    notifications: {
      email: true,
      dashboard: true,
      webhook: false
    }
  },

  // Backup and Recovery Configuration
  backup: {
    enabled: true,
    frequency: 24 * 60 * 60 * 1000, // Daily
    retention: 30, // days
    locations: ['cloud', 'local'],
    encryption: true,
    verification: true
  },

  // API Security Configuration
  api: {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? ['https://yourdomain.com', 'https://www.yourdomain.com']
        : ['http://localhost:3000', 'http://localhost:3001'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
    },
    timeout: 30000, // 30 seconds
    maxRequestSize: '10mb',
    allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    maxFileSize: 5 * 1024 * 1024 // 5MB
  },

  // Environment Configuration
  environment: {
    production: {
      debug: false,
      logging: 'error',
      rateLimit: true,
      threatDetection: true,
      userEducation: true
    },
    development: {
      debug: true,
      logging: 'debug',
      rateLimit: false,
      threatDetection: true,
      userEducation: true
    },
    test: {
      debug: false,
      logging: 'silent',
      rateLimit: false,
      threatDetection: false,
      userEducation: false
    }
  }
};

// Helper function to get current environment config
export const getSecurityConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  return {
    ...securityConfig,
    current: securityConfig.environment[env] || securityConfig.environment.development
  };
};

// Validation helper functions
export const validateSecurityConfig = (config) => {
  const errors = [];

  // Validate rate limiting
  if (!config.rateLimit || !config.rateLimit.login || !config.rateLimit.api) {
    errors.push('Rate limiting configuration is incomplete');
  }

  // Validate threat detection
  if (config.threatDetection?.enabled && !config.threatDetection.patterns) {
    errors.push('Threat detection patterns are missing');
  }

  // Validate encryption
  if (!config.encryption || !config.encryption.algorithm) {
    errors.push('Encryption configuration is missing');
  }

  // Validate security headers
  if (!config.securityHeaders || !config.securityHeaders.contentSecurityPolicy) {
    errors.push('Security headers configuration is missing');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

// Security checklist for deployment
export const securityChecklist = {
  preDeployment: [
    'All environment variables are configured',
    'SSL/TLS certificates are installed',
    'Security headers are configured',
    'Rate limiting is enabled',
    'Threat detection is active',
    'User education is enabled',
    'Backup system is configured',
    'Monitoring alerts are set up',
    'CORS is properly configured',
    'File upload restrictions are in place'
  ],
  
  postDeployment: [
    'Test all security endpoints',
    'Verify rate limiting works',
    'Check threat detection logs',
    'Test user education features',
    'Verify backup functionality',
    'Test emergency response procedures',
    'Monitor security dashboard',
    'Review security alerts'
  ],

  ongoing: [
    'Daily security audit',
    'Weekly vulnerability scan',
    'Monthly security review',
    'Quarterly penetration test',
    'Update security dependencies',
    'Review user security reports',
    'Update threat detection patterns',
    'Backup verification'
  ]
};

// Default security settings for new users
export const defaultUserSecurity = {
  twoFactorEnabled: false,
  lastPasswordChange: new Date(),
  securityScore: 100,
  securityTipsSeen: [],
  suspiciousActivity: [],
  trustedDevices: [],
  loginHistory: [],
  securitySettings: {
    emailNotifications: true,
    loginAlerts: true,
    newDeviceAlerts: true,
    securityUpdates: true
  }
};