// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDRiCdkBRsKMeUpCmznQ3Sn8R6SvBk0C9U",
    authDomain: "messges-87869.firebaseapp.com",
    databaseURL: "https://messges-87869-default-rtdb.firebaseio.com",
    projectId: "messges-87869",
    storageBucket: "messges-87869.appspot.com",
    messagingSenderId: "102076170891",
    appId: "1:102076170891:web:8786547acdbcdfb1468a8e"
};

// API Keys
const KLIPY_API_KEY = "JorLIwnYyHhkMdcej1Ok9ZSUU04JWlgwYqkb6YKXadVH0fncyC1PhDlK9G5zFFQU";

// Admin Configuration
const ADMIN_EMAILS = ['seninadresin@gmail.com'];

// App State
const AppState = {
    currentUser: localStorage.getItem('gh_chat_username') || "",
    currentAvatar: localStorage.getItem('gh_chat_avatar') || "",
    currentUserEmail: "",
    loggedInViaGoogle: false,
    currentRoom: localStorage.getItem('current_room') || 'general',
    blockedUsers: JSON.parse(localStorage.getItem('blocked_users') || '[]'),
    theme: localStorage.getItem('app_theme') || 'dark',
    notificationsEnabled: localStorage.getItem('notifications_enabled') !== 'false',
    lastRead: {}
};

// DOM Elements - Will be initialized in main.js
const DOM = {};

// Firebase References - Will be initialized in main.js
const FB = {
    app: null,
    database: null,
    auth: null,
    storage: null,
    googleProvider: null,
    messagesRef: null,
    rawMessagesRef: null,
    onlineRef: null,
    typingRef: null,
    roomsRef: null,
    readReceiptsRef: null
};

// Feature Flags
const Features = {
    ENABLE_ROOMS: true,
    ENABLE_FILE_UPLOAD: true,
    ENABLE_VOICE_MESSAGES: true,
    ENABLE_POLLS: true,
    ENABLE_GAMES: true,
    ENABLE_SEARCH: true,
    ENABLE_THEME_TOGGLE: true,
    ENABLE_READ_RECEIPTS: true,
    ENABLE_USER_BLOCKING: true,
    ENABLE_NOTIFICATIONS: true
};

// Export for use in other modules
AppConfig = {
    firebaseConfig,
    KLIPY_API_KEY,
    ADMIN_EMAILS,
    AppState,
    DOM,
    FB,
    Features
};
