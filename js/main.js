// Main Application Module

(function() {
    'use strict';

    // Global variables
    let activeEditKey = null;
    let activeReplyTarget = null;
    let activeReactionMsgKey = null;
    let typingTimeout = null;
    let myUserRef = null;
    let myTypingRef = null;
    let messagesRef = null;
    let rawMessagesRef = null;
    let onlineRef = null;
    let typingRef = null;
    let codeBlocksMap = new Map();
    let typingUsers = new Map();

    // DOM Elements
    const DOM = {
        userModal: document.getElementById('userModal'),
        modalError: document.getElementById('modalError'),
        editModal: document.getElementById('editModal'),
        editMessageInput: document.getElementById('editMessageInput'),
        displayUsername: document.getElementById('displayUsername'),
        myAvatar: document.getElementById('myAvatar'),
        messagesList: document.getElementById('messagesList'),
        chatForm: document.getElementById('chatForm'),
        messageInput: document.getElementById('messageInput'),
        onlineUsersList: document.getElementById('onlineUsersList'),
        typingIndicator: document.getElementById('typingIndicator'),
        replyPreviewBar: document.getElementById('replyPreviewBar'),
        replyPreviewUser: document.getElementById('replyPreviewUser'),
        replyPreviewText: document.getElementById('replyPreviewText'),
        emojiToggleBtn: document.getElementById('emojiToggleBtn'),
        pickerContainer: document.getElementById('pickerContainer'),
        tabEmojiBtn: document.getElementById('tabEmojiBtn'),
        tabGifBtn: document.getElementById('tabGifBtn'),
        emojiTabContent: document.getElementById('emojiTabContent'),
        gifTabContent: document.getElementById('gifTabContent'),
        gifSearchInput: document.getElementById('gifSearchInput'),
        gifGrid: document.getElementById('gifGrid'),
        emojiPicker: document.getElementById('emojiPicker'),
        googleLoginBtn: document.getElementById('googleLoginBtn'),
        editProfileModal: document.getElementById('editProfileModal'),
        editProfileUsername: document.getElementById('editProfileUsername'),
        editProfileAvatar: document.getElementById('editProfileAvatar'),
        profileEditError: document.getElementById('profileEditError'),
        logoutBtn: document.getElementById('logoutBtn'),
        resetUserBtn: document.getElementById('resetUserBtn'),
        cancelReplyBtn: document.getElementById('cancelReplyBtn'),
        cancelEditBtn: document.getElementById('cancelEditBtn'),
        saveEditBtn: document.getElementById('saveEditBtn'),
        loadingText: document.getElementById('loadingText'),
        roomName: document.getElementById('roomName')
    };

    // Initialize Firebase
    function initFirebase() {
        // Import Firebase modules
        const { initializeApp } = firebase;
        const { getDatabase, ref, push, onChildAdded, onChildChanged, onChildRemoved, onValue, serverTimestamp, remove, update, set, query, limitToLast, get } = firebase.database;
        const { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } = firebase.auth;
        const { getStorage } = firebase.storage;

        // Initialize Firebase
        AppConfig.FB.app = initializeApp(AppConfig.firebaseConfig);
        AppConfig.FB.database = getDatabase(AppConfig.FB.app);
        AppConfig.FB.auth = getAuth(AppConfig.FB.app);
        AppConfig.FB.storage = getStorage(AppConfig.FB.app);
        AppConfig.FB.googleProvider = new GoogleAuthProvider();
        AppConfig.FB.serverTimestamp = serverTimestamp;

        // Set up references
        updateFirebaseReferences();

        // Enable persistence for offline support
        enablePersistence();
    }

    // Update Firebase references (for room switching)
    function updateFirebaseReferences() {
        const roomId = AppConfig.AppState.currentRoom || 'general';
        
        // For backward compatibility, check if we're using the old structure
        // If room_messages exists, use it; otherwise use messages
        const db = AppConfig.FB.database;
        
        // Try to use room_messages first
        const roomMsgsRef = ref(db, `room_messages/${roomId}`);
        
        // Check if room exists
        get(roomMsgsRef).then(snapshot => {
            if (snapshot.exists()) {
                // Use room_messages
                AppConfig.FB.messagesRef = query(roomMsgsRef, limitToLast(100));
                AppConfig.FB.rawMessagesRef = roomMsgsRef;
            } else {
                // Fall back to old messages structure
                AppConfig.FB.messagesRef = query(ref(db, 'messages'), limitToLast(100));
                AppConfig.FB.rawMessagesRef = ref(db, 'messages');
            }
        }).catch(() => {
            // Fall back to old messages structure
            AppConfig.FB.messagesRef = query(ref(db, 'messages'), limitToLast(100));
            AppConfig.FB.rawMessagesRef = ref(db, 'messages');
        });

        AppConfig.FB.onlineRef = ref(db, 'online_users');
        AppConfig.FB.typingRef = ref(db, 'typing');
        AppConfig.FB.roomsRef = ref(db, 'rooms');
        AppConfig.FB.readReceiptsRef = ref(db, 'read_receipts');
    }

    // Enable Firebase persistence for offline support
    function enablePersistence() {
        if (AppConfig && AppConfig.FB && AppConfig.FB.database) {
            AppConfig.FB.database.enablePersistence()
                .catch((err) => {
                    if (err.code === 'failed-precondition') {
                        console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
                    } else if (err.code === 'unimplemented') {
                        console.warn('The current browser does not support all features required to enable persistence.');
                    }
                });
        }
    }

    // Initialize user session
    function initUserSession() {
        if (!AppConfig || !AppConfig.AppState || !AppConfig.AppState.currentUser) return;

        DOM.userModal.style.display = 'none';
        DOM.displayUsername.innerText = AppConfig.AppState.currentUser;
        DOM.myAvatar.src = ChatUtils.getAvatarUrl(
            AppConfig.AppState.currentUser,
            AppConfig.AppState.currentAvatar
        );

        // Set up online presence
        const userId = AppConfig.AppState.currentUser;
        myUserRef = ref(AppConfig.FB.database, `online_users/${userId}`);
        myTypingRef = ref(AppConfig.FB.database, `typing/${userId}`);

        // Clean up on disconnect
        onDisconnect(myUserRef).remove();
        onDisconnect(myTypingRef).remove();

        // Set user as online
        const connectedRef = ref(AppConfig.FB.database, '.info/connected');
        onValue(connectedRef, (snap) => {
            if (snap.val() === true) {
                set(myUserRef, {
                    username: userId,
                    avatar: ChatUtils.getAvatarUrl(userId, AppConfig.AppState.currentAvatar)
                });
            }
        });
    }

    // Initialize message listeners
    function initMessageListeners() {
        if (!AppConfig || !AppConfig.FB) {
            setTimeout(initMessageListeners, 500);
            return;
        }

        // Clear existing listeners
        if (messagesRef) {
            messagesRef.off();
        }
        if (rawMessagesRef) {
            rawMessagesRef.off();
        }

        messagesRef = AppConfig.FB.messagesRef;
        rawMessagesRef = AppConfig.FB.rawMessagesRef;

        // Listen for new messages
        onChildAdded(messagesRef, (snapshot) => {
            handleNewMessage(snapshot);
        });

        // Listen for message changes (edits)
        onChildChanged(rawMessagesRef, (snapshot) => {
            handleMessageChange(snapshot);
        });

        // Listen for message deletions
        onChildRemoved(rawMessagesRef, (snapshot) => {
            handleMessageRemove(snapshot);
        });
    }

    // Handle new message
    function handleNewMessage(snapshot) {
        const msg = { key: snapshot.key, ...snapshot.val() };
        
        // Filter blocked users' messages
        if (UserBlockingManager && UserBlockingManager.isBlocked(msg.sender)) {
            return;
        }

        // Remove loading text
        if (DOM.loadingText) {
            DOM.loadingText.remove();
        }

        const dateObj = msg.timestamp ? new Date(msg.timestamp) : new Date();
        const timeStr = dateObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

        const lastGroup = DOM.messagesList.lastElementChild;
        const lastSender = lastGroup ? lastGroup.dataset.sender : null;
        const lastTime = lastGroup ? parseInt(lastGroup.dataset.timestamp || '0') : 0;

        const isSameSender = lastSender === msg.sender;
        const isWithin1Min = (msg.timestamp - lastTime) / 1000 < 60;

        const isMe = msg.sender.toLowerCase() === AppConfig.AppState.currentUser.toLowerCase();
        const isAdmin = ChatUtils.isAdmin();
        const isMentioned = AppConfig.AppState.currentUser && 
                          msg.text && msg.text.toLowerCase().includes(`@${AppConfig.AppState.currentUser.toLowerCase()}`);

        // Play notification sound for new messages
        if (!isMe && (Date.now() - msg.timestamp < 10000 || !msg.timestamp)) {
            if (isMentioned) {
                ChatUtils.playBeep(880);
                NotificationManager.showNewMessageNotification(
                    msg.sender,
                    msg.text || msg.file?.name || msg.voice?.duration ? 'Sesli mesaj' : 'Yeni mesaj',
                    msg.avatar
                );
            } else {
                ChatUtils.playBeep(440);
            }
        }

        // Group messages
        if (isSameSender && isWithin1Min && lastGroup) {
            const textContainer = lastGroup.querySelector('.message-text-list');
            addMessageToGroup(textContainer, msg, true, isAdmin);
        } else {
            const groupEl = document.createElement('div');
            groupEl.className = 'message-group animate-entry';
            groupEl.dataset.sender = msg.sender;
            groupEl.dataset.timestamp = msg.timestamp || Date.now();

            const avatarUrl = ChatUtils.getAvatarUrl(msg.sender, msg.avatar);
            groupEl.innerHTML = `
                <img class="group-avatar" src="${ChatUtils.escapeHTML(avatarUrl)}" 
                     alt="${ChatUtils.escapeHTML(msg.sender)}" 
                     onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(msg.sender)}'">
                <div class="group-body">
                    <div class="group-header">
                        <span class="sender-name">${ChatUtils.escapeHTML(msg.sender)}</span>
                        <span class="header-time">${timeStr}</span>
                    </div>
                    <div class="message-text-list"></div>
                </div>
            `;

            const textContainer = groupEl.querySelector('.message-text-list');
            addMessageToGroup(textContainer, msg, false, isAdmin);
            DOM.messagesList.appendChild(groupEl);
        }
        
        // Scroll to bottom
        DOM.messagesList.scrollTop = DOM.messagesList.scrollHeight;
    }

    // Add message to group
    function addMessageToGroup(container, msg, animateItem = false, isAdmin = false) {
        const item = document.createElement('div');
        item.className = 'message-item' + (animateItem ? ' animate-entry' : '');
        item.dataset.msgKey = msg.key;
        item.dataset.sender = msg.sender;
        item.dataset.rawText = msg.text || '';

        const isMe = msg.sender.toLowerCase() === AppConfig.AppState.currentUser.toLowerCase();
        const isMentioned = AppConfig.AppState.currentUser && 
                          msg.text && msg.text.toLowerCase().includes(`@${AppConfig.AppState.currentUser.toLowerCase()}`);

        if (isMentioned) item.classList.add('is-mentioned');

        // Handle different message types
        let contentHTML = '';
        
        if (msg.type === 'file' && msg.file) {
            contentHTML = renderFileMessage(msg);
        } else if (msg.type === 'voice' && msg.voice) {
            contentHTML = renderVoiceMessage(msg);
        } else if (msg.type === 'poll' && msg.poll) {
            contentHTML = renderPollMessage(msg);
        } else if (msg.type === 'game' && msg.text) {
            contentHTML = renderGameMessage(msg);
        } else {
            contentHTML = renderTextMessage(msg, isMe, isAdmin);
        }

        item.innerHTML = contentHTML;
        container.appendChild(item);

        // Render media previews after a short delay
        setTimeout(() => {
            const contentSpan = item.querySelector('.msg-content');
            if (contentSpan) {
                ChatUtils.renderMediaPreviews(contentSpan);
            }
        }, 100);
    }

    // Render text message
    function renderTextMessage(msg, isMe, isAdmin) {
        let quoteHTML = '';
        if (msg.replyTo) {
            quoteHTML = `
                <div class="quoted-box">
                    <span class="quoted-sender">@${ChatUtils.escapeHTML(msg.replyTo.sender)}</span>
                    <span>${ChatUtils.escapeHTML(msg.replyTo.text)}</span>
                </div>
            `;
        }

        let deleteBtnHTML = '';
        if (isAdmin || isMe) {
            deleteBtnHTML = `<button class="action-btn delete" title="Sil"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>`;
        }

        let editBtnHTML = '';
        if (isMe) {
            editBtnHTML = `<button class="action-btn edit" title="Düzenle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>`;
        }

        const actionsHTML = `
            <div class="message-actions">
                <button class="action-btn react quick-react" data-emoji="👍" title="Beğen">👍</button>
                <button class="action-btn react quick-react" data-emoji="❤️" title="Kalp">❤️</button>
                <button class="action-btn react quick-react" data-emoji="😂" title="Gülme">😂</button>
                <button class="action-btn react quick-react" data-emoji="🔥" title="Alev">🔥</button>
                <button class="action-btn react open-picker-react" title="Emoji Seç">➕</button>
                <button class="action-btn reply" title="Yanıtla">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 17 4 12 9 7"></polyline><path d="M20 18v-2a4 4 0 0 0-4-4H4"></path></svg>
                </button>
                ${editBtnHTML}
                ${deleteBtnHTML}
            </div>
        `;

        const text = msg.text || '';
        const parsedText = ChatUtils.parseMarkdown(text);

        return `
            ${quoteHTML}
            <div class="message-content-wrapper">
                <span class="msg-content">${parsedText}</span>
                ${actionsHTML}
            </div>
            <div class="reactions-container"></div>
        `;
    }

    // Render file message
    function renderFileMessage(msg) {
        const fileInfo = msg.file;
        let fileHTML = '';
        
        if (FileUploadManager) {
            const tempContainer = document.createElement('div');
            FileUploadManager.renderFileAttachment(fileInfo, tempContainer);
            fileHTML = tempContainer.innerHTML;
        } else {
            fileHTML = `
                <div class="file-attachment-container">
                    <div class="file-attachment-header">
                        <span class="file-attachment-icon">📁</span>
                        <div class="file-attachment-info">
                            <div class="file-attachment-name">${ChatUtils.escapeHTML(fileInfo.name)}</div>
                            <div class="file-attachment-size">${ChatUtils.formatFileSize(fileInfo.size)}</div>
                        </div>
                    </div>
                    <button class="file-attachment-download" onclick="window.open('${fileInfo.url}', '_blank')">İndir</button>
                </div>
            `;
        }

        return fileHTML;
    }

    // Render voice message
    function renderVoiceMessage(msg) {
        const voiceInfo = msg.voice;
        let voiceHTML = '';
        
        if (VoiceMessageManager) {
            const tempContainer = document.createElement('div');
            VoiceMessageManager.renderVoiceMessage(voiceInfo, tempContainer);
            voiceHTML = tempContainer.innerHTML;
        } else {
            voiceHTML = `
                <div class="voice-message-container">
                    <button class="voice-message-play" onclick="window.open('${voiceInfo.url}', '_blank')">▶</button>
                    <div class="voice-message-info">
                        <div class="voice-message-duration">${ChatUtils.formatDuration(voiceInfo.duration || 0)}</div>
                        <div class="voice-message-wave">
                            <span></span><span></span><span></span><span></span><span></span>
                        </div>
                    </div>
                </div>
            `;
        }

        return voiceHTML;
    }

    // Render poll message
    function renderPollMessage(msg) {
        const poll = msg.poll;
        let pollHTML = '';
        
        if (PollManager) {
            const tempContainer = document.createElement('div');
            const hasVoted = PollManager.hasUserVoted(poll, AppConfig.AppState.currentUser);
            const myVote = PollManager.getUserVote(poll, AppConfig.AppState.currentUser);
            PollManager.renderPoll(poll, msg.key, tempContainer, hasVoted, myVote);
            pollHTML = tempContainer.innerHTML;
        } else {
            pollHTML = `
                <div class="poll-container">
                    <div class="poll-question">${ChatUtils.escapeHTML(poll.question)}</div>
                    ${poll.options.map((opt, i) => `
                        <div class="poll-result">
                            <div style="flex:1;">${ChatUtils.escapeHTML(opt.text)}</div>
                            <div style="color:var(--fg-sub);">0%</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        return pollHTML;
    }

    // Render game message
    function renderGameMessage(msg) {
        let gameHTML = '';
        
        if (GameManager) {
            const tempContainer = document.createElement('div');
            GameManager.renderGameResult(msg, tempContainer);
            gameHTML = tempContainer.innerHTML;
        } else {
            gameHTML = `
                <div class="game-result">
                    <div class="game-label">Oyun</div>
                    <div class="game-value">${ChatUtils.escapeHTML(msg.text)}</div>
                </div>
            `;
        }

        return gameHTML;
    }

    // Handle message change (edit)
    function handleMessageChange(snapshot) {
        const key = snapshot.key;
        const updatedData = snapshot.val();
        const item = DOM.messagesList.querySelector(`[data-msg-key="${key}"]`);
        
        if (item) {
            item.dataset.rawText = updatedData.text;
            const span = item.querySelector('.msg-content');

            if (span) {
                span.innerHTML = ChatUtils.parseMarkdown(updatedData.text);
                ChatUtils.renderMediaPreviews(span);
            }

            renderReactions(item, updatedData.reactions || {});

            const isMentioned = AppConfig.AppState.currentUser && 
                              updatedData.text && updatedData.text.toLowerCase().includes(`@${AppConfig.AppState.currentUser.toLowerCase()}`);
            if (isMentioned) item.classList.add('is-mentioned');
            else item.classList.remove('is-mentioned');
        }
    }

    // Handle message remove
    function handleMessageRemove(snapshot) {
        const key = snapshot.key;
        const item = DOM.messagesList.querySelector(`[data-msg-key="${key}"]`);
        if (item) {
            const group = item.closest('.message-group');
            item.remove();
            if (group && group.querySelectorAll('.message-item').length === 0) group.remove();
        }
    }

    // Render reactions
    function renderReactions(itemEl, reactionsData) {
        const container = itemEl.querySelector('.reactions-container');
        if (!container) return;
        container.innerHTML = '';

        Object.entries(reactionsData).forEach(([emoji, usersObj]) => {
            if (!usersObj) return;
            const users = Object.keys(usersObj);
            if (users.length === 0) return;

            const hasReacted = AppConfig.AppState.currentUser && users.includes(AppConfig.AppState.currentUser);

            const badge = document.createElement('div');
            badge.className = `reaction-badge${hasReacted ? ' user-reacted' : ''}`;
            badge.title = `${users.join(', ')}`;
            badge.innerHTML = `<span>${emoji}</span><span class="reaction-count">${users.length}</span>`;

            badge.addEventListener('click', () => {
                const key = itemEl.dataset.msgKey;
                toggleReaction(key, emoji);
            });

            container.appendChild(badge);
        });
    }

    // Toggle reaction
    function toggleReaction(msgKey, emoji) {
        if (!AppConfig || !AppConfig.AppState || !AppConfig.AppState.currentUser) return;
        
        const reactRef = ref(AppConfig.FB.database, `messages/${msgKey}/reactions/${emoji}/${AppConfig.AppState.currentUser}`);
        get(reactRef).then((snap) => {
            if (snap.exists()) {
                remove(reactRef);
            } else {
                set(reactRef, true);
            }
        });
    }

    // Initialize online users
    function initOnlineUsers() {
        onlineRef = AppConfig.FB.onlineRef;
        
        onValue(onlineRef, (snapshot) => {
            const data = snapshot.val();
            if (DOM.onlineUsersList) {
                DOM.onlineUsersList.innerHTML = "";
            }
            if (!data) return;

            // Filter blocked users
            const filteredUsers = UserBlockingManager ? 
                UserBlockingManager.filterBlockedUsers(Object.values(data)) : 
                Object.values(data);

            filteredUsers.forEach(u => {
                if (!u || !u.username) return;
                
                // Don't show self in online list
                if (u.username === AppConfig.AppState.currentUser) return;

                const img = document.createElement('img');
                img.className = 'online-user-img';
                img.src = u.avatar || '';
                img.title = u.username;
                img.alt = u.username;
                img.onerror = function() { 
                    this.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(u.username)}`; 
                };
                img.addEventListener('click', () => {
                    DOM.messageInput.value += `@${u.username} `;
                    DOM.messageInput.focus();
                });

                if (DOM.onlineUsersList) {
                    DOM.onlineUsersList.appendChild(img);
                }
            });
        });
    }

    // Initialize typing indicator
    function initTypingIndicator() {
        typingRef = AppConfig.FB.typingRef;

        // Listen for typing events
        DOM.messageInput.addEventListener('input', () => {
            if (!AppConfig.AppState.currentUser) return;
            set(ref(AppConfig.FB.database, `typing/${AppConfig.AppState.currentUser}`), true);
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                remove(ref(AppConfig.FB.database, `typing/${AppConfig.AppState.currentUser}`));
            }, 2000);
        });

        // Listen for other users typing
        onChildAdded(typingRef, (snapshot) => {
            const username = snapshot.key;
            typingUsers.set(username, true);
            updateTypingDisplay();
        });

        onChildRemoved(typingRef, (snapshot) => {
            const username = snapshot.key;
            typingUsers.delete(username);
            updateTypingDisplay();
        });
    }

    // Update typing display
    function updateTypingDisplay() {
        if (!DOM.typingIndicator) return;
        
        const me = (AppConfig.AppState.currentUser || '').toLowerCase();
        const typers = [...typingUsers.keys()].filter(u => u.toLowerCase() !== me);

        if (typers.length === 1) {
            DOM.typingIndicator.innerText = `${typers[0]} yazıyor...`;
        } else if (typers.length > 1) {
            DOM.typingIndicator.innerText = `${typers.join(', ')} yazıyor...`;
        } else {
            DOM.typingIndicator.innerText = "";
        }
    }

    // Initialize GIF search
    function initGifSearch() {
        if (!DOM.gifSearchInput) return;

        let gifDebounceTimer;
        DOM.gifSearchInput.addEventListener('input', (e) => {
            clearTimeout(gifDebounceTimer);
            gifDebounceTimer = setTimeout(() => {
                fetchGifs(e.target.value);
            }, 400);
        });

        DOM.tabEmojiBtn.addEventListener('click', () => {
            DOM.tabEmojiBtn.classList.add('active');
            DOM.tabGifBtn.classList.remove('active');
            DOM.emojiTabContent.classList.add('active');
            DOM.gifTabContent.classList.remove('active');
        });

        DOM.tabGifBtn.addEventListener('click', () => {
            DOM.tabGifBtn.classList.add('active');
            DOM.tabEmojiBtn.classList.remove('active');
            DOM.gifTabContent.classList.add('active');
            DOM.emojiTabContent.classList.remove('active');
            if (DOM.gifGrid.children.length === 0) fetchGifs('');
        });
    }

    // Fetch GIFs from Klipy API
    async function fetchGifs(query = '') {
        if (!DOM.gifGrid) return;

        DOM.gifGrid.innerHTML = '<div style="color:var(--fg-sub); font-size:12px; grid-column:span 2; text-align:center;">Yükleniyor...</div>';

        const trimmedQuery = query.trim();
        const url = trimmedQuery
            ? `https://api.klipy.co/v2/search?api_key=${AppConfig.KLIPY_API_KEY}&q=${encodeURIComponent(trimmedQuery)}&limit=20`
            : `https://api.klipy.co/v2/featured?api_key=${AppConfig.KLIPY_API_KEY}&limit=20`;

        try {
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`API Hatası: ${res.status}`);
            }

            const json = await res.json();
            DOM.gifGrid.innerHTML = '';

            let gifs = [];
            if (Array.isArray(json?.results)) {
                gifs = json.results;
            } else if (Array.isArray(json?.data)) {
                gifs = json.data;
            } else if (Array.isArray(json)) {
                gifs = json;
            }

            if (gifs.length === 0) {
                DOM.gifGrid.innerHTML = '<div style="color:var(--fg-sub); font-size:12px; grid-column:span 2; text-align:center;">Sonuç bulunamadı.</div>';
                return;
            }

            gifs.forEach(gif => {
                const imgUrl = gif?.media_formats?.gif?.url || gif?.url || gif?.images?.downsized?.url || gif?.images?.original?.url || gif?.gif_url;
                if (!imgUrl) return;

                const img = document.createElement('img');
                img.className = 'gif-item';
                img.src = imgUrl;
                img.alt = gif?.title || 'GIF';
                img.addEventListener('click', () => {
                    if (!AppConfig.AppState.currentUser) return;

                    const payload = {
                        sender: AppConfig.AppState.currentUser,
                        avatar: AppConfig.AppState.currentAvatar,
                        text: imgUrl,
                        timestamp: serverTimestamp()
                    };

                    if (activeReplyTarget) payload.replyTo = activeReplyTarget;

                    push(rawMessagesRef, payload);

                    remove(ref(AppConfig.FB.database, `typing/${AppConfig.AppState.currentUser}`));
                    clearTimeout(typingTimeout);

                    activeReplyTarget = null;
                    if (DOM.replyPreviewBar) DOM.replyPreviewBar.style.display = 'none';
                    if (DOM.pickerContainer) DOM.pickerContainer.classList.remove('show');
                });
                DOM.gifGrid.appendChild(img);
            });
        } catch (err) {
            console.error('GIF yükleme hatası:', err);
            if (DOM.gifGrid) {
                DOM.gifGrid.innerHTML = `<div style="color:var(--danger-red); font-size:12px; grid-column:span 2; text-align:center;">GIF yüklenemedi: ${err.message}</div>`;
            }
        }
    }

    // Initialize Google login
    function initGoogleLogin() {
        if (!DOM.googleLoginBtn) return;

        DOM.googleLoginBtn.addEventListener('click', async () => {
            if (DOM.modalError) DOM.modalError.style.display = 'none';
            
            try {
                await signInWithPopup(AppConfig.FB.auth, AppConfig.FB.googleProvider);
            } catch (err) {
                console.error('Google giriş hatası:', err);
                if (DOM.modalError) {
                    DOM.modalError.innerText = 'Google ile giriş yapılamadı: ' + (err.code || err.message);
                    DOM.modalError.style.display = 'block';
                }
            }
        });
    }

    // Initialize profile management
    function initProfileManagement() {
        if (DOM.resetUserBtn) {
            DOM.resetUserBtn.addEventListener('click', () => {
                if (DOM.profileEditError) DOM.profileEditError.style.display = 'none';
                if (DOM.editProfileUsername) DOM.editProfileUsername.value = AppConfig.AppState.currentUser;
                if (DOM.editProfileAvatar) DOM.editProfileAvatar.value = AppConfig.AppState.currentAvatar;
                if (DOM.editProfileModal) DOM.editProfileModal.style.display = 'flex';
            });
        }

        if (DOM.cancelProfileEditBtn) {
            DOM.cancelProfileEditBtn.addEventListener('click', () => {
                if (DOM.editProfileModal) DOM.editProfileModal.style.display = 'none';
            });
        }

        if (DOM.saveProfileEditBtn) {
            DOM.saveProfileEditBtn.addEventListener('click', async () => {
                const newUsername = DOM.editProfileUsername.value.trim();
                const newAvatar = DOM.editProfileAvatar.value.trim();
                if (DOM.profileEditError) DOM.profileEditError.style.display = 'none';

                if (!newUsername) return;

                if (newUsername.toLowerCase() !== AppConfig.AppState.currentUser.toLowerCase()) {
                    try {
                        const onlineSnap = await get(onlineRef);
                        if (onlineSnap.exists()) {
                            const onlineData = onlineSnap.val();
                            const isTaken = Object.values(onlineData).some(u => u.username && u.username.toLowerCase() === newUsername.toLowerCase());
                            if (isTaken) {
                                if (DOM.profileEditError) {
                                    DOM.profileEditError.innerText = 'Bu kullanıcı adı zaten alınmış!';
                                    DOM.profileEditError.style.display = 'block';
                                }
                                return;
                            }
                        }
                    } catch (e) { /* ignore */ }
                }

                const oldUsername = AppConfig.AppState.currentUser;
                AppConfig.AppState.currentUser = newUsername;
                AppConfig.AppState.currentAvatar = newAvatar;

                localStorage.setItem('gh_chat_username', newUsername);
                localStorage.setItem('gh_chat_avatar', newAvatar);

                if (DOM.displayUsername) DOM.displayUsername.innerText = newUsername;
                if (DOM.myAvatar) DOM.myAvatar.src = ChatUtils.getAvatarUrl(newUsername, newAvatar);

                // Update online user reference
                if (myUserRef) {
                    remove(myUserRef);
                }
                myUserRef = ref(AppConfig.FB.database, `online_users/${newUsername}`);
                set(myUserRef, { username: newUsername, avatar: ChatUtils.getAvatarUrl(newUsername, newAvatar) });

                // Update typing reference
                if (oldUsername) {
                    remove(ref(AppConfig.FB.database, `typing/${oldUsername}`));
                }
                myTypingRef = ref(AppConfig.FB.database, `typing/${newUsername}`);

                if (DOM.editProfileModal) DOM.editProfileModal.style.display = 'none';
            });
        }

        if (DOM.logoutBtn) {
            DOM.logoutBtn.addEventListener('click', () => {
                if (myUserRef) remove(myUserRef);
                if (myTypingRef) remove(myTypingRef);
                localStorage.removeItem('gh_chat_username');
                localStorage.removeItem('gh_chat_avatar');
                if (DOM.editProfileModal) DOM.editProfileModal.style.display = 'none';
                signOut(AppConfig.FB.auth).finally(() => location.reload());
            });
        }
    }

    // Initialize chat form
    function initChatForm() {
        if (DOM.chatForm) {
            DOM.chatForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const text = DOM.messageInput.value.trim();
                if (!text || !AppConfig.AppState.currentUser) return;

                const payload = {
                    sender: AppConfig.AppState.currentUser,
                    avatar: AppConfig.AppState.currentAvatar,
                    text: text,
                    timestamp: serverTimestamp()
                };
                if (activeReplyTarget) payload.replyTo = activeReplyTarget;

                push(rawMessagesRef, payload);

                remove(ref(AppConfig.FB.database, `typing/${AppConfig.AppState.currentUser}`));
                clearTimeout(typingTimeout);

                DOM.messageInput.value = "";
                activeReplyTarget = null;
                if (DOM.replyPreviewBar) DOM.replyPreviewBar.style.display = 'none';
                if (DOM.pickerContainer) DOM.pickerContainer.classList.remove('show');
            });

            DOM.messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    DOM.chatForm.dispatchEvent(new Event('submit'));
                }
            });
        }
    }

    // Initialize message actions
    function initMessageActions() {
        if (DOM.messagesList) {
            DOM.messagesList.addEventListener('click', (e) => {
                const deleteBtn = e.target.closest('.action-btn.delete');
                const editBtn = e.target.closest('.action-btn.edit');
                const replyBtn = e.target.closest('.action-btn.reply');
                const quickReactBtn = e.target.closest('.quick-react');
                const openPickerReactBtn = e.target.closest('.open-picker-react');
                const copyBtn = e.target.closest('.code-copy-btn');
                const runCodeBtn = e.target.closest('.run-code-btn');
                const codeBlockCopyBtn = e.target.closest('.code-block-copy-btn');
                const item = e.target.closest('.message-item');

                if (copyBtn) {
                    const codeText = copyBtn.dataset.code;
                    navigator.clipboard.writeText(codeText).then(() => {
                        const originalText = copyBtn.innerText;
                        copyBtn.innerText = 'Kopyalandı!';
                        setTimeout(() => copyBtn.innerText = originalText, 1500);
                    });
                    return;
                }

                if (runCodeBtn) {
                    const targetId = runCodeBtn.dataset.target;
                    const container = document.getElementById(targetId);
                    if (!container) return;

                    const existingFrame = container.querySelector('.html-preview-frame');
                    if (existingFrame) {
                        existingFrame.remove();
                        runCodeBtn.innerText = '▶ Çalıştır';
                        return;
                    }

                    const code = codeBlocksMap.get(targetId) || '';
                    const frame = document.createElement('iframe');
                    frame.className = 'html-preview-frame';
                    frame.setAttribute('sandbox', 'allow-scripts');
                    frame.srcdoc = code;
                    container.appendChild(frame);
                    runCodeBtn.innerText = '✕ Kapat';
                    DOM.messagesList.scrollTop = DOM.messagesList.scrollHeight;
                    return;
                }

                if (codeBlockCopyBtn) {
                    const targetId = codeBlockCopyBtn.dataset.target;
                    const code = codeBlocksMap.get(targetId) || '';
                    navigator.clipboard.writeText(code).then(() => {
                        const originalText = codeBlockCopyBtn.innerText;
                        codeBlockCopyBtn.innerText = 'Kopyalandı!';
                        setTimeout(() => codeBlockCopyBtn.innerText = originalText, 1500);
                    });
                    return;
                }

                if (!item) return;

                const key = item.dataset.msgKey;
                const sender = item.dataset.sender;
                const rawText = item.dataset.rawText;

                if (quickReactBtn) {
                    const emoji = quickReactBtn.dataset.emoji;
                    toggleReaction(key, emoji);
                    return;
                }

                if (openPickerReactBtn) {
                    activeReactionMsgKey = key;
                    DOM.pickerContainer.classList.add('show');
                    DOM.tabEmojiBtn.click();
                    return;
                }

                if (deleteBtn) {
                    if (confirm('Bu mesajı silmek istediğinize emin misiniz?')) {
                        remove(ref(AppConfig.FB.database, `messages/${key}`));
                    }
                }

                if (editBtn) {
                    activeEditKey = key;
                    if (DOM.editMessageInput) DOM.editMessageInput.value = rawText;
                    if (DOM.editModal) DOM.editModal.style.display = 'flex';
                }

                if (replyBtn) {
                    activeReplyTarget = { sender, text: rawText };
                    if (DOM.replyPreviewUser) DOM.replyPreviewUser.innerText = `@${sender}`;
                    if (DOM.replyPreviewText) DOM.replyPreviewText.innerText = `"${rawText}"`;
                    if (DOM.replyPreviewBar) DOM.replyPreviewBar.style.display = 'flex';
                    DOM.messageInput.focus();
                }
            });
        }

        if (DOM.cancelReplyBtn) {
            DOM.cancelReplyBtn.addEventListener('click', () => {
                activeReplyTarget = null;
                if (DOM.replyPreviewBar) DOM.replyPreviewBar.style.display = 'none';
            });
        }

        if (DOM.cancelEditBtn) {
            DOM.cancelEditBtn.addEventListener('click', () => {
                if (DOM.editModal) DOM.editModal.style.display = 'none';
                activeEditKey = null;
            });
        }

        if (DOM.saveEditBtn) {
            DOM.saveEditBtn.addEventListener('click', () => {
                const newText = DOM.editMessageInput.value.trim();
                if (newText && activeEditKey) {
                    update(ref(AppConfig.FB.database, `messages/${activeEditKey}`), { text: newText });
                    if (DOM.editModal) DOM.editModal.style.display = 'none';
                    activeEditKey = null;
                }
            });
        }
    }

    // Initialize emoji picker
    function initEmojiPicker() {
        if (DOM.emojiToggleBtn) {
            DOM.emojiToggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                activeReactionMsgKey = null;
                DOM.pickerContainer.classList.toggle('show');
            });
        }

        if (DOM.emojiPicker) {
            DOM.emojiPicker.addEventListener('emoji-click', event => {
                const chosenEmoji = event.detail.unicode;

                if (activeReactionMsgKey) {
                    toggleReaction(activeReactionMsgKey, chosenEmoji);
                    activeReactionMsgKey = null;
                    DOM.pickerContainer.classList.remove('show');
                } else {
                    DOM.messageInput.value += chosenEmoji;
                    DOM.messageInput.focus();
                }
            });
        }

        // Close picker when clicking outside
        document.addEventListener('click', (e) => {
            if (!DOM.pickerContainer.contains(e.target) && 
                e.target !== DOM.emojiToggleBtn && 
                !e.target.closest('.action-btn.react')) {
                DOM.pickerContainer.classList.remove('show');
                activeReactionMsgKey = null;
            }
        });
    }

    // Initialize auth state listener
    function initAuthStateListener() {
        onAuthStateChanged(AppConfig.FB.auth, async (user) => {
            if (user) {
                AppConfig.AppState.loggedInViaGoogle = true;
                AppConfig.AppState.currentUserEmail = (user.email || '').toLowerCase();

                const savedUsername = localStorage.getItem('gh_chat_username');
                const savedAvatar = localStorage.getItem('gh_chat_avatar');

                if (savedUsername) {
                    AppConfig.AppState.currentUser = savedUsername;
                    AppConfig.AppState.currentAvatar = savedAvatar || user.photoURL || '';
                } else {
                    let username = (user.displayName || user.email || 'Kullanıcı').trim();

                    try {
                        const onlineSnap = await get(AppConfig.FB.onlineRef);
                        if (onlineSnap.exists()) {
                            const onlineData = onlineSnap.val();
                            const isTaken = Object.values(onlineData).some(u => u.username && u.username.toLowerCase() === username.toLowerCase());
                            if (isTaken) {
                                username = `${username} (${Math.floor(Math.random() * 900 + 100)})`;
                            }
                        }
                    } catch (e) { /* ignore */ }

                    AppConfig.AppState.currentUser = username;
                    AppConfig.AppState.currentAvatar = user.photoURL || '';
                    localStorage.setItem('gh_chat_username', username);
                    localStorage.setItem('gh_chat_avatar', AppConfig.AppState.currentAvatar);
                }

                initUserSession();
            } else {
                AppConfig.AppState.loggedInViaGoogle = false;
                AppConfig.AppState.currentUser = '';
                AppConfig.AppState.currentAvatar = '';
                AppConfig.AppState.currentUserEmail = '';
                if (DOM.userModal) DOM.userModal.style.display = 'flex';
            }
        });
    }

    // Main initialization
    function init() {
        // Initialize Firebase
        initFirebase();

        // Wait for Firebase to be ready
        const firebaseReady = setInterval(() => {
            if (AppConfig && AppConfig.FB && AppConfig.FB.database) {
                clearInterval(firebaseReady);
                
                // Initialize everything
                initAuthStateListener();
                initGoogleLogin();
                initProfileManagement();
                initChatForm();
                initMessageActions();
                initEmojiPicker();
                initGifSearch();
                initOnlineUsers();
                initTypingIndicator();
                initMessageListeners();
                
                // Update references after Firebase is ready
                updateFirebaseReferences();
            }
        }, 100);
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

    // Start the application
    domReady().then(() => {
        init();
    });

    // Export for other modules
    ChatManager = {
        initMessageListeners,
        handleNewMessage,
        addMessageToGroup,
        renderTextMessage,
        renderFileMessage,
        renderVoiceMessage,
        renderPollMessage,
        renderGameMessage,
        handleMessageChange,
        handleMessageRemove,
        toggleReaction,
        renderReactions
    };

    // Make functions globally available for inline handlers
    toggleReaction = toggleReaction;
    codeBlocksMap = codeBlocksMap;
})();
