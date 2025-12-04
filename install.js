// PWA Installation Handler
let deferredPrompt;
const installButton = document.createElement('button');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  // Show install button
  installButton.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px;
    background: #25D366;
    color: white;
    border: none;
    border-radius: 25px;
    padding: 12px 24px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 8px;
  `;
  installButton.innerHTML = '<i class="fas fa-download"></i> Install App';
  installButton.onclick = installPWA;
  document.body.appendChild(installButton);
});

async function installPWA() {
  if (!deferredPrompt) return;
  
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  
  if (outcome === 'accepted') {
    installButton.style.display = 'none';
  }
  
  deferredPrompt = null;
}

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('ServiceWorker registered:', registration);
      })
      .catch(error => {
        console.log('ServiceWorker registration failed:', error);
      });
  });
}
