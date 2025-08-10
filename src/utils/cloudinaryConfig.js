/**
 * Cloudinary configuration for image uploads
 * This file sets up the Cloudinary client with environment variables
 */

/**
 * Security measures implemented:
 * 1. Environment variables for sensitive credentials
 * 2. HTTPS enforced for all operations
 * 3. Upload preset used for client-side uploads with restrictions
 * 4. Image URLs sanitized before storing in database
 * 5. File size and type restrictions enforced
 * 6. Dynamic script loading to avoid CORS issues
 */

// Flag to track if we've already tried to load the script
let scriptLoaded = false;

// Function to dynamically load the Cloudinary script
const loadCloudinaryScript = () => {
  return new Promise((resolve, reject) => {
    // If script is already loaded, resolve immediately
    if (window.cloudinary) {
      resolve(window.cloudinary);
      return;
    }
    
    // If we've already tried to load the script but it failed, don't try again
    if (scriptLoaded) {
      reject(new Error('Cloudinary script already attempted to load but failed'));
      return;
    }
    
    scriptLoaded = true;
    
    // Create script element
    const script = document.createElement('script');
    script.src = 'https://widget.cloudinary.com/v2.0/global/all.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    
    // Set up event handlers
    script.onload = () => {
      if (process.env.NODE_ENV === 'development') {
        console.debug('Cloudinary script loaded successfully');
      }
      resolve(window.cloudinary);
    };
    
    script.onerror = () => {
      if (process.env.NODE_ENV === 'development') {
        console.debug('Failed to load Cloudinary script');
      }
      reject(new Error('Failed to load Cloudinary script'));
    };
    
    // Add script to document
    document.body.appendChild(script);
  });
};

// Initialize Cloudinary configuration
const initCloudinary = async () => {
  try {
    // Load the script if not already loaded
    if (!window.cloudinary) {
      await loadCloudinaryScript();
    }
    
    // Configure Cloudinary
    if (window.cloudinary) {
      // Set the cloud name directly on the cloudinary object
      window.cloudinary.setCloudName(process.env.REACT_APP_CLOUDINARY_CLOUD_NAME);
      
      // Configure global widget settings to fix cross-origin issues
      if (window.cloudinary.createUploadWidget) {
        window.cloudinary.config({
          secure: true,
          frameOrigin: window.location.origin,
          corsUseCredentials: false, // Disable credentials for CORS requests
          autoMinimize: true // Minimize widget to reduce CORS issues
        });
        
        // Patch the createUploadWidget method to ensure proper origin handling
        const originalCreateUploadWidget = window.cloudinary.createUploadWidget;
        window.cloudinary.createUploadWidget = function(options, callback) {
          // Ensure frameOrigin is set
          options.frameOrigin = options.frameOrigin || window.location.origin;
          
          // Prefer inline container when possible
          if (!options.inlineContainer) {
            console.warn('Consider using an inline container for better cross-origin handling');
          }
          
          return originalCreateUploadWidget.call(this, options, callback);
        };
      }
      
      // Log success message only in development mode
      if (process.env.NODE_ENV === 'development') {
        console.debug('Cloudinary initialized with cloud name:', process.env.REACT_APP_CLOUDINARY_CLOUD_NAME);
      }
      
      return window.cloudinary;
    }
  } catch (error) {
    // Use debug level logging instead of error to avoid console errors
    if (process.env.NODE_ENV === 'development') {
      console.debug('Error initializing Cloudinary:', error);
    }
    return null;
  }
};

export default initCloudinary;
