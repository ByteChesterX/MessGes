// Search Module

(function() {
    'use strict';

    let allMessages = [];
    let searchIndex = [];

    // Index messages for search
    function indexMessages() {
        if (!AppConfig || !AppConfig.FB || !AppConfig.FB.rawMessagesRef) {
            return;
        }

        // Get all messages from Firebase
        AppConfig.FB.rawMessagesRef.once('value', (snapshot) => {
            allMessages = [];
            searchIndex = [];
            
            snapshot.forEach((childSnapshot) => {
                const msg = { key: childSnapshot.key, ...childSnapshot.val() };
                allMessages.push(msg);
                
                // Index message
                if (msg.text) {
                    const words = msg.text.toLowerCase().split(/\s+/);
                    words.forEach(word => {
                        if (word.length > 2) { // Only index words longer than 2 chars
                            if (!searchIndex[word]) {
                                searchIndex[word] = [];
                            }
                            searchIndex[word].push(msg);
                        }
                    });
                }
            });
        });
    }

    // Search messages
    function searchMessages(query) {
        if (!query || query.trim() === '') {
            return [];
        }

        const q = query.toLowerCase().trim();
        const results = [];
        
        // Search in index
        const words = q.split(/\s+/);
        words.forEach(word => {
            if (searchIndex[word]) {
                searchIndex[word].forEach(msg => {
                    if (!results.find(m => m.key === msg.key)) {
                        results.push(msg);
                    }
                });
            }
        });

        // Also search directly in messages
        allMessages.forEach(msg => {
            if (msg.text && msg.text.toLowerCase().includes(q)) {
                if (!results.find(m => m.key === msg.key)) {
                    results.push(msg);
                }
            }
        });

        return results;
    }

    // Display search results
    function displaySearchResults(results, query) {
        const resultsContainer = document.getElementById('searchResults');
        if (!resultsContainer) return;

        resultsContainer.innerHTML = '';
        
        if (results.length === 0) {
            resultsContainer.innerHTML = '<div style="color:var(--fg-sub); text-align:center; padding:10px;">Sonuç bulunamadı</div>';
            return;
        }

        results.forEach(msg => {
            const resultEl = document.createElement('div');
            resultEl.className = 'search-result-item';
            resultEl.style.padding = '8px';
            resultEl.style.borderBottom = '1px solid var(--border-color)';
            resultEl.style.cursor = 'pointer';
            
            const sender = ChatUtils.escapeHTML(msg.sender || 'Bilinmeyen');
            const text = ChatUtils.escapeHTML(msg.text || '');
            const time = ChatUtils.formatTime(msg.timestamp);

            // Highlight search terms
            const highlightedText = highlightText(text, query);

            resultEl.innerHTML = `
                <div style="font-size:12px; color:var(--fg-sub); margin-bottom:4px;">
                    <strong style="color:var(--accent-pink);">${sender}</strong> - ${time}
                </div>
                <div style="font-size:14px; color:var(--fg-text);">${highlightedText}</div>
            `;

            resultEl.addEventListener('click', () => {
                // Scroll to message
                const msgEl = document.querySelector(`[data-msg-key="${msg.key}"]`);
                if (msgEl) {
                    msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    msgEl.style.backgroundColor = 'var(--hover-bg)';
                    setTimeout(() => {
                        msgEl.style.backgroundColor = '';
                    }, 2000);
                }
                
                // Close search modal
                document.getElementById('searchModal').style.display = 'none';
            });

            resultsContainer.appendChild(resultEl);
        });
    }

    // Highlight search terms in text
    function highlightText(text, query) {
        if (!query) return text;
        
        const q = query.toLowerCase().trim();
        const words = q.split(/\s+/);
        
        let result = text;
        words.forEach(word => {
            if (word.length > 2) {
                const regex = new RegExp(`(${ChatUtils.escapeHTML(word)})`, 'gi');
                result = result.replace(regex, '<mark style="background:var(--accent-yellow); color:var(--bg-dark); padding:0 2px; border-radius:2px;">$1</mark>');
            }
        });
        
        return result;
    }

    // Initialize search
    function initSearch() {
        // Load messages
        indexMessages();

        // Setup search input
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');
        const closeSearchBtn = document.getElementById('closeSearchBtn');
        const searchModal = document.getElementById('searchModal');

        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                searchModal.style.display = 'flex';
                searchInput.focus();
                searchInput.value = '';
                document.getElementById('searchResults').innerHTML = '';
            });
        }

        if (closeSearchBtn) {
            closeSearchBtn.addEventListener('click', () => {
                searchModal.style.display = 'none';
            });
        }

        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    const query = e.target.value;
                    const results = searchMessages(query);
                    displaySearchResults(results, query);
                }, 300);
            });

            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    searchModal.style.display = 'none';
                }
            });
        }

        // Close modal when clicking outside
        searchModal.addEventListener('click', (e) => {
            if (e.target === searchModal) {
                searchModal.style.display = 'none';
            }
        });
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
        initSearch();
    });

    // Export
    window.SearchManager = {
        indexMessages,
        searchMessages,
        displaySearchResults,
        highlightText,
        initSearch
    };
})();
