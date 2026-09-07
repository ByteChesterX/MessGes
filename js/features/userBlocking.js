// User Blocking Module

(function() {
    'use strict';

    // Initialize user blocking
    function initUserBlocking() {
        // Load blocked users from localStorage
        loadBlockedUsers();

        // Add block option to user context menu (would need UI implementation)
        // For now, we'll just provide the functionality
    }

    // Load blocked users
    function loadBlockedUsers() {
        if (AppConfig && AppConfig.AppState) {
            const saved = localStorage.getItem('blocked_users');
            AppConfig.AppState.blockedUsers = saved ? JSON.parse(saved) : [];
        }
    }

    // Save blocked users
    function saveBlockedUsers() {
        if (AppConfig && AppConfig.AppState) {
            localStorage.setItem('blocked_users', JSON.stringify(AppConfig.AppState.blockedUsers));
        }
    }

    // Block a user
    function blockUser(userId) {
        if (!AppConfig || !AppConfig.AppState) return;

        if (!AppConfig.AppState.blockedUsers.includes(userId)) {
            AppConfig.AppState.blockedUsers.push(userId);
            saveBlockedUsers();
        }
    }

    // Unblock a user
    function unblockUser(userId) {
        if (!AppConfig || !AppConfig.AppState) return;

        const index = AppConfig.AppState.blockedUsers.indexOf(userId);
        if (index > -1) {
            AppConfig.AppState.blockedUsers.splice(index, 1);
            saveBlockedUsers();
        }
    }

    // Check if user is blocked
    function isBlocked(userId) {
        if (!AppConfig || !AppConfig.AppState) return false;
        return AppConfig.AppState.blockedUsers.includes(userId);
    }

    // Get list of blocked users
    function getBlockedUsers() {
        if (!AppConfig || !AppConfig.AppState) return [];
        return AppConfig.AppState.blockedUsers || [];
    }

    // Filter blocked users from online list
    function filterBlockedUsers(users) {
        if (!users || !Array.isArray(users)) return users;
        return users.filter(user => !isBlocked(user.username));
    }

    // Filter blocked messages
    function filterBlockedMessages(messages) {
        if (!messages || !Array.isArray(messages)) return messages;
        return messages.filter(msg => !isBlocked(msg.sender));
    }

    // Toggle block status
    function toggleBlockUser(userId) {
        if (isBlocked(userId)) {
            unblockUser(userId);
            return false;
        } else {
            blockUser(userId);
            return true;
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

    // Start
    domReady().then(() => {
        initUserBlocking();
    });

    // Export
    window.UserBlockingManager = {
        initUserBlocking,
        loadBlockedUsers,
        saveBlockedUsers,
        blockUser,
        unblockUser,
        isBlocked,
        getBlockedUsers,
        filterBlockedUsers,
        filterBlockedMessages,
        toggleBlockUser
    };
})();
