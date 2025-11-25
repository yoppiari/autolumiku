/**
 * Development Auth Helper
 * Auto-injects mock user authentication for development
 *
 * Usage: Add to your dev environment
 * <script src="/dev-auth-helper.js"></script>
 */

(function() {
  // Only run in development
  if (process.env.NODE_ENV === 'production') return;

  // Check if user is already authenticated
  const existingUser = localStorage.getItem('user');

  if (!existingUser) {
    console.log('🔧 [Dev Helper] Injecting mock authentication...');

    // Mock user with tenant from database
    const mockUser = {
      id: 'dev-user-123',
      tenantId: '8dd6398e-b2d2-4724-858f-ef9cfe6cd5ed', // Showroom Jakarta Premium
      name: 'Dev User',
      email: 'dev@showroom.com',
      role: 'admin',
      _isMock: true
    };

    localStorage.setItem('user', JSON.stringify(mockUser));
    console.log('✅ [Dev Helper] Mock user authenticated:', mockUser);
  } else {
    const user = JSON.parse(existingUser);
    if (user._isMock) {
      console.log('✅ [Dev Helper] Mock auth active:', user);
    }
  }

  // Add helper functions to window for console access
  window.devAuth = {
    login: (tenantId = '8dd6398e-b2d2-4724-858f-ef9cfe6cd5ed') => {
      const user = {
        id: 'dev-user-123',
        tenantId,
        name: 'Dev User',
        email: 'dev@showroom.com',
        role: 'admin',
        _isMock: true
      };
      localStorage.setItem('user', JSON.stringify(user));
      console.log('✅ Logged in as:', user);
      location.reload();
    },
    logout: () => {
      localStorage.removeItem('user');
      console.log('✅ Logged out');
      location.reload();
    },
    switchTenant: (tenantId) => {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      user.tenantId = tenantId;
      localStorage.setItem('user', JSON.stringify(user));
      console.log('✅ Switched to tenant:', tenantId);
      location.reload();
    },
    status: () => {
      const user = localStorage.getItem('user');
      if (user) {
        console.log('✅ Authenticated:', JSON.parse(user));
      } else {
        console.log('❌ Not authenticated');
      }
    }
  };

  console.log('💡 [Dev Helper] Available commands:');
  console.log('   - devAuth.login()           // Login with default tenant');
  console.log('   - devAuth.login(tenantId)   // Login with specific tenant');
  console.log('   - devAuth.logout()          // Logout');
  console.log('   - devAuth.switchTenant(id)  // Switch to different tenant');
  console.log('   - devAuth.status()          // Check current auth status');
  console.log('');
  console.log('📝 Available Tenants:');
  console.log('   - 8dd6398e-b2d2-4724-858f-ef9cfe6cd5ed // Showroom Jakarta Premium');
  console.log('   - 5536722c-78e5-4dcd-9d35-d16858add414 // Showroom Elite Jakarta');
  console.log('   - de43ff80-1bf4-4bc2-8f26-c54db896f6c2 // Showroom Mobil Surabaya');
  console.log('   - 508b3141-31c4-47fb-8473-d5b5ba940ac6 // Showroom Mobil Bandung');
})();
