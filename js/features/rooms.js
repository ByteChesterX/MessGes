// Rooms Module

(function() {
    'use strict';

    let rooms = [];
    let currentRoom = 'general';

    // Initialize rooms
    function initRooms() {
        // Load rooms from Firebase
        loadRooms();
        
        // Setup UI
        const createRoomBtn = document.getElementById('createRoomBtn');
        const roomSidebar = document.getElementById('roomSidebar');
        const roomList = document.getElementById('roomList');
        const roomNameEl = document.getElementById('roomName');

        if (createRoomBtn) {
            createRoomBtn.addEventListener('click', createRoom);
        }

        if (roomList) {
            roomList.addEventListener('click', (e) => {
                const roomItem = e.target.closest('.room-item');
                if (roomItem) {
                    switchRoom(roomItem.dataset.roomId);
                }
            });
        }

        // Update current room display
        if (roomNameEl && window.AppConfig && window.AppConfig.AppState) {
            roomNameEl.textContent = window.AppConfig.AppState.currentRoom || 'general';
        }
    }

    // Load rooms from Firebase
    function loadRooms() {
        if (!window.AppConfig || !window.AppConfig.FB || !window.AppConfig.FB.database) {
            setTimeout(loadRooms, 500);
            return;
        }

        const roomsRef = window.AppConfig.FB.database.ref('rooms');
        roomsRef.on('value', (snapshot) => {
            rooms = [];
            const data = snapshot.val();
            
            if (data) {
                Object.entries(data).forEach(([roomId, roomData]) => {
                    rooms.push({
                        id: roomId,
                        name: roomData.name || roomId,
                        description: roomData.description || '',
                        createdBy: roomData.createdBy || 'Unknown',
                        createdAt: roomData.createdAt || Date.now()
                    });
                });
            }

            // Always include general room
            if (!rooms.find(r => r.id === 'general')) {
                rooms.unshift({
                    id: 'general',
                    name: 'Genel Sohbet',
                    description: 'Ana sohbet odası',
                    createdBy: 'System',
                    createdAt: 0
                });
            }

            // Sort by name
            rooms.sort((a, b) => a.name.localeCompare(b.name));

            // Update UI
            renderRoomList();
        });
    }

    // Render room list
    function renderRoomList() {
        const roomList = document.getElementById('roomList');
        if (!roomList) return;

        roomList.innerHTML = '';

        rooms.forEach(room => {
            const roomItem = document.createElement('div');
            roomItem.className = 'room-item' + (room.id === currentRoom ? ' active' : '');
            roomItem.dataset.roomId = room.id;

            const icon = getRoomIcon(room.id);

            roomItem.innerHTML = `
                <span class="room-icon">${icon}</span>
                <div class="room-info">
                    <div class="room-name">${window.ChatUtils.escapeHTML(room.name)}</div>
                    ${room.description ? `<div class="room-desc">${window.ChatUtils.escapeHTML(room.description)}</div>` : ''}
                </div>
            `;

            roomList.appendChild(roomItem);
        });
    }

    // Get room icon
    function getRoomIcon(roomId) {
        const icons = {
            general: '💬',
            random: '🎲',
            help: '❓',
            support: '🆘',
            off-topic: '🌐',
            music: '🎵',
            movies: '🎬',
            gaming: '🎮',
            tech: '💻',
            news: '📰'
        };
        return icons[roomId] || '📌';
    }

    // Create a new room
    function createRoom() {
        if (!window.AppConfig || !window.AppConfig.AppState || !window.AppConfig.AppState.currentUser) {
            alert('Lütfen önce giriş yapın.');
            return;
        }

        const roomName = prompt('Oda adı:', '');
        if (!roomName || roomName.trim() === '') return;

        const roomDesc = prompt('Oda açıklaması (opsiyonel):', '');

        const newRoom = {
            name: roomName.trim(),
            description: roomDesc ? roomDesc.trim() : '',
            createdBy: window.AppConfig.AppState.currentUser,
            createdAt: Date.now()
        };

        const roomsRef = window.AppConfig.FB.database.ref('rooms');
        const newRoomRef = roomsRef.push();
        newRoomRef.set(newRoom);

        // Switch to the new room
        currentRoom = newRoomRef.key;
        switchRoom(currentRoom);
    }

    // Switch to a room
    function switchRoom(roomId) {
        if (!rooms.find(r => r.id === roomId)) {
            console.warn(`Room ${roomId} not found`);
            return;
        }

        currentRoom = roomId;
        
        // Update AppState
        if (window.AppConfig && window.AppConfig.AppState) {
            window.AppConfig.AppState.currentRoom = roomId;
            localStorage.setItem('current_room', roomId);
        }

        // Update messages reference
        if (window.AppConfig && window.AppConfig.FB && window.AppConfig.FB.database) {
            const roomMsgsRef = window.AppConfig.FB.database.ref(`room_messages/${roomId}`);
            window.AppConfig.FB.messagesRef = roomMsgsRef.query.limitToLast(100);
            window.AppConfig.FB.rawMessagesRef = window.AppConfig.FB.database.ref(`room_messages/${roomId}`);
        }

        // Update UI
        const roomNameEl = document.getElementById('roomName');
        const roomList = document.getElementById('roomList');

        if (roomNameEl) {
            const room = rooms.find(r => r.id === roomId);
            roomNameEl.textContent = room ? room.name : roomId;
        }

        if (roomList) {
            roomList.querySelectorAll('.room-item').forEach(item => {
                item.classList.toggle('active', item.dataset.roomId === roomId);
            });
        }

        // Clear messages and load new room's messages
        const messagesList = document.getElementById('messagesList');
        if (messagesList) {
            messagesList.innerHTML = '<div style="color:var(--fg-sub); text-align:center; padding-top: 20px;">Mesajlar yükleniyor...</div>';
        }

        // Update last read for this room
        if (window.ReadReceiptManager) {
            window.ReadReceiptManager.updateLastRead(roomId);
        }

        // Re-initialize message listeners
        if (window.ChatManager && window.ChatManager.initMessageListeners) {
            window.ChatManager.initMessageListeners();
        }
    }

    // Get current room
    function getCurrentRoom() {
        return currentRoom;
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
        // Load saved room
        if (window.AppConfig && window.AppConfig.AppState) {
            currentRoom = window.AppConfig.AppState.currentRoom || 'general';
        }
        initRooms();
    });

    // Export
    window.RoomManager = {
        initRooms,
        loadRooms,
        renderRoomList,
        createRoom,
        switchRoom,
        getCurrentRoom,
        getRoomIcon,
        rooms
    };
})();
