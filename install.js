// PWA Installation Manager
class PWAInstaller {
  constructor() {
    this.deferredPrompt = null;
    this.installButton = null;
    this.isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    this.init();
  }
  
  init() {
    // Cek apakah sudah install sebagai PWA
    if (this.isStandalone) {
      console.log('Running in standalone mode');
      this.hideBrowserUI();
    }
    
    // Event beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('beforeinstallprompt fired');
      e.preventDefault();
      this.deferredPrompt = e;
      
      // Tampilkan install button setelah 3 detik
      setTimeout(() => this.showInstallButton(), 3000);
    });
    
    // Event appinstalled
    window.addEventListener('appinstalled', () => {
      console.log('PWA installed successfully');
      this.hideInstallButton();
      this.deferredPrompt = null;
      
      // Tampilkan konfirmasi
      this.showToast('Aplikasi berhasil diinstall! 🎉', 'success');
    });
    
    // Deteksi perubahan display mode
    window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
      this.isStandalone = e.matches;
      if (e.matches) {
        this.hideBrowserUI();
      }
    });
    
    // Register Service Worker
    this.registerServiceWorker();
    
    // Cek update
    this.checkForUpdates();
  }
  
  showInstallButton() {
    // Jangan tampilkan jika sudah standalone
    if (this.isStandalone) return;
    
    // Cek apakah sudah ada button
    if (document.getElementById('pwa-install-button')) return;
    
    // Buat install button
    this.installButton = document.createElement('button');
    this.installButton.id = 'pwa-install-button';
    this.installButton.className = 'pwa-install-btn';
    this.installButton.innerHTML = `
      <i class="fas fa-download"></i>
      <span>Install App</span>
    `;
    
    // Styling button
    this.installButton.style.cssText = `
      position: fixed;
      bottom: 100px;
      right: 20px;
      background: linear-gradient(135deg, #25D366, #128C7E);
      color: white;
      border: none;
      border-radius: 25px;
      padding: 12px 24px;
      font-weight: 600;
      box-shadow: 0 4px 20px rgba(37, 211, 102, 0.3);
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      transition: all 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;
    
    // Hover effect
    this.installButton.addEventListener('mouseenter', () => {
      this.installButton.style.transform = 'scale(1.05)';
      this.installButton.style.boxShadow = '0 6px 25px rgba(37, 211, 102, 0.4)';
    });
    
    this.installButton.addEventListener('mouseleave', () => {
      this.installButton.style.transform = 'scale(1)';
      this.installButton.style.boxShadow = '0 4px 20px rgba(37, 211, 102, 0.3)';
    });
    
    // Click handler
    this.installButton.addEventListener('click', () => this.installPWA());
    
    // Tambahkan ke body
    document.body.appendChild(this.installButton);
    
    // Auto hide setelah 30 detik
    setTimeout(() => {
      if (this.installButton) {
        this.installButton.style.opacity = '0';
        this.installButton.style.transform = 'translateY(20px)';
        setTimeout(() => {
          if (this.installButton && this.installButton.parentNode) {
            this.installButton.parentNode.removeChild(this.installButton);
            this.installButton = null;
          }
        }, 300);
      }
    }, 30000);
  }
  
  hideInstallButton() {
    if (this.installButton && this.installButton.parentNode) {
      this.installButton.parentNode.removeChild(this.installButton);
      this.installButton = null;
    }
  }
  
  async installPWA() {
    if (!this.deferredPrompt) {
      this.showToast('Browser tidak mendukung install PWA', 'warning');
      return;
    }
    
    try {
      // Tampilkan install prompt
      this.deferredPrompt.prompt();
      
      // Tunggu user memilih
      const { outcome } = await this.deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
        this.showToast('Menginstall aplikasi...', 'info');
      } else {
        console.log('User dismissed the install prompt');
        this.showToast('Install dibatalkan', 'info');
      }
      
      this.deferredPrompt = null;
      this.hideInstallButton();
      
    } catch (error) {
      console.error('Install error:', error);
      this.showToast('Gagal install aplikasi', 'error');
    }
  }
  
  hideBrowserUI() {
    // Sembunyikan install button jika sudah standalone
    this.hideInstallButton();
    
    // Tambahkan class untuk standalone mode
    document.documentElement.classList.add('pwa-standalone');
    
    // Sembunyikan browser address bar (jika mungkin)
    if (window.navigator.standalone) {
      window.scrollTo(0, 1);
    }
  }
  
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none'
        });
        
        console.log('Service Worker registered:', registration);
        
        // Cek update setiap load
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          console.log('Service Worker update found:', newWorker);
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              this.showUpdateNotification();
            }
          });
        });
        
        // Cek jika service worker sudah siap
        if (registration.active) {
          console.log('Service Worker active');
        }
        
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }
  
  showUpdateNotification() {
    // Buat notification untuk update
    const updateDiv = document.createElement('div');
    updateDiv.className = 'pwa-update-notification';
    updateDiv.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <i class="fas fa-sync-alt" style="color: #25D366;"></i>
        <div>
          <strong>Update tersedia!</strong>
          <p style="margin: 4px 0 0; font-size: 14px;">Versi baru aplikasi siap diinstall</p>
        </div>
      </div>
      <button id="pwa-update-btn" style="background: #25D366; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">
        Update Sekarang
      </button>
    `;
    
    updateDiv.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      right: 20px;
      background: var(--bg-secondary, white);
      border: 1px solid var(--border-color, #e0e0e0);
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.15);
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 10000;
      animation: slideUp 0.3s ease;
    `;
    
    document.body.appendChild(updateDiv);
    
    // Button handler
    document.getElementById('pwa-update-btn').addEventListener('click', () => {
      window.location.reload();
    });
    
    // Auto hide setelah 10 detik
    setTimeout(() => {
      if (updateDiv.parentNode) {
        updateDiv.style.animation = 'slideDown 0.3s ease';
        setTimeout(() => {
          if (updateDiv.parentNode) {
            updateDiv.parentNode.removeChild(updateDiv);
          }
        }, 300);
      }
    }, 10000);
  }
  
  checkForUpdates() {
    // Cek update setiap 1 jam
    setInterval(() => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(registration => {
          if (registration) {
            registration.update();
          }
        });
      }
    }, 3600000); // 1 jam
  }
  
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `pwa-toast pwa-toast-${type}`;
    toast.textContent = message;
    
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    toast.innerHTML = `${icons[type] || ''} ${message}`;
    
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#25D366' : 
                   type === 'error' ? '#FF3B30' : 
                   type === 'warning' ? '#FF9500' : '#007AFF'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      z-index: 10001;
      animation: toastIn 0.3s ease;
      max-width: 300px;
      font-size: 14px;
    `;
    
    document.body.appendChild(toast);
    
    // Auto remove setelah 3 detik
    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s ease';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }
}

// Initialize PWA Installer ketika DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.pwaInstaller = new PWAInstaller();
});

// CSS Animations untuk toast dan notifications
const style = document.createElement('style');
style.textContent = `
  @keyframes slideUp {
    from { transform: translateY(100px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  
  @keyframes slideDown {
    from { transform: translateY(0); opacity: 1; }
    to { transform: translateY(100px); opacity: 0; }
  }
  
  @keyframes toastIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes toastOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
  
  /* Standalone mode styles */
  .pwa-standalone .browser-only {
    display: none !important;
  }
  
  /* Offline indicator */
  .offline-indicator {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: #FF9500;
    color: white;
    text-align: center;
    padding: 10px;
    z-index: 10002;
    animation: slideDown 0.3s ease;
  }
`;
document.head.appendChild(style);

// Offline detection
window.addEventListener('online', () => {
  const indicator = document.querySelector('.offline-indicator');
  if (indicator) {
    indicator.style.animation = 'slideDown 0.3s ease';
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    }, 300);
  }
  
  // Show online toast
  if (window.pwaInstaller) {
    window.pwaInstaller.showToast('Koneksi internet kembali', 'success');
  }
});

window.addEventListener('offline', () => {
  const indicator = document.createElement('div');
  indicator.className = 'offline-indicator';
  indicator.innerHTML = '<i class="fas fa-wifi-slash"></i> Anda sedang offline. Beberapa fitur mungkin terbatas.';
  document.body.appendChild(indicator);
  
  // Show offline toast
  if (window.pwaInstaller) {
    window.pwaInstaller.showToast('Anda sedang offline', 'warning');
  }
});
