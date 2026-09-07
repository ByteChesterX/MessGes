// Notifications Module

(function() {
    'use strict';

    // Request notification permission
    function requestPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            return Notification.requestPermission().then(permission => {
                if (window.AppConfig && window.AppConfig.AppState) {
                    window.AppConfig.AppState.notificationsEnabled = permission === 'granted';
                    localStorage.setItem('notifications_enabled', permission === 'granted');
                }
                return permission;
            });
        }
        return Promise.resolve(Notification.permission);
    }

    // Show notification
    function showNotification(title, options = {}) {
        if ('Notification' in window && Notification.permission === 'granted') {
            return new Notification(title, options);
        }
        return null;
    }

    // Show notification for new message
    function showNewMessageNotification(sender, text, avatar) {
        if (!window.AppConfig || !window.AppConfig.AppState) return;
        
        const isMentioned = window.AppConfig.AppState.currentUser && 
                          text.toLowerCase().includes(`@${window.AppConfig.AppState.currentUser.toLowerCase()}`);
        
        // Only show notification if:
        // 1. Notifications are enabled
        // 2. Page is not visible (user is not looking at it)
        // 3. User is mentioned OR it's a direct message
        if (window.AppConfig.AppState.notificationsEnabled && document.hidden) {
            const notificationTitle = isMentioned 
                ? `${sender} senden bahsetti!` 
                : `Yeni mesaj: ${sender}`;
            
            showNotification(notificationTitle, {
                body: text.length > 100 ? text.substring(0, 100) + '...' : text,
                icon: avatar || window.ChatUtils.getAvatarUrl(sender, ''),
                tag: 'new-message',
                renotify: true
            });
        }
    }

    // Initialize notifications
    function initNotifications() {
        // Request permission on load
        requestPermission();
        
        // Listen for visibility changes
        document.addEventListener('visibilitychange', () => {
            // When page becomes visible, clear notifications
            if (!document.hidden && 'Notification' in window) {
                Notification.close();
            }
        });
    }

    // Service Worker registration for push notifications
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw/service-worker.js')
                    .then(reg => {
                        console.log('Service Worker registered for notifications');
                        
                        // Request permission for push notifications
                        return reg.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: 'YOUR_VAPID_PUBLIC_KEY'
                        });
                    })
                    .then(subscription => {
                        console.log('Push notification subscription:', subscription);
                        // Send subscription to server (would need Firebase Functions)
                    })
                    .catch(err => {
                        console.log('Service Worker registration failed:', err);
                    });
            });
        }
    }

    // Initialize when DOM is ready
    function domReady() {
        return new Promise((resolve) => {
            if (document.readyState !== 'loading') {
                resolve();
            } else {
                document.addEventListener('DOMContentLoaded', resolve);
            }
        });
    }

    // Initialize
    domReady().then(() => {
        initNotifications();
        // Note: Push notifications require a server, so we're only doing in-app notifications
        // registerServiceWorker(); // Uncomment when you have a server for push notifications
    });

    // Export
    window.NotificationManager = {
        requestPermission,
        showNotification,
        showNewMessageNotification,
        initNotifications
    };
})();
