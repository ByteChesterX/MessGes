// Voice Messages Module

(function() {
    'use strict';

    let mediaRecorder = null;
    let audioChunks = [];
    let recordingStartTime = null;
    let recordingInterval = null;
    let isRecording = false;
    let audioBlob = null;

    // Initialize
    function initVoiceMessages() {
        const voiceMessageBtn = document.getElementById('voiceMessageBtn');
        const voiceModal = document.getElementById('voiceMessageModal');
        const startRecordingBtn = document.getElementById('startRecordingBtn');
        const sendVoiceBtn = document.getElementById('sendVoiceBtn');
        const cancelVoiceBtn = document.getElementById('cancelVoiceBtn');
        const closeVoiceBtn = document.getElementById('closeVoiceBtn');

        if (voiceMessageBtn) {
            voiceMessageBtn.addEventListener('click', () => {
                // Check if MediaRecorder is supported
                if (!window.MediaRecorder) {
                    alert('Ses kaydı desteklenmiyor. Lütfen modern bir tarayıcı kullanın.');
                    return;
                }
                voiceModal.style.display = 'flex';
                resetRecorder();
            });
        }

        if (startRecordingBtn) {
            startRecordingBtn.addEventListener('click', toggleRecording);
        }

        if (sendVoiceBtn) {
            sendVoiceBtn.addEventListener('click', sendVoiceMessage);
        }

        if (cancelVoiceBtn) {
            cancelVoiceBtn.addEventListener('click', () => {
                stopRecording();
                voiceModal.style.display = 'none';
            });
        }

        if (closeVoiceBtn) {
            closeVoiceBtn.addEventListener('click', () => {
                stopRecording();
                voiceModal.style.display = 'none';
            });
        }

        // Close modal when clicking outside
        voiceModal.addEventListener('click', (e) => {
            if (e.target === voiceModal) {
                stopRecording();
                voiceModal.style.display = 'none';
            }
        });
    }

    // Toggle recording
    async function toggleRecording() {
        if (isRecording) {
            await stopRecording();
        } else {
            await startRecording();
        }
    }

    // Start recording
    async function startRecording() {
        if (isRecording) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = () => {
                audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                updatePlayback();
            };

            mediaRecorder.start(100); // Collect data every 100ms
            isRecording = true;
            recordingStartTime = Date.now();

            // Update timer
            updateTimer();
            recordingInterval = setInterval(updateTimer, 1000);

            // Update UI
            const startBtn = document.getElementById('startRecordingBtn');
            const sendBtn = document.getElementById('sendVoiceBtn');
            const statusEl = document.getElementById('recordingStatus');

            if (startBtn) {
                startBtn.textContent = '⏹ Kaydı Durdur';
                startBtn.style.background = 'var(--danger-red)';
            }
            if (sendBtn) sendBtn.disabled = true;
            if (statusEl) {
                statusEl.textContent = 'Kaydediliyor...';
                statusEl.style.color = 'var(--danger-red)';
            }

        } catch (error) {
            console.error('Error starting recording:', error);
            const statusEl = document.getElementById('recordingStatus');
            if (statusEl) {
                statusEl.textContent = 'Mikrofona erişim izni gerekli';
                statusEl.style.color = 'var(--danger-red)';
            }
        }
    }

    // Stop recording
    async function stopRecording() {
        if (!isRecording) return;

        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }

        // Stop all tracks
        if (mediaRecorder && mediaRecorder.stream) {
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }

        isRecording = false;
        clearInterval(recordingInterval);

        // Update UI
        const startBtn = document.getElementById('startRecordingBtn');
        const sendBtn = document.getElementById('sendVoiceBtn');
        const statusEl = document.getElementById('recordingStatus');

        if (startBtn) {
            startBtn.textContent = '🎤 Kayda Başla';
            startBtn.style.background = 'var(--accent-yellow)';
        }
        if (sendBtn) sendBtn.disabled = !audioBlob;
        if (statusEl) {
            statusEl.textContent = audioBlob ? 'Kayıt tamamlandı' : 'Hazır';
            statusEl.style.color = audioBlob ? 'var(--accent-green)' : 'var(--fg-sub)';
        }
    }

    // Update timer display
    function updateTimer() {
        if (!recordingStartTime) return;

        const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
        const timerEl = document.getElementById('recordingTimer');
        if (timerEl) {
            timerEl.textContent = ChatUtils.formatDuration(elapsed);
        }
    }

    // Update playback UI
    function updatePlayback() {
        const playbackEl = document.getElementById('audioPlayback');
        if (!playbackEl || !audioBlob) return;

        playbackEl.innerHTML = '';

        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = document.createElement('audio');
        audio.src = audioUrl;
        audio.controls = true;
        audio.style.width = '100%';
        audio.style.marginTop = '10px';

        playbackEl.appendChild(audio);

        // Update send button
        const sendBtn = document.getElementById('sendVoiceBtn');
        if (sendBtn) sendBtn.disabled = false;
    }

    // Reset recorder
    function resetRecorder() {
        stopRecording();
        audioChunks = [];
        audioBlob = null;
        recordingStartTime = null;

        const timerEl = document.getElementById('recordingTimer');
        const statusEl = document.getElementById('recordingStatus');
        const playbackEl = document.getElementById('audioPlayback');

        if (timerEl) timerEl.textContent = '00:00';
        if (statusEl) {
            statusEl.textContent = 'Hazır';
            statusEl.style.color = 'var(--fg-sub)';
        }
        if (playbackEl) playbackEl.innerHTML = '';
    }

    // Send voice message
    async function sendVoiceMessage() {
        if (!audioBlob) return;

        const startBtn = document.getElementById('startRecordingBtn');
        const sendBtn = document.getElementById('sendVoiceBtn');
        const modal = document.getElementById('voiceMessageModal');

        if (startBtn) startBtn.disabled = true;
        if (sendBtn) sendBtn.disabled = true;
        if (sendBtn) sendBtn.textContent = 'Gönderiliyor...';

        try {
            // Upload to Firebase Storage
            const storageRef = AppConfig.FB.storage.ref();
            const timestamp = Date.now();
            const username = AppConfig.AppState.currentUser || 'unknown';
            const filePath = `voice_messages/${AppConfig.AppState.currentRoom || 'general'}/${username}_${timestamp}.wav`;

            const uploadRef = storageRef.child(filePath);
            await uploadRef.put(audioBlob, { contentType: 'audio/wav' });

            const downloadURL = await uploadRef.getDownloadURL();

            // Calculate duration
            const duration = Math.floor((Date.now() - recordingStartTime) / 1000);

            // Send message
            const payload = {
                sender: AppConfig.AppState.currentUser,
                avatar: AppConfig.AppState.currentAvatar,
                timestamp: AppConfig.FB.serverTimestamp(),
                voice: {
                    url: downloadURL,
                    duration: duration
                },
                type: 'voice'
            };

            // Add reply target if exists
            if (window.activeReplyTarget) {
                payload.replyTo = window.activeReplyTarget;
            }

            await AppConfig.FB.rawMessagesRef.push(payload);

            // Clear reply target
            if (window.activeReplyTarget) {
                window.activeReplyTarget = null;
                const replyPreviewBar = document.getElementById('replyPreviewBar');
                if (replyPreviewBar) {
                    replyPreviewBar.style.display = 'none';
                }
            }

            // Cleanup
            resetRecorder();
            if (modal) modal.style.display = 'none';
            URL.revokeObjectURL(audioUrl);

        } catch (error) {
            console.error('Error sending voice message:', error);
            const statusEl = document.getElementById('recordingStatus');
            if (statusEl) {
                statusEl.textContent = 'Gönderme hatası';
                statusEl.style.color = 'var(--danger-red)';
            }
            if (sendBtn) sendBtn.textContent = 'Gönder';
            if (sendBtn) sendBtn.disabled = false;
            if (startBtn) startBtn.disabled = false;
        }
    }

    // Render voice message in chat
    function renderVoiceMessage(voiceInfo, container) {
        if (!voiceInfo || !container) return;

        const voiceContainer = document.createElement('div');
        voiceContainer.className = 'voice-message-container';

        const duration = ChatUtils.formatDuration(voiceInfo.duration || 0);
        const icon = voiceInfo.isPlaying ? '⏸' : '▶';

        voiceContainer.innerHTML = `
            <button class="voice-message-play" data-url="${voiceInfo.url}">
                ${icon}
            </button>
            <div class="voice-message-info">
                <div class="voice-message-duration">${duration}</div>
                <div class="voice-message-wave">
                    <span></span><span></span><span></span><span></span><span></span>
                </div>
            </div>
        `;

        container.appendChild(voiceContainer);

        // Add play/pause handler
        const playBtn = voiceContainer.querySelector('.voice-message-play');
        let audio = null;
        let isPlaying = false;

        playBtn.addEventListener('click', () => {
            if (isPlaying) {
                // Pause
                if (audio) audio.pause();
                playBtn.innerHTML = '▶';
                voiceContainer.querySelector('.voice-message-wave').classList.add('paused');
            } else {
                // Play
                if (!audio) {
                    audio = new Audio(voiceInfo.url);
                    audio.addEventListener('ended', () => {
                        playBtn.innerHTML = '▶';
                        voiceContainer.querySelector('.voice-message-wave').classList.add('paused');
                        isPlaying = false;
                    });
                }
                audio.play();
                playBtn.innerHTML = '⏸';
                voiceContainer.querySelector('.voice-message-wave').classList.remove('paused');
            }
            isPlaying = !isPlaying;
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
        initVoiceMessages();
    });

    // Export
    window.VoiceMessageManager = {
        initVoiceMessages,
        startRecording,
        stopRecording,
        toggleRecording,
        sendVoiceMessage,
        renderVoiceMessage,
        resetRecorder
    };
})();
