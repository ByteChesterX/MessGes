// File Upload Module

(function() {
    'use strict';

    let uploadInProgress = false;
    let selectedFile = null;

    // Initialize Firebase Storage reference
    function getStorageRef() {
        if (window.AppConfig && window.AppConfig.FB && window.AppConfig.FB.storage) {
            return window.AppConfig.FB.storage.ref();
        }
        return null;
    }

    // Handle file selection
    function handleFileSelect(fileInput) {
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            return null;
        }

        const file = fileInput.files[0];
        
        // Validate file
        if (!isValidFile(file)) {
            showStatus('Geçersiz dosya türü. PDF, ZIP, DOCX, TXT, JPG, PNG, GIF, MP4 izlenir.', true);
            return null;
        }

        // Check file size (limit to 50MB)
        if (file.size > 50 * 1024 * 1024) {
            showStatus('Dosya boyutu 50MB sınırını aşıyor.', true);
            return null;
        }

        selectedFile = file;
        showStatus(`Dosya seçildi: ${file.name} (${window.ChatUtils.formatFileSize(file.size)})`);
        return file;
    }

    // Check if file type is allowed
    function isValidFile(file) {
        const allowedTypes = [
            'application/pdf',
            'application/zip',
            'application/x-zip-compressed',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
            'text/markdown',
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'video/mp4',
            'video/webm',
            'audio/mpeg',
            'audio/wav',
            'audio/ogg'
        ];

        const allowedExtensions = [
            'pdf', 'zip', 'rar', '7z', 'doc', 'docx', 'txt', 'md',
            'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg',
            'mp4', 'webm', 'mov', 'avi',
            'mp3', 'wav', 'ogg', 'm4a'
        ];

        // Check MIME type
        if (allowedTypes.includes(file.type)) {
            return true;
        }

        // Check extension
        const extension = file.name.split('.').pop().toLowerCase();
        return allowedExtensions.includes(extension);
    }

    // Get file icon based on type
    function getFileIcon(file) {
        const icons = {
            pdf: '📄',
            zip: '🗄️',
            rar: '🗄️',
            '7z': '🗄️',
            doc: '📝',
            docx: '📝',
            txt: '📃',
            md: '📝',
            jpg: '🖼️',
            jpeg: '🖼️',
            png: '🖼️',
            gif: '🎬',
            webp: '🖼️',
            svg: '🖼️',
            mp4: '🎥',
            webm: '🎥',
            mov: '🎥',
            avi: '🎥',
            mp3: '🎵',
            wav: '🎵',
            ogg: '🎵',
            m4a: '🎵'
        };

        const extension = file.name.split('.').pop().toLowerCase();
        return icons[extension] || '📁';
    }

    // Upload file to Firebase Storage
    async function uploadFile(file) {
        if (uploadInProgress) {
            showStatus('Yükleme devam ediyor...', true);
            return null;
        }

        uploadInProgress = true;
        showStatus('Yükleniyor...');

        try {
            const storageRef = getStorageRef();
            if (!storageRef) {
                throw new Error('Firebase Storage not initialized');
            }

            // Create unique filename
            const timestamp = Date.now();
            const username = window.AppConfig.AppState.currentUser || 'unknown';
            const sanitizedName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
            const filePath = `uploads/${window.AppConfig.AppState.currentRoom || 'general'}/${username}_${timestamp}_${sanitizedName}`;

            // Upload file
            const uploadRef = storageRef.child(filePath);
            const snapshot = await uploadRef.put(file);

            // Get download URL
            const downloadURL = await snapshot.ref.getDownloadURL();

            uploadInProgress = false;
            showStatus('Yükleme tamamlandı!');

            return {
                url: downloadURL,
                name: file.name,
                size: file.size,
                type: file.type,
                icon: getFileIcon(file)
            };
        } catch (error) {
            uploadInProgress = false;
            console.error('File upload error:', error);
            showStatus(`Yükleme hatası: ${error.message}`, true);
            return null;
        }
    }

    // Show status message
    function showStatus(message, isError = false) {
        const statusEl = document.getElementById('fileUploadStatus');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.style.color = isError ? 'var(--danger-red)' : 'var(--fg-sub)';
        }
    }

    // Send file message
    async function sendFileMessage(fileInfo) {
        if (!fileInfo || !window.AppConfig || !window.AppConfig.FB) {
            return;
        }

        const payload = {
            sender: window.AppConfig.AppState.currentUser,
            avatar: window.AppConfig.AppState.currentAvatar,
            timestamp: window.AppConfig.FB.serverTimestamp(),
            file: fileInfo,
            type: 'file'
        };

        // Add reply target if exists
        if (window.activeReplyTarget) {
            payload.replyTo = window.activeReplyTarget;
        }

        // Send to Firebase
        await window.AppConfig.FB.rawMessagesRef.push(payload);

        // Clear reply target
        if (window.activeReplyTarget) {
            window.activeReplyTarget = null;
            const replyPreviewBar = document.getElementById('replyPreviewBar');
            if (replyPreviewBar) {
                replyPreviewBar.style.display = 'none';
            }
        }

        // Close modal
        const modal = document.getElementById('fileUploadModal');
        if (modal) {
            modal.style.display = 'none';
        }

        // Reset file input
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.value = '';
        }
        selectedFile = null;
        showStatus('Dosya seçin');
    }

    // Render file attachment in message
    function renderFileAttachment(fileInfo, container) {
        if (!fileInfo || !container) return;

        const fileContainer = document.createElement('div');
        fileContainer.className = 'file-attachment-container';

        const icon = fileInfo.icon || '📁';
        const name = window.ChatUtils.escapeHTML(fileInfo.name);
        const size = window.ChatUtils.formatFileSize(fileInfo.size);

        fileContainer.innerHTML = `
            <div class="file-attachment-header">
                <span class="file-attachment-icon">${icon}</span>
                <div class="file-attachment-info">
                    <div class="file-attachment-name">${name}</div>
                    <div class="file-attachment-size">${size}</div>
                </div>
            </div>
            <button class="file-attachment-download">İndir</button>
        `;

        container.appendChild(fileContainer);

        // Add download click handler
        const downloadBtn = fileContainer.querySelector('.file-attachment-download');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                window.open(fileInfo.url, '_blank');
            });
        }
    }

    // Initialize file upload
    function initFileUpload() {
        const fileInput = document.getElementById('fileInput');
        const uploadBtn = document.getElementById('uploadFileBtn');
        const cancelBtn = document.getElementById('cancelFileUploadBtn');
        const fileUploadBtn = document.getElementById('fileUploadBtn');
        const modal = document.getElementById('fileUploadModal');

        if (fileInput) {
            fileInput.addEventListener('change', () => {
                const file = handleFileSelect(fileInput);
                const uploadBtnEl = document.getElementById('uploadFileBtn');
                if (uploadBtnEl) {
                    uploadBtnEl.disabled = !file;
                }
            });
        }

        if (uploadBtn) {
            uploadBtn.addEventListener('click', async () => {
                if (!selectedFile || uploadInProgress) return;

                uploadBtn.disabled = true;
                showStatus('Yükleniyor...');

                const fileInfo = await uploadFile(selectedFile);
                if (fileInfo) {
                    await sendFileMessage(fileInfo);
                }

                uploadBtn.disabled = false;
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                if (modal) modal.style.display = 'none';
                if (fileInput) fileInput.value = '';
                selectedFile = null;
                showStatus('Dosya seçin');
            });
        }

        if (fileUploadBtn) {
            fileUploadBtn.addEventListener('click', () => {
                if (modal) modal.style.display = 'flex';
            });
        }

        // Close modal when clicking outside
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
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

    // Start
    domReady().then(() => {
        initFileUpload();
    });

    // Export
    window.FileUploadManager = {
        handleFileSelect,
        isValidFile,
        uploadFile,
        sendFileMessage,
        renderFileAttachment,
        getFileIcon,
        initFileUpload
    };
})();
