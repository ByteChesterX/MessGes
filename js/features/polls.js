// Polls Module

(function() {
    'use strict';

    let activePoll = null;

    // Initialize polls
    function initPolls() {
        const pollBtn = document.getElementById('pollBtn');
        const pollModal = document.getElementById('pollModal');
        const createPollBtn = document.getElementById('createPollBtn');
        const cancelPollBtn = document.getElementById('cancelPollBtn');
        const addPollOptionBtn = document.getElementById('addPollOptionBtn');
        const pollOptionsContainer = document.getElementById('pollOptionsContainer');

        if (pollBtn) {
            pollBtn.addEventListener('click', () => {
                if (!AppConfig || !AppConfig.AppState || !AppConfig.AppState.currentUser) {
                    alert('Lütfen önce giriş yapın.');
                    return;
                }
                pollModal.style.display = 'flex';
                resetPollForm();
            });
        }

        if (createPollBtn) {
            createPollBtn.addEventListener('click', createPoll);
        }

        if (cancelPollBtn) {
            cancelPollBtn.addEventListener('click', () => {
                pollModal.style.display = 'none';
            });
        }

        if (addPollOptionBtn) {
            addPollOptionBtn.addEventListener('click', addPollOption);
        }

        // Close modal when clicking outside
        pollModal.addEventListener('click', (e) => {
            if (e.target === pollModal) {
                pollModal.style.display = 'none';
            }
        });

        // Remove option buttons
        if (pollOptionsContainer) {
            pollOptionsContainer.addEventListener('click', (e) => {
                const removeBtn = e.target.closest('.btn-remove-option');
                if (removeBtn && pollOptionsContainer.children.length > 2) {
                    removeBtn.parentElement.remove();
                }
            });
        }
    }

    // Reset poll form
    function resetPollForm() {
        const questionInput = document.getElementById('pollQuestionInput');
        const optionsContainer = document.getElementById('pollOptionsContainer');

        if (questionInput) questionInput.value = '';
        if (optionsContainer) {
            optionsContainer.innerHTML = `
                <div class="poll-option-input">
                    <input type="text" class="profile-edit-input" placeholder="Seçenek 1" />
                    <button type="button" class="btn-remove-option">✕</button>
                </div>
                <div class="poll-option-input">
                    <input type="text" class="profile-edit-input" placeholder="Seçenek 2" />
                    <button type="button" class="btn-remove-option">✕</button>
                </div>
            `;
        }
    }

    // Add poll option
    function addPollOption() {
        const optionsContainer = document.getElementById('pollOptionsContainer');
        if (!optionsContainer) return;

        const optionCount = optionsContainer.children.length + 1;
        const optionDiv = document.createElement('div');
        optionDiv.className = 'poll-option-input';
        optionDiv.innerHTML = `
            <input type="text" class="profile-edit-input" placeholder="Seçenek ${optionCount}" />
            <button type="button" class="btn-remove-option">✕</button>
        `;
        optionsContainer.appendChild(optionDiv);

        // Add event listener to new remove button
        const removeBtn = optionDiv.querySelector('.btn-remove-option');
        if (removeBtn && optionsContainer.children.length > 2) {
            removeBtn.addEventListener('click', () => {
                if (optionsContainer.children.length > 2) {
                    optionDiv.remove();
                }
            });
        }
    }

    // Create a new poll
    function createPoll() {
        const questionInput = document.getElementById('pollQuestionInput');
        const optionsContainer = document.getElementById('pollOptionsContainer');
        const pollModal = document.getElementById('pollModal');

        const question = questionInput ? questionInput.value.trim() : '';
        if (!question) {
            alert('Lütfen bir soru girin.');
            return;
        }

        const options = [];
        if (optionsContainer) {
            optionsContainer.querySelectorAll('.poll-option-input input').forEach(input => {
                const option = input.value.trim();
                if (option) options.push(option);
            });
        }

        if (options.length < 2) {
            alert('Lütfen en az 2 seçenek ekleyin.');
            return;
        }

        const poll = {
            question: question,
            options: options.map(opt => ({ text: opt, votes: [] })),
            createdBy: AppConfig.AppState.currentUser,
            createdAt: Date.now(),
            totalVotes: 0,
            votedUsers: []
        };

        // Send poll as message
        const payload = {
            sender: AppConfig.AppState.currentUser,
            avatar: AppConfig.AppState.currentAvatar,
            timestamp: AppConfig.FB.serverTimestamp(),
            poll: poll,
            type: 'poll'
        };

        AppConfig.FB.rawMessagesRef.push(payload);

        // Close modal
        if (pollModal) pollModal.style.display = 'none';
    }

    // Vote on a poll
    function voteOnPoll(msgKey, optionIndex) {
        if (!AppConfig || !AppConfig.AppState || !AppConfig.AppState.currentUser) {
            return;
        }

        const userId = AppConfig.AppState.currentUser;
        const pollRef = AppConfig.FB.database.ref(`messages/${msgKey}/poll`);

        // Check if user already voted
        pollRef.once('value', (snapshot) => {
            const poll = snapshot.val();
            if (!poll) return;

            if (poll.votedUsers && poll.votedUsers.includes(userId)) {
                alert('Bu anket için zaten oy verdiniz.');
                return;
            }

            // Update vote
            const updates = {};
            updates[`messages/${msgKey}/poll/options/${optionIndex}/votes/${userId}`] = true;
            updates[`messages/${msgKey}/poll/totalVotes`] = (poll.totalVotes || 0) + 1;
            updates[`messages/${msgKey}/poll/votedUsers/${userId}`] = true;

            AppConfig.FB.database.ref().update(updates);
        });
    }

    // Render poll in message
    function renderPoll(poll, msgKey, container, hasVoted = false, myVote = null) {
        if (!poll || !container) return;

        const pollContainer = document.createElement('div');
        pollContainer.className = 'poll-container';

        const question = ChatUtils.escapeHTML(poll.question);
        const totalVotes = poll.totalVotes || 0;

        let optionsHTML = '';
        poll.options.forEach((option, index) => {
            const optionText = ChatUtils.escapeHTML(option.text);
            const voteCount = option.votes ? Object.keys(option.votes).length : 0;
            const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
            const isMyVote = myVote === index;

            if (hasVoted) {
                // Show results
                optionsHTML += `
                    <div class="poll-result">
                        <div style="flex:1; min-width:0;">${optionText}</div>
                        <div class="poll-bar-container">
                            <div class="poll-bar" style="width:${percentage}%;"></div>
                        </div>
                        <div class="poll-percentage">${percentage}%</div>
                    </div>
                `;
            } else {
                // Show voting options
                optionsHTML += `
                    <label class="poll-option">
                        <input type="radio" name="poll_${msgKey}" value="${index}" 
                               ${isMyVote ? 'checked disabled' : ''}>
                        <span>${optionText}</span>
                    </label>
                `;
            }
        });

        pollContainer.innerHTML = `
            <div class="poll-question">${question}</div>
            <form class="poll-form" data-msg-key="${msgKey}">
                ${optionsHTML}
            </form>
            ${totalVotes > 0 ? `<div style="font-size:12px; color:var(--fg-sub); margin-top:8px;">${totalVotes} oy</div>` : ''}
        `;

        container.appendChild(pollContainer);

        // Add vote handler if not already voted
        if (!hasVoted && !myVote) {
            const form = pollContainer.querySelector('.poll-form');
            if (form) {
                form.addEventListener('change', (e) => {
                    const selectedIndex = parseInt(e.target.value);
                    voteOnPoll(msgKey, selectedIndex);
                });
            }
        }
    }

    // Check if user has voted on a poll
    function hasUserVoted(poll, userId) {
        if (!poll || !poll.votedUsers) return false;
        return poll.votedUsers.includes(userId);
    }

    // Get user's vote on a poll
    function getUserVote(poll, userId) {
        if (!poll || !poll.options) return null;
        
        for (let i = 0; i < poll.options.length; i++) {
            if (poll.options[i].votes && poll.options[i].votes[userId]) {
                return i;
            }
        }
        return null;
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
        initPolls();
    });

    // Export
    window.PollManager = {
        initPolls,
        createPoll,
        voteOnPoll,
        renderPoll,
        hasUserVoted,
        getUserVote
    };
})();
