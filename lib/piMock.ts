// Pi SDK Mock for Local Development
// This mock simulates Pi payments when testing outside Pi Browser

export interface MockPaymentCallbacks {
  onReadyForServerApproval?: (paymentId: string) => void | Promise<void>;
  onReadyForServerCompletion?: (paymentId: string, txid: string) => void | Promise<void>;
  onCancel?: (paymentId: string) => void | Promise<void>;
  onError?: (error: Error, paymentId?: string) => void | Promise<void>;
}

export interface PaymentData {
  amount: number;
  memo: string;
  metadata?: Record<string, any>;
}

// Generate mock TXID
const generateMockTxid = () => {
  return 'mock-txid-' + Date.now() + '-' + Math.random().toString(36).substring(2, 15);
};

// Generate mock payment ID
const generateMockPaymentId = () => {
  return 'mock-payment-' + Date.now();
};

// Check if we're in local mode
const isLocalhost = () => {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'localhost' || 
         window.location.hostname === '127.0.0.1';
};

// Mock Pi SDK
export const mockPiSDK = {
  initialized: true,
  
  init: (config: { version: string; sandbox?: boolean }) => {
    console.log('🔧 Mock Pi SDK initialized:', config);
    mockPiSDK.initialized = true;
  },

  authenticate: async (scopes: string[], onIncompletePaymentFound?: (payment: any) => void) => {
    console.log('🔧 Mock Pi authenticate called with scopes:', scopes);
    
    // Return mock user data for local testing
    return {
      accessToken: 'mock-access-token-' + Date.now(),
      user: {
        uid: 'local-test-user-' + Date.now(),
        username: 'localtestuser',
      }
    };
  },

  createPayment: async (paymentData: PaymentData, callbacks: MockPaymentCallbacks) => {
    console.log('🔧 Mock Pi createPayment called:', paymentData);
    
    const paymentId = generateMockPaymentId();
    
    // Show immediate feedback that mock is working
    console.log('🔧 Mock: Starting payment simulation...');
    
    // Use a non-blocking approach with immediate callback invocation
    // This ensures the payment flow doesn't hang
    
    // First, trigger server approval immediately (synchronously in next tick)
    Promise.resolve().then(() => {
      console.log('🔧 Mock: Triggering onReadyForServerApproval', paymentId);
      if (callbacks.onReadyForServerApproval) {
        callbacks.onReadyForServerApproval(paymentId);
      }
      
      // Then trigger completion after a short delay
      setTimeout(() => {
        const txid = generateMockTxid();
        console.log('🔧 Mock: Triggering onReadyForServerCompletion', { paymentId, txid });
        if (callbacks.onReadyForServerCompletion) {
          callbacks.onReadyForServerCompletion(paymentId, txid);
        }
      }, 100);
    });

    // Return immediately with pending status
    // The actual user confirmation will be handled separately
    return { 
      status: 'pending', 
      paymentId,
      amount: paymentData.amount,
      memo: paymentData.memo
    };
  },

  // Helper to check if we're in mock mode
  isMockMode: () => {
    if (typeof window === 'undefined') return false;
    return window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1' ||
           process.env.NEXT_PUBLIC_PI_MOCK === 'true';
  }
};

// Track if we've already injected
let hasInjected = false;

// Inject mock Pi SDK into window for local development
export const injectMockPiSDK = () => {
  if (typeof window === 'undefined') return;
  if (hasInjected) return; // Prevent multiple injections
  
  const isLocal = isLocalhost();
  
  if (isLocal && !(window as any).Pi) {
    console.log('🔧 Injecting Mock Pi SDK for local development');
    (window as any).Pi = mockPiSDK;
    hasInjected = true;
    
    // Add a visual indicator that we're in mock mode
    // Use setTimeout to ensure DOM is ready
    setTimeout(() => {
      if (!document.getElementById('pi-mock-indicator')) {
        const indicator = document.createElement('div');
        indicator.id = 'pi-mock-indicator';
        indicator.innerHTML = '🧪 Pi MOCK MODE';
        indicator.style.cssText = `
          position: fixed;
          top: 10px;
          right: 10px;
          background: #ff6b6b;
          color: white;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: bold;
          z-index: 9999;
          box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        `;
        document.body.appendChild(indicator);
      }
    }, 100);
  }
};

// Helper function to get Pi SDK (real or mock)
export const getPiSDK = () => {
  if (typeof window === 'undefined') return null;
  
  const isLocal = isLocalhost();
  
  // If on localhost and no real Pi SDK, use mock
  if (isLocal && !(window as any).Pi) {
    injectMockPiSDK();
  }
  
  return (window as any).Pi;
};
