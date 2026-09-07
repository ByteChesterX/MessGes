// Read Receipts Module

(function() {
    'use strict';

    // Track last read timestamp per room
    const lastReadTimestamps = {};

    // Update last read timestamp for current room
    function updateLastRead(roomId = 'general') {
        if (!AppConfig || !AppConfig.AppState || !AppConfig.AppState.currentUser) {
            return;
        }

        const now = Date.now();
        lastReadTimestamps[roomId] = now;
        
        // Save to Firestore
        if (AppConfig.FB && AppConfig.FB.database) {
            const userId = AppConfig.AppState.currentUser;
            const ref = AppConfig.FB.database.ref(
                `read_receipts/${roomId}/${userId}`
            );
            ref.set({ lastRead: now });
        }
        
        // Also save locally
        AppConfig.AppState.lastRead = lastReadTimestamps;
        localStorage.setItem('lastRead_timestamps', JSON.stringify(lastReadTimestamps));
    }

    // Get last read timestamp for a room
    function getLastRead(roomId = 'general') {
        return lastReadTimestamps[roomId] || 0;
    }

    // Check if message is read by current user
    function isMessageRead(msgTimestamp, roomId = 'general') {
        const lastRead = getLastRead(roomId);
        return msgTimestamp <= lastRead;
    }

    // Load saved read timestamps
    function loadReadTimestamps() {
        const saved = localStorage.getItem('lastRead_timestamps');
        if (saved) {
            try {
                Object.assign(lastReadTimestamps, JSON.parse(saved));
            } catch (e) {
                console.error('Error loading read timestamps:', e);
            }
        }
    }

    // Listen for new messages and auto-update last read
    function setupReadReceiptListeners() {
        if (!AppConfig || !AppConfig.FB || !AppConfig.FB.messagesRef) {
            setTimeout(setupReadReceiptListeners, 500);
            return;
        }

        // Update last read when user scrolls to bottom
        const messagesContainer = document.getElementById('messagesList');
        if (messagesContainer) {
            let scrollTimeout;
            messagesContainer.addEventListener('scroll', () => {
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(() => {
                    const isAtBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop <= 
                                       messagesContainer.clientHeight + 100;
                    if (isAtBottom) {
                        const roomId = AppConfig.AppState.currentRoom || 'general';
                        updateLastRead(roomId);
                    }
                }, 200);
            });
        }

        // Update last read when new message is received (if at bottom)
        const observer = new MutationObserver((mutations) => {
            const roomId = AppConfig.AppState.currentRoom || 'general';
            const messagesContainer = document.getElementById('messagesList');
            if (messagesContainer) {
                const isAtBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop <= 
                                   messagesContainer.clientHeight + 100;
                if (isAtBottom) {
                    updateLastRead(roomId);
                }
            }
        });

        observer.observe(document.getElementById('messagesList') || document.body, {
            childList: true,
            subtree: true
        });
    }

    // Render read receipt indicator for a message
    function renderReadReceiptIndicator(msgKey, msgSender, msgTimestamp, roomId = 'general') {
        if (!AppConfig || !AppConfig.AppState || !AppConfig.AppState.currentUser) {
            return '';
        }

        const isMe = msgSender === AppConfig.AppState.currentUser;
        if (!isMe) return '';

        // For now, we'll show a simple indicator
        // In a full implementation, we'd check who has read the message
        return '<span class="read-receipt-indicator"><span class="read-icon">✓</span></span>';
    }

    // Initialize
    function initReadReceipts() {
        loadReadTimestamps();
        setupReadReceiptListeners();
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

    // Start
    domReady().then(() => {
        initReadReceipts();
    });

    // Export
    window.ReadReceiptManager = {
        updateLastRead,
        getLastRead,
        isMessageRead,
        loadReadTimestamps,
        renderReadReceiptIndicator,
        initReadReceipts
    };
})();
