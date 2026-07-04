/**
 * AI Community Guardian - JavaScript Functionality
 * Handles all client-side interactions and API communication
 */

// Configuration
const API_BASE_URL = '/api';
const UPLOAD_MAX_SIZE = 10 * 1024 * 1024; // 10MB

// State variables
let currentImagePath = null;
let currentAnalysis = null;
let chatHistory = [];
let isAnalyzingImage = false;
let isGeneratingReport = false;
let appConfig = {};
let complaintChart = null;
let currentComplaints = [];
let mapInstance = null;
let mapMarkers = [];
let currentLanguage = 'en';
let currentGeneratedReport = null;
let complaintClusterGroup = null;
let selectedComplaintForResolution = null;
let heatmapInstance = null;
let adminDashboardChart = null;
let departmentChart = null;
let monthlyChart = null;
let priorityChart = null;
let voiceRecognition = null;
let pendingDuplicateComplaint = null;
let pendingDuplicateMessage = null;
let adminComplaintEditId = null;

/**
 * Initialize the application
 */
document.addEventListener('DOMContentLoaded', function () {
    console.log('AI Community Guardian initialized');
    loadEmergencyNumbers();
    setupDragDrop();
    initializeChat();
    localizePage();
    loadAppConfig();
    loadUserState();
    loadHeatmap();
    loadAdminDashboard();
    loadAdminComplaints();
    loadAnalyticsDashboard();
    loadCivicPredictions();
    loadRewards();
    loadNotifications();
});

/**
 * ==================== Chat Functionality ====================
 */

/**
 * Initialize chat session
 */
function initializeChat() {
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.focus();
    }
}

/**
 * Handle chat input on Enter key
 */
function handleChatKeypress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendChatMessage();
    }
}

/**
 * Send chat message to backend
 */
async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    const errorDiv = document.getElementById('chatError');
    const chatHistory = document.getElementById('chatHistory');

    if (!message) {
        showError(errorDiv, 'Please enter a message');
        return;
    }

    if (message.length > 5000) {
        showError(errorDiv, 'Message is too long (max 5000 characters)');
        return;
    }

    // Add user message to chat
    addChatMessage(message, 'user');
    input.value = '';
    errorDiv.style.display = 'none';

    let loadingMessage = null;
    try {
        // Show loading indicator
        loadingMessage = addChatMessage('...', 'bot', true);

        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: message })
        });

        // Remove loading indicator
        const botMessages = chatHistory.querySelectorAll('.bot-message');
        if (botMessages.length > 0) {
            botMessages[botMessages.length - 1].remove();
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to get response from the AI service');
        }

        const data = await response.json();
        if (data.success) {
            addChatMessage(data.response, 'bot');
        } else {
            throw new Error(data.error || 'Failed to get a valid AI response');
        }
    } catch (error) {
        console.error('Chat error:', error);
        addChatMessage(`⚠️ ${error.message}`, 'bot');
        showError(errorDiv, error.message);
    } finally {
        if (loadingMessage && loadingMessage.parentNode) {
            loadingMessage.parentNode.removeChild(loadingMessage);
        }
    }
}

/**
 * Add message to chat history
 */
function addChatMessage(message, sender, isLoading = false) {
    const chatHistory = document.getElementById('chatHistory');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}-message${isLoading ? ' loading' : ''}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    if (sender === 'bot') {
        if (isLoading) {
            contentDiv.innerHTML = '<strong>Community Guardian:</strong> <span class="typing-indicator">•••</span>';
        } else {
            contentDiv.innerHTML = `<strong>Community Guardian:</strong> ${escapeHtml(String(message || ''))}`;
            animateTyping(contentDiv);
        }
    } else {
        contentDiv.textContent = message;
    }

    messageDiv.appendChild(contentDiv);
    chatHistory.appendChild(messageDiv);

    // Auto-scroll to bottom
    chatHistory.scrollTop = chatHistory.scrollHeight;
    return messageDiv;
}

/**
 * Simple typing animation
 */
function animateTyping(element) {
    const text = element.innerHTML;
    element.innerHTML = '';
    let index = 0;

    const animate = () => {
        if (index < text.length) {
            element.innerHTML = text.substring(0, index + 1);
            index++;
            setTimeout(animate, 20);
        }
    };

    animate();
}

/**
 * ==================== Image Analyzer Functionality ====================
 */

/**
 * Setup drag and drop for image upload
 */
function setupDragDrop() {
    const uploadArea = document.getElementById('uploadArea');

    if (!uploadArea) return;

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Highlight drop area
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.style.borderColor = 'var(--primary-light)';
            uploadArea.style.background = 'rgba(255, 255, 255, 0.15)';
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            uploadArea.style.background = 'rgba(255, 255, 255, 0.05)';
        });
    });

    // Handle dropped files
    uploadArea.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleImageFile(files[0]);
        }
    });
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

/**
 * Handle image file upload
 */
function handleImageUpload(event) {
    const files = event.target.files;
    if (files.length > 0) {
        handleImageFile(files[0]);
    }
}

function handleImageFile(file) {
    const errorDiv = document.getElementById('analyzerError');
    errorDiv.style.display = 'none';

    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        if (image.width < 200 || image.height < 200) {
            showNotification('The image is very small. Consider uploading a clearer picture.', 'error');
        }
        if (image.width < 100 || image.height < 100) {
            showError(errorDiv, 'Image is too small. Please upload a sharper photo.');
        }
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, image.width, image.height);
        const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
        let sum = 0;
        for (let i = 0; i < pixels.length; i += 4) {
            sum += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
        }
        const avg = sum / (pixels.length / 4);
        const variance = pixels.reduce((acc, value, index) => {
            if (index % 4 === 0) {
                const diff = value - avg;
                acc += diff * diff;
            }
            return acc;
        }, 0) / (pixels.length / 4);
        if (variance < 1000) {
            showNotification('The image appears blurry. A sharper upload may improve AI analysis.', 'error');
        }
    };
    image.src = objectUrl;

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        showError(errorDiv, 'Invalid file type. Please upload PNG, JPG, GIF, or WebP.');
        return;
    }

    // Validate file size
    if (file.size > UPLOAD_MAX_SIZE) {
        showError(errorDiv, 'File is too large. Maximum size is 10MB.');
        return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
        currentImagePath = file; // Store for later upload
        displayImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
}

/**
 * Display image preview
 */
function displayImagePreview(imageSrc) {
    const preview = document.getElementById('imagePreview');
    const uploadArea = document.getElementById('uploadArea');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const previewImage = document.getElementById('previewImage');

    previewImage.src = imageSrc;
    preview.style.display = 'block';
    uploadArea.style.display = 'none';
    analyzeBtn.style.display = 'block';
    analyzeBtn.disabled = false;

    // Hide analysis results
    document.getElementById('analysisResults').style.display = 'none';
    document.getElementById('reportSection').style.display = 'none';
    currentAnalysis = null;
}

/**
 * Remove selected image
 */
function removeImage() {
    currentImagePath = null;
    currentAnalysis = null;
    isAnalyzingImage = false;

    const preview = document.getElementById('imagePreview');
    const uploadArea = document.getElementById('uploadArea');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const analysisResults = document.getElementById('analysisResults');
    const reportSection = document.getElementById('reportSection');

    preview.style.display = 'none';
    uploadArea.style.display = 'block';
    analyzeBtn.style.display = 'none';
    analysisResults.style.display = 'none';
    reportSection.style.display = 'none';

    document.getElementById('imageInput').value = '';
}

/**
 * Analyze uploaded image
 */
async function analyzeImage() {
    const errorDiv = document.getElementById('analyzerError');
    const loading = document.getElementById('analysisLoading');
    const results = document.getElementById('analysisResults');
    const reportSection = document.getElementById('reportSection');
    const analyzeBtn = document.getElementById('analyzeBtn');

    if (!currentImagePath || isAnalyzingImage) {
        return;
    }

    if (!currentImagePath) {
        showError(errorDiv, 'Please upload an image first');
        return;
    }

    isAnalyzingImage = true;
    if (analyzeBtn) analyzeBtn.disabled = true;
    errorDiv.style.display = 'none';
    results.style.display = 'none';
    reportSection.style.display = 'none';
    loading.style.display = 'flex';

    try {
        const formData = new FormData();
        formData.append('image', currentImagePath);

        const response = await fetch(`${API_BASE_URL}/analyze-image`, {
            method: 'POST',
            body: formData
        });

        loading.style.display = 'none';

        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to analyze image');
        }

        currentAnalysis = data.analysis;
        displayAnalysisResults(data.analysis);
        await fetchRiskPrediction(data.analysis);
        reportSection.style.display = 'block';
    } catch (error) {
        loading.style.display = 'none';
        console.error('Analysis error:', error);
        showError(errorDiv, error.message);
    } finally {
        isAnalyzingImage = false;
        if (analyzeBtn) analyzeBtn.disabled = false;
    }
}

/**
 * Display analysis results
 */
async function fetchRiskPrediction(analysis) {
    try {
        const response = await fetch(`${API_BASE_URL}/complaints/risk-analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ analysis: analysis, issue_type: currentAnalysis?.issue_type || '' })
        });
        if (!response.ok) return;
        const data = await response.json();
        if (data.success && data.risk) {
            const container = document.getElementById('analysisResults');
            const riskHtml = `
                <div style="margin-top:12px;padding:12px;border-radius:10px;background:rgba(255,255,255,0.06);">
                    <h4>⚠️ Risk Prediction</h4>
                    <p><strong>Risk Level:</strong> ${escapeHtml(data.risk.risk_level || 'Low')}</p>
                    <p><strong>Possible Consequences:</strong> ${escapeHtml((data.risk.possible_consequences || []).join(', '))}</p>
                    <p><strong>Health Hazards:</strong> ${escapeHtml((data.risk.health_hazards || []).join(', '))}</p>
                    <p><strong>Recommended Immediate Action:</strong> ${escapeHtml(data.risk.recommended_immediate_action || '')}</p>
                    <p><strong>Estimated Resolution Time:</strong> ${escapeHtml(data.risk.estimated_resolution_time || '')}</p>
                </div>`;
            container.insertAdjacentHTML('beforeend', riskHtml);
        }
    } catch (error) {
        console.warn('Risk prediction load failed', error);
    }
}

function displayAnalysisResults(analysis) {
    const results = document.getElementById('analysisResults');
    const content = document.getElementById('analysisContent');
    let displayText = '';

    if (!analysis) {
        displayText = 'No analysis available.';
    } else if (typeof analysis === 'string') {
        displayText = analysis;
    } else if (typeof analysis === 'object') {
        displayText = `Issue Type: ${escapeHtml(analysis.issue_type || '')}\n` +
            `Severity: ${escapeHtml(analysis.severity || '')}\n` +
            `Description: ${escapeHtml(analysis.description || '')}\n` +
            `Recommended Actions: ${escapeHtml(analysis.recommended_actions || '')}\n` +
            `Responsible Department: ${escapeHtml(analysis.responsible_department || '')}\n` +
            `Priority: ${escapeHtml(analysis.priority || '')}\n` +
            `Estimated Response Time: ${escapeHtml(analysis.estimated_response_time || '')}`;
    } else {
        displayText = String(analysis);
    }

    content.textContent = displayText;
    results.style.display = 'block';

    // Scroll to results
    results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Generate complaint report
 */
async function generateReport() {
    const errorDiv = document.getElementById('reportError');
    const loading = document.getElementById('reportLoading');
    const output = document.getElementById('reportOutput');
    const reportButton = document.querySelector('#reportSection button.btn-primary');

    if (!currentAnalysis || isGeneratingReport) {
        return;
    }

    if (!currentAnalysis) {
        showError(errorDiv, 'Please analyze an image first');
        return;
    }

    isGeneratingReport = true;
    if (reportButton) reportButton.disabled = true;
    errorDiv.style.display = 'none';
    output.style.display = 'none';
    loading.style.display = 'flex';

    try {
        const response = await fetch(`${API_BASE_URL}/generate-report`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ analysis: currentAnalysis, location: 'Not provided' })
        });

        loading.style.display = 'none';

        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to generate report');
        }

        currentGeneratedReport = data;
        const reportText = data.report || data.title || 'No report content returned';
        const localizedReport = await translateTextIfNeeded(reportText);
        displayReport(localizedReport);
        output.style.display = 'block';
        fetchMyComplaints();
        await loadNotifications();
    } catch (error) {
        loading.style.display = 'none';
        console.error('Report generation error:', error);
        showError(errorDiv, error.message);
    } finally {
        isGeneratingReport = false;
        if (reportButton) reportButton.disabled = false;
    }
}

/**
 * Display generated report
 */
function displayReport(report) {
    const content = document.getElementById('reportContent');
    content.textContent = report;
}

async function translateTextIfNeeded(text) {
    if (!text || currentLanguage === 'en') return text;
    try {
        const response = await fetch(`${API_BASE_URL}/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, language: currentLanguage })
        });
        const data = await response.json().catch(() => ({}));
        return data.success ? data.translated_text : text;
    } catch (error) {
        return text;
    }
}

async function submitQuickComplaint() {
    const issueType = document.getElementById('complaintIssueType').value.trim();
    const severity = document.getElementById('complaintSeverity').value;
    const priority = document.getElementById('complaintPriority').value;
    const department = document.getElementById('complaintDepartment').value.trim();
    const location = document.getElementById('complaintLocation').value.trim();
    const description = document.getElementById('complaintDescription').value.trim();
    const imageInput = document.getElementById('complaintImage');
    const errorDiv = document.getElementById('complaintFormError');
    const formData = new FormData();
    if (!issueType || !description) {
        showError(errorDiv, 'Please fill the issue type and description');
        return;
    }
    formData.append('issue_type', issueType);
    formData.append('severity', severity);
    formData.append('priority', priority);
    formData.append('department', department);
    formData.append('location', location);
    formData.append('description', description);
    formData.append('check_duplicate', 'true');
    if (imageInput && imageInput.files[0]) {
        formData.append('image', imageInput.files[0]);
    }
    try {
        const response = await fetch(`${API_BASE_URL}/complaints`, { method: 'POST', credentials: 'same-origin', body: formData });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
            if (data.duplicate) {
                pendingDuplicateComplaint = data.existing;
                pendingDuplicateMessage = data.message;
                showNotification('Similar complaint already exists. Review and continue?', 'error');
                return;
            }
            throw new Error(data.error || 'Failed to submit complaint');
        }
        showNotification('Complaint submitted successfully');
        fetchMyComplaints();
        await loadNotifications();
        await refreshAllDashboards();
    } catch (error) {
        showError(errorDiv, error.message);
    }
}

/**
 * Copy report to clipboard
 */
function copyReport() {
    const content = document.getElementById('reportContent').textContent;
    navigator.clipboard.writeText(content).then(() => {
        showNotification('Report copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showNotification('Failed to copy report', 'error');
    });
}

/**
 * Download report as text file
 */
function downloadReport() {
    const content = document.getElementById('reportContent').textContent;
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
    element.setAttribute('download', `complaint-report-${new Date().getTime()}.txt`);
    element.style.display = 'none';

    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    showNotification('Report downloaded successfully!');
}

function downloadPdfReport() {
    if (!currentGeneratedReport) {
        showNotification('Generate a report first', 'error');
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    let y = 40;
    doc.setFontSize(18);
    doc.text('Community Guardian Report', 40, y);
    y += 26;
    doc.setFontSize(11);
    const lines = [
        `Complaint ID: ${currentGeneratedReport.report_id || 'N/A'}`,
        `Timestamp: ${new Date().toLocaleString()}`,
        `Location: ${currentGeneratedReport.location || 'N/A'}`,
        `Department: ${currentGeneratedReport.department || 'N/A'}`,
        `Analysis: ${currentGeneratedReport.report || ''}`
    ];
    doc.text(lines, 40, y);
    y += 80;
    const qrText = `Complaint ID: ${currentGeneratedReport.report_id || 'N/A'}\nLocation: ${currentGeneratedReport.location || 'N/A'}`;
    const container = document.createElement('div');
    document.body.appendChild(container);
    window.QRCode.toCanvas(container, qrText, { width: 140 }, () => {
        const canvas = container.querySelector('canvas');
        const dataUrl = canvas.toDataURL('image/png');
        doc.addImage(dataUrl, 'PNG', 40, y, 120, 120);
        doc.save(`complaint-report-${currentGeneratedReport.report_id || Date.now()}.pdf`);
        container.remove();
        showNotification('PDF report downloaded');
    });
}

function emailReport() {
    if (!currentGeneratedReport) {
        showNotification('Generate a report first', 'error');
        return;
    }
    const subject = encodeURIComponent(`Community Guardian Report ${currentGeneratedReport.report_id || ''}`);
    const body = encodeURIComponent(`${currentGeneratedReport.report || ''}\n\nLocation: ${currentGeneratedReport.location || ''}\nDepartment: ${currentGeneratedReport.department || ''}`);
    window.location.href = `mailto:officials@communityguardian.local?subject=${subject}&body=${body}`;
}

/**
 * ==================== Emergency Services ====================
 */

/**
 * Get user location and fetch nearby services
 */
function getLocationAndServices() {
    const errorDiv = document.getElementById('servicesError');
    const container = document.getElementById('servicesContainer');
    const loading = document.getElementById('servicesLoading');

    if (!errorDiv || !container || !loading) {
        console.error('Missing emergency services DOM elements');
        return;
    }

    errorDiv.style.display = 'none';
    container.style.display = 'none';
    loading.style.display = 'flex';

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                fetchNearbyServices(latitude, longitude);
            },
            (error) => {
                console.error('Geolocation error:', error);
                loading.style.display = 'none';
                if (error.code === error.PERMISSION_DENIED) {
                    showError(errorDiv, 'Location permission is required to find nearby emergency services.');
                } else {
                    showError(errorDiv, 'Unable to access your location. Using a default location.');
                    fetchNearbyServices(28.6139, 77.2090);
                }
            },
            { timeout: 10000 }
        );
    } else {
        loading.style.display = 'none';
        showError(errorDiv, 'Geolocation is not supported by your browser.');
    }
}

/**
 * Fetch emergency services from backend
 */
async function fetchNearbyServices(latitude, longitude) {
    const container = document.getElementById('servicesContainer');
    const errorDiv = document.getElementById('servicesError');
    const loading = document.getElementById('servicesLoading');

    try {
        const response = await fetch(`${API_BASE_URL}/emergency-services?latitude=${latitude}&longitude=${longitude}`);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to fetch services');
        }

        const data = await response.json();
        if (data.success) {
            const services = data.services || [];
            displayServices(services);
            if (services.length > 0) {
                container.style.display = 'grid';
                errorDiv.style.display = 'none';
            } else {
                container.style.display = 'block';
                container.innerHTML = '<div class="service-card" style="cursor: default;"><div class="service-name">No nearby emergency services found.</div></div>';
                errorDiv.style.display = 'none';
            }
            initializeMap(latitude, longitude, services);
        } else {
            throw new Error(data.error || 'Failed to fetch services');
        }
    } catch (error) {
        console.error('Services error:', error);
        loading.style.display = 'none';
        showError(errorDiv, error.message);
    } finally {
        if (loading) {
            loading.style.display = 'none';
        }
    }
}

/**
 * Display emergency services
 */
function displayServices(services) {
    const container = document.getElementById('servicesContainer');
    container.innerHTML = '';

    services.forEach(service => {
        const card = document.createElement('div');
        card.className = 'service-card';
        // Safely read fields
        const name = service.name || service.type || 'Service';
        const phone = service.phone || service.contact || 'N/A';
        const description = service.description || '';
        const address = service.address || '';
        const serviceType = service.type || 'Service';
        const distance = service.distance || '';
        const icon = service.icon || '🚨';
        const lat = service.lat || service.latitude || '';
        const lon = service.lon || service.longitude || '';

        card.innerHTML = `
            <div class="service-icon">${icon}</div>
            <div class="service-name">${escapeHtml(name)}</div>
            <div class="service-description"><strong>${escapeHtml(serviceType)}</strong></div>
            <div class="service-phone">${escapeHtml(phone)}</div>
            ${address ? `<div class="service-description">${escapeHtml(address)}</div>` : ''}
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 8px;">
                📍 ${escapeHtml(distance)}
            </p>
            <p style="font-size: 0.75rem; color: var(--success-color); margin-top: 5px;">
                ✓ Available 24/7
            </p>
                <div style="margin-top:12px;">
                ${lat && lon ? `<a class="btn btn-secondary" href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}" target="_blank">Navigate</a>` : ''}
            </div>
        `;
        container.appendChild(card);
    });
}

/**
 * ==================== Emergency Numbers ====================
 */

/**
 * Load and display emergency numbers
 */
async function loadEmergencyNumbers() {
    try {
        const response = await fetch(`${API_BASE_URL}/emergency-numbers`);

        if (!response.ok) {
            throw new Error('Failed to fetch emergency numbers');
        }

        const data = await response.json();
        if (data.success) {
            displayEmergencyNumbers(data.numbers);
        } else {
            throw new Error(data.error || 'Failed to fetch emergency numbers');
        }
    } catch (error) {
        console.error('Emergency numbers error:', error);
        displayDefaultEmergencyNumbers();
    }
}

/**
 * Display emergency contact numbers
 */
function displayEmergencyNumbers(numbers) {
    const container = document.getElementById('emergencyNumbers');
    if (!container) return;

    container.innerHTML = '';

    numbers.forEach(contact => {
        const card = document.createElement('div');
        card.className = 'emergency-card';
        card.innerHTML = `
            <div class="service-icon">${contact.icon}</div>
            <div class="emergency-service">${contact.service}</div>
            <div class="emergency-number">${contact.number}</div>
            <div class="emergency-desc">${contact.description}</div>
        `;
        container.appendChild(card);
    });
}

/**
 * Display default emergency numbers if API fails
 */
function displayDefaultEmergencyNumbers() {
    const numbers = [
        { service: 'Police', number: '112', description: 'Police Emergency', icon: '🚔' },
        { service: 'Ambulance', number: '108', description: 'Emergency Ambulance', icon: '🚑' },
        { service: 'Fire', number: '101', description: 'Fire Emergency', icon: '🚒' },
        { service: 'Women Helpline', number: '1091', description: '24-Hour Women Help', icon: '👩' },
        { service: 'Disaster', number: '1070', description: 'Disaster Management', icon: '⚠️' },
        { service: 'Child Help', number: '1098', description: 'Child Emergency Line', icon: '👶' }
    ];
    displayEmergencyNumbers(numbers);
}

async function loadAppConfig() {
    try {
        const response = await fetch(`${API_BASE_URL}/config`);
        if (!response.ok) throw new Error('Failed to load configuration');
        // Keep route contract stable; config may include appName and other flags.
        const data = await response.json();
        console.log('Config response:', data);
    } catch (error) {
        console.warn('App config load error:', error);
    }
}

// Google Maps integration removed. Using Leaflet + OpenStreetMap instead.

function initializeMap(latitude, longitude, services = []) {
    const mapDiv = document.getElementById('map');
    const mapCard = document.getElementById('mapCard');
    if (mapCard) mapCard.style.display = 'block';
    if (!mapDiv) return;

    const lat = parseFloat(latitude) || 20.5937;
    const lon = parseFloat(longitude) || 78.9629;

    // Initialize map if needed
    if (!mapInstance) {
        mapInstance = L.map('map').setView([lat, lon], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(mapInstance);
    } else {
        mapInstance.setView([lat, lon], 13);
        clearMapMarkers();
    }

    // Add user location marker (blue)
    const userMarker = L.marker([lat, lon], {
        icon: L.divIcon({ className: 'user-location-icon', html: '<div style="font-size:22px;">🔵</div>', iconSize: [24, 24] })
    }).addTo(mapInstance).bindPopup('Your location');
    mapMarkers.push(userMarker);

    // Add service markers
    services.forEach(service => {
        const sLat = parseFloat(service.lat);
        const sLon = parseFloat(service.lon);
        if (!Number.isFinite(sLat) || !Number.isFinite(sLon)) return;

        let emoji = '🚨';
        const t = String(service.type || '').toLowerCase();
        if (t.includes('hospital')) emoji = '🏥';
        else if (t.includes('police')) emoji = '👮';
        else if (t.includes('fire')) emoji = '🚒';
        else if (t.includes('ambulance')) emoji = '🚑';

        const marker = L.marker([sLat, sLon], {
            icon: L.divIcon({ className: 'service-icon', html: `<div style="font-size:22px;">${emoji}</div>`, iconSize: [24, 24] })
        }).addTo(mapInstance);

        const name = escapeHtml(service.name || service.type || 'Service');
        const addr = escapeHtml(service.address || service.description || 'Address not available');
        const category = escapeHtml(service.type || 'Service');
        const popupHtml = `<div style="max-width:220px;"><strong>${name}</strong><p style="margin:6px 0; font-size:0.9rem;">${category} ${service.distance ? '• ' + escapeHtml(service.distance) : ''}</p><p style="margin:6px 0; font-size:0.85rem;">${addr}</p></div>`;
        marker.bindPopup(popupHtml);
        mapMarkers.push(marker);
    });

    // Fit map to markers
    try {
        const group = new L.featureGroup(mapMarkers);
        mapInstance.fitBounds(group.getBounds().pad(0.25));
    } catch (e) {
        // ignore if single marker
    }
}

function clearMapMarkers() {
    mapMarkers.forEach(m => {
        try { mapInstance.removeLayer(m); } catch (e) { }
    });
    mapMarkers = [];
}

async function fetchDashboardStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/complaints/stats`, {
            credentials: 'same-origin'
        });
        if (!response.ok) {
            throw new Error('Failed to load dashboard statistics');
        }
        const data = await response.json();
        if (data.success) {
            renderDashboardStats(data.stats || {});
        } else {
            throw new Error(data.error || 'Unable to load dashboard stats');
        }
    } catch (error) {
        console.warn('Dashboard stats error:', error);
        renderDashboardStats({});
    }
}

function renderDashboardStats(stats) {
    const total = stats.total || 0;
    const critical = stats.critical || 0;
    const pending = stats.pending || 0;
    const resolved = stats.resolved || 0;

    document.getElementById('totalComplaints').textContent = total;
    document.getElementById('criticalComplaints').textContent = critical;
    document.getElementById('pendingComplaints').textContent = pending;
    document.getElementById('resolvedComplaints').textContent = resolved;

    const chartCanvas = document.getElementById('complaintChart');
    if (!chartCanvas) return;

    const dataset = {
        labels: ['Critical', 'Pending', 'Resolved', 'Other'],
        datasets: [{
            data: [critical, pending, resolved, Math.max(total - critical - pending - resolved, 0)],
            backgroundColor: ['#ff6b6b', '#ffd43b', '#51cf66', '#4ecdc4'],
            borderColor: 'rgba(255, 255, 255, 0.15)',
            borderWidth: 1
        }]
    };

    if (complaintChart) {
        complaintChart.data = dataset;
        complaintChart.update();
    } else {
        complaintChart = new Chart(chartCanvas, {
            type: 'doughnut',
            data: dataset,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#fff' }
                    },
                    tooltip: {
                        bodyColor: '#fff',
                        backgroundColor: 'rgba(0, 0, 0, 0.85)'
                    }
                },
                cutout: '60%'
            }
        });
    }
}

function populateComplaintFilterOptions(complaints = []) {
    const statusSelect = document.getElementById('complaintStatusFilter');
    const prioritySelect = document.getElementById('complaintPriorityFilter');
    const departmentSelect = document.getElementById('complaintDepartmentFilter');

    if (!statusSelect || !prioritySelect || !departmentSelect) {
        return;
    }

    const selectedStatus = statusSelect.value || '';
    const selectedPriority = prioritySelect.value || '';
    const selectedDepartment = departmentSelect.value || '';

    const statuses = [...new Set(complaints.map(c => c.status).filter(Boolean))].sort();
    const priorities = [...new Set(complaints.map(c => c.priority).filter(Boolean))].sort();
    const departments = [...new Set(complaints.map(c => c.department).filter(Boolean))].sort();

    const buildOptions = (select, values, placeholderLabel, selectedValue) => {
        select.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = placeholderLabel;
        select.appendChild(placeholder);

        values.forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            if (value === selectedValue) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        if (selectedValue && !values.includes(selectedValue)) {
            const fallback = document.createElement('option');
            fallback.value = selectedValue;
            fallback.textContent = selectedValue;
            fallback.selected = true;
            select.appendChild(fallback);
        }
    };

    buildOptions(statusSelect, statuses, 'All Statuses', selectedStatus);
    buildOptions(prioritySelect, priorities, 'All Priorities', selectedPriority);
    buildOptions(departmentSelect, departments, 'All Departments', selectedDepartment);
}

async function refreshComplaintList() {
    const search = document.getElementById('complaintSearch').value.trim();
    const status = document.getElementById('complaintStatusFilter').value;
    const priority = document.getElementById('complaintPriorityFilter').value;
    const department = document.getElementById('complaintDepartmentFilter').value;
    const sort = document.getElementById('complaintSort').value;

    await fetchMyComplaints({ search, status, priority, department, sort });
}

async function fetchMyComplaints(options = {}) {
    const list = document.getElementById('complaintList');
    const params = new URLSearchParams();
    if (options.search) params.append('search', options.search);
    if (options.status) params.append('status', options.status);
    if (options.priority) params.append('priority', options.priority);
    if (options.department) params.append('department', options.department);
    if (options.sort) params.append('sort', options.sort);

    try {
        const response = await fetch(`${API_BASE_URL}/complaints?${params.toString()}`, {
            credentials: 'same-origin'
        });

        if (!response.ok) {
            throw new Error('Failed to load complaints');
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Failed to load complaints');
        }

        currentComplaints = data.complaints || [];
        populateComplaintFilterOptions(currentComplaints);
        list.innerHTML = '';

        if (!currentComplaints.length) {
            list.textContent = 'No complaints found.';
            fetchDashboardStats();
            return;
        }

        currentComplaints.forEach(c => {
            const item = document.createElement('div');
            item.className = 'complaint-item';
            const progress = getStatusProgress(c.status || 'New');
            item.innerHTML = `
                <div class="complaint-card-header" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
                    <strong style="font-size:1rem;">${escapeHtml(c.title || c.issue || 'Untitled Complaint')}</strong>
                    <span style="font-size:0.85rem;color:var(--success-color);">${escapeHtml(c.status || 'Unknown')}</span>
                </div>
                <div class="status-bar" style="margin-top:10px;"><div style="width:${progress}%"></div></div>
                <div style="margin-top:10px;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;">
                    <div><strong>Issue:</strong> ${escapeHtml(c.issue || 'N/A')}</div>
                    <div><strong>Priority:</strong> ${escapeHtml(c.priority || 'N/A')}</div>
                    <div><strong>Department:</strong> ${escapeHtml(c.department || 'N/A')}</div>
                    <div><strong>Location:</strong> ${escapeHtml(c.location || 'N/A')}</div>
                    <div><strong>Date:</strong> ${escapeHtml(new Date(c.created_at || '').toLocaleString() || 'N/A')}</div>
                </div>
                <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
                    <button class="btn btn-secondary" onclick="viewComplaint(${c.id})">View</button>
                    <button class="btn btn-secondary" onclick="openBeforeAfterModal(${c.id})">Before/After</button>
                    <button class="btn btn-secondary" onclick="deleteComplaint(event, ${c.id})">Delete</button>
                </div>
            `;
            list.appendChild(item);
        });

        fetchDashboardStats();
    } catch (error) {
        list.textContent = 'Please login to view your complaints.';
        console.warn('Complaints load error:', error);
    }
}

function getStatusProgress(status) {
    const normalized = String(status || 'New').toLowerCase();
    const steps = {
        new: 20,
        'under review': 40,
        'in progress': 60,
        assigned: 60,
        resolved: 100,
        rejected: 100
    };
    return steps[normalized] || 20;
}

function exportComplaintsCSV() {
    if (!currentComplaints.length) {
        showNotification('No complaints available to export', 'error');
        return;
    }

    const headers = ['ID', 'Title', 'Issue', 'Severity', 'Priority', 'Department', 'Status', 'Location', 'Created At'];
    const rows = currentComplaints.map(c => [
        c.id,
        c.title || c.issue || '',
        c.issue || '',
        c.severity || '',
        c.priority || '',
        c.department || '',
        c.status || '',
        c.location || '',
        c.created_at || ''
    ]);

    const csvContent = [headers, ...rows].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `community-complaints-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotification('Complaint data exported as CSV');
}

function generateComplaintPDF() {
    if (!currentComplaints.length) {
        showNotification('No complaints available to export', 'error');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    let y = 40;
    doc.setFontSize(18);
    doc.text('Community Guardian Complaint Summary', 40, y);
    y += 30;
    doc.setFontSize(11);

    currentComplaints.slice(0, 10).forEach((complaint, index) => {
        if (y > 740) {
            doc.addPage();
            y = 40;
        }
        doc.setFont(undefined, 'bold');
        doc.text(`${index + 1}. ${complaint.title || complaint.issue || 'Untitled Complaint'}`, 40, y);
        y += 18;
        doc.setFont(undefined, 'normal');
        const lines = doc.splitTextToSize(`Status: ${complaint.status || 'N/A'} | Priority: ${complaint.priority || 'N/A'} | Department: ${complaint.department || 'N/A'} | Location: ${complaint.location || 'N/A'}`, 520);
        doc.text(lines, 40, y);
        y += lines.length * 14 + 4;
        const description = doc.splitTextToSize(`Issue: ${complaint.issue || 'N/A'}${complaint.description ? '\nDescription: ' + complaint.description : ''}`, 520);
        doc.text(description, 40, y);
        y += description.length * 14 + 20;
    });

    doc.save(`community-complaints-${Date.now()}.pdf`);
    showNotification('PDF export created successfully');
}

function createQrCode(reportText) {
    const container = document.createElement('div');
    container.id = 'report-qr';
    document.body.appendChild(container);
    QRCode.toCanvas(container, reportText, { width: 120 }, () => {
        const canvas = container.querySelector('canvas');
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = 'complaint-qr.png';
        link.click();
        container.remove();
    });
}

function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    showNotification('Theme mode updated');
}

function startVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showNotification('Voice input is not supported by your browser', 'error');
        return;
    }

    if (!voiceRecognition) {
        voiceRecognition = new SpeechRecognition();
        voiceRecognition.lang = currentLanguage === 'hi' ? 'hi-IN' : currentLanguage === 'kn' ? 'kn-IN' : 'en-US';
        voiceRecognition.interimResults = false;
        voiceRecognition.maxAlternatives = 1;
        voiceRecognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            const input = document.getElementById('chatInput');
            const complaintInput = document.getElementById('complaintDescription');
            if (input) {
                input.value = transcript;
                sendChatMessage();
            } else if (complaintInput) {
                complaintInput.value = transcript;
            }
        };
        voiceRecognition.onerror = (event) => {
            showNotification('Voice recognition error: ' + (event.error || 'unknown'), 'error');
        };
    }

    voiceRecognition.start();
    showNotification('Listening for your message...');
}

function switchLanguage(lang) {
    currentLanguage = lang;
    localizePage();
    showNotification('Language switched');
}

async function loadHeatmap() {
    try {
        const response = await fetch(`${API_BASE_URL}/complaints/map`);
        if (!response.ok) throw new Error('Failed to load complaints');
        const data = await response.json();
        if (data.success) {
            renderHeatmap(data.complaints || []);
        }
    } catch (error) {
        console.warn('Heatmap error:', error);
        const status = document.getElementById('heatmapStatus');
        if (status) {
            status.style.display = 'block';
            status.textContent = 'Heatmap data is currently unavailable.';
        }
    }
}

function renderHeatmap(complaints) {
    const mapDiv = document.getElementById('heatmapMap');
    if (!mapDiv) return;
    if (!heatmapInstance) {
        heatmapInstance = L.map('heatmapMap').setView([20.5937, 78.9629], 5);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(heatmapInstance);
        complaintClusterGroup = L.markerClusterGroup();
        heatmapInstance.addLayer(complaintClusterGroup);
    }
    complaintClusterGroup.clearLayers();
    complaints.forEach(complaint => {
        const lat = parseFloat(complaint.latitude);
        const lon = parseFloat(complaint.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
        const color = complaint.severity === 'Critical' || complaint.priority === 'Critical' ? 'red' : complaint.severity === 'High' || complaint.priority === 'High' ? 'orange' : complaint.severity === 'Medium' || complaint.priority === 'Medium' ? 'yellow' : 'green';
        const marker = L.circleMarker([lat, lon], {
            radius: 8,
            color: color,
            fillColor: color,
            fillOpacity: 0.8,
            weight: 2
        });
        complaintClusterGroup.addLayer(marker);
        const popupHtml = `<div style="max-width:220px;"><strong>${escapeHtml(complaint.issue_type || 'Complaint')}</strong><br>${escapeHtml(complaint.description || '')}<br><strong>Status:</strong> ${escapeHtml(complaint.status || 'New')}</div>`;
        marker.bindPopup(popupHtml);
    });
}

async function loadAdminDashboard() {
    try {
        const response = await fetch(`${API_BASE_URL}/dashboard/admin`);
        if (!response.ok) throw new Error('Failed to load admin dashboard');
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Unable to load admin dashboard');
        renderAdminDashboard(data.stats || {});
    } catch (error) {
        console.warn('Admin dashboard error:', error);
    }
}

function renderAdminDashboard(stats) {
    const grid = document.getElementById('adminDashboardGrid');
    if (!grid) return;
    const cards = [
        { label: 'Total complaints', value: stats.total || 0 },
        { label: 'Resolved', value: stats.resolved || 0 },
        { label: 'Pending', value: stats.pending || 0 },
        { label: 'Critical', value: stats.critical || 0 },
    ];
    grid.innerHTML = cards.map(card => `<div class="dashboard-card"><div class="dashboard-card-title">${escapeHtml(card.label)}</div><div class="dashboard-card-value">${card.value}</div></div>`).join('');
    renderBarChart('adminChart', Object.entries(stats.department_counts || {}).slice(0, 6), 'Department-wise complaints');
    renderBarChart('departmentChart', Object.entries(stats.monthly_counts || {}).slice(0, 6), 'Monthly complaints');
}

function getErrorMessage(response, data, fallback) {
    const backendMessage = data && (data.error || data.message || data.detail);
    if (response.status === 401) return backendMessage || 'Authentication required';
    if (response.status === 403) return backendMessage || 'Admin privileges required';
    return backendMessage || fallback;
}

async function loadAdminComplaints() {
    const body = document.getElementById('adminComplaintsTableBody');
    if (!body) return;

    body.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text-secondary);">Loading complaints...</td></tr>';

    try {
        const response = await fetch(`${API_BASE_URL}/admin/complaints`, { credentials: 'same-origin' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const message = getErrorMessage(response, data, 'Unable to load complaints');
            body.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:#ff9f9f;">${escapeHtml(message)}</td></tr>`;
            if (response.status === 403) {
                showNotification(message, 'error');
            }
            return;
        }
        if (!data.success) throw new Error(data.error || 'Unable to load complaints');
        renderAdminComplaints(data.complaints || []);
        window.adminComplaintData = data.complaints || [];
    } catch (error) {
        console.warn('Admin complaints error:', error);
        body.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:#ff9f9f;">${escapeHtml(error.message || 'Unable to load complaints.')}</td></tr>`;
        showNotification(error.message || 'Unable to load complaints.', 'error');
    }
}

function renderAdminComplaints(complaints) {
    window.adminComplaintData = complaints;
    const body = document.getElementById('adminComplaintsTableBody');
    if (!body) return;

    if (!complaints || !complaints.length) {
        body.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text-secondary);">No complaints found.</td></tr>';
        return;
    }

    body.innerHTML = complaints.map(item => `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.1);">
            <td style="padding:12px;color:#ccc;">${item.id}</td>
            <td style="padding:12px;font-weight:600;color:#fff;">${escapeHtml(item.title || item.issue_type || 'Untitled')}</td>
            <td style="padding:12px;color:#aaa;">${escapeHtml(item.issue_type || 'N/A')}</td>
            <td style="padding:12px;"><span class="status-pill ${getPriorityClass(item.priority)}" style="padding:4px 8px;border-radius:4px;font-size:0.8rem;">${escapeHtml(item.priority || 'Medium')}</span></td>
            <td style="padding:12px;color:#aaa;">${escapeHtml(item.department || 'N/A')}</td>
            <td style="padding:12px;"><span class="status-pill ${getStatusClass(item.status)}" style="padding:4px 8px;border-radius:4px;font-size:0.8rem;">${escapeHtml(item.status || 'New')}</span></td>
            <td style="padding:12px;color:#999;font-size:0.85rem;">${escapeHtml(formatDate(item.created_at) || 'N/A')}</td>
            <td style="padding:12px;">
                <div class="table-actions" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
                    <button class="btn btn-secondary" style="font-size:0.75rem;padding:6px 8px;white-space:nowrap;" onclick="openAdminComplaintModal(${item.id})">✏️ Edit</button>
                    <button class="btn btn-secondary" style="font-size:0.75rem;padding:6px 8px;white-space:nowrap;" onclick="deleteAdminComplaint(${item.id})">🗑️ Delete</button>
                    <select style="font-size:0.75rem;padding:6px 8px;border:1px solid rgba(255,255,255,0.2);border-radius:4px;background:rgba(255,255,255,0.07);color:#fff;cursor:pointer;" onchange="if(this.value) updateAdminComplaintStatus(${item.id}, this.value); this.value='';">
                        <option value="">Quick Status</option>
                        <option value="New">New</option>
                        <option value="Pending">Pending</option>
                        <option value="Under Review">Under Review</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                    </select>
                </div>
            </td>
        </tr>
    `).join('');
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return dateStr;
    }
}

function getStatusClass(status) {
    const value = String(status || 'New').toLowerCase();
    if (value.includes('resolved')) return 'success';
    if (value.includes('progress') || value.includes('review')) return 'warning';
    return 'info';
}

function getPriorityClass(priority) {
    const value = String(priority || 'Medium').toLowerCase();
    if (value.includes('critical')) return 'danger';
    if (value.includes('high')) return 'warning';
    return 'info';
}

async function viewAdminComplaint(complaintId) {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/complaints/${complaintId}`, { credentials: 'same-origin' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) throw new Error(data.error || 'Unable to load complaint');
        const complaint = data.complaint || {};
        const content = document.getElementById('viewReportContent');
        const title = document.getElementById('viewReportTitle');
        if (!content || !title) return;
        title.textContent = `Complaint #${complaint.id}`;
        content.innerHTML = `
            <p><strong>Title:</strong> ${escapeHtml(complaint.title || 'N/A')}</p>
            <p><strong>Issue Type:</strong> ${escapeHtml(complaint.issue_type || 'N/A')}</p>
            <p><strong>Description:</strong> ${escapeHtml(complaint.description || 'N/A')}</p>
            <p><strong>Priority:</strong> ${escapeHtml(complaint.priority || 'N/A')}</p>
            <p><strong>Department:</strong> ${escapeHtml(complaint.department || 'N/A')}</p>
            <p><strong>Status:</strong> ${escapeHtml(complaint.status || 'N/A')}</p>
            <p><strong>Location:</strong> ${escapeHtml(complaint.location || 'N/A')}</p>
            <p><strong>Resolution Notes:</strong> ${escapeHtml(complaint.resolution_notes || 'N/A')}</p>
        `;
        document.getElementById('viewReportModal').style.display = 'block';
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function openAdminComplaintModal(complaintId) {
    adminComplaintEditId = complaintId;
    const modal = document.getElementById('adminComplaintModal');
    if (!modal) return;
    modal.style.display = 'block';

    // Find complaint from window data
    const complaint = (window.adminComplaintData || []).find(item => item.id === complaintId);
    if (!complaint) {
        console.warn('Complaint not found in data');
        return;
    }

    document.getElementById('adminComplaintModalTitle').textContent = `Edit Complaint #${complaintId}`;
    document.getElementById('adminComplaintTitle').value = complaint.title || '';
    document.getElementById('adminComplaintDescription').value = complaint.description || '';
    document.getElementById('adminComplaintPriority').value = complaint.priority || 'Medium';
    document.getElementById('adminComplaintDepartment').value = complaint.department || '';
    document.getElementById('adminComplaintStatus').value = complaint.status || 'New';
    document.getElementById('adminComplaintResolutionNotes').value = complaint.resolution_notes || '';
}

function closeAdminComplaintModal() {
    const modal = document.getElementById('adminComplaintModal');
    if (modal) modal.style.display = 'none';
    adminComplaintEditId = null;
}

async function refreshAllDashboards() {
    await Promise.all([
        loadAdminDashboard(),
        loadAdminComplaints(),
        loadAnalyticsDashboard(),
        loadCivicPredictions()
    ]);
}

async function saveAdminComplaint() {
    if (!adminComplaintEditId) return;

    const title = document.getElementById('adminComplaintTitle').value.trim();
    const description = document.getElementById('adminComplaintDescription').value.trim();
    const priority = document.getElementById('adminComplaintPriority').value;
    const department = document.getElementById('adminComplaintDepartment').value.trim();
    const status = document.getElementById('adminComplaintStatus').value;
    const resolution_notes = document.getElementById('adminComplaintResolutionNotes').value.trim();

    if (!title || !description) {
        showNotification('Title and description are required', 'error');
        return;
    }

    const payload = { title, description, priority, department, status, resolution_notes };

    try {
        const response = await fetch(`${API_BASE_URL}/admin/complaints/${adminComplaintEditId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(getErrorMessage(response, data, 'Unable to save complaint'));
        if (!data.success) throw new Error(data.error || 'Unable to save complaint');
        showNotification('Complaint updated successfully');
        closeAdminComplaintModal();
        await refreshAllDashboards();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function deleteAdminComplaint(complaintId) {
    if (!window.confirm('Are you sure you want to delete this complaint? This action cannot be undone.')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/admin/complaints/${complaintId}`, {
            method: 'DELETE',
            credentials: 'same-origin'
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(getErrorMessage(response, data, 'Unable to delete complaint'));
        if (!data.success) throw new Error(data.error || 'Unable to delete complaint');
        showNotification('Complaint deleted successfully');
        await refreshAllDashboards();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function updateAdminComplaintStatus(complaintId, newStatus) {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/complaints/${complaintId}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ status: newStatus })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(getErrorMessage(response, data, 'Unable to update status'));
        if (!data.success) throw new Error(data.error || 'Unable to update status');
        showNotification('Status updated successfully');
        await refreshAllDashboards();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function loadAnalyticsDashboard() {
    try {
        const response = await fetch(`${API_BASE_URL}/dashboard/analytics`);
        if (!response.ok) throw new Error('Failed to load analytics');
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Unable to load analytics');
        renderAnalyticsDashboard(data.stats || {});
    } catch (error) {
        console.warn('Analytics dashboard error:', error);
        const grid = document.getElementById('analyticsGrid');
        if (grid) {
            grid.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-secondary);">Unable to load analytics data. Please try again later.</div>';
        }
    }
}

function renderAnalyticsDashboard(stats) {
    const grid = document.getElementById('analyticsGrid');
    if (!grid) return;

    // Calculate total complaints
    const totalComplaints = Object.values(stats.department_counts || {}).reduce((a, b) => a + b, 0);

    const cards = [
        { label: 'Total Complaints', value: totalComplaints, emoji: '📊' },
        { label: 'Months with Data', value: Object.keys(stats.monthly_counts || {}).length, emoji: '📅' },
        { label: 'Issue Types', value: Object.keys(stats.issue_counts || {}).length, emoji: '🏷️' },
        { label: 'Departments', value: Object.keys(stats.department_counts || {}).length, emoji: '🏛️' },
        { label: 'Avg Resolution', value: `${stats.average_resolution_days || 0} days`, emoji: '⏱️' },
        { label: 'Critical Issues', value: (stats.priority_counts?.Critical || 0), emoji: '🚨' },
    ];

    grid.innerHTML = cards.map(card => `
        <div class="dashboard-card" style="display:flex;flex-direction:column;justify-content:center;">
            <div style="font-size:1.8rem;margin-bottom:8px;">${card.emoji}</div>
            <div class="dashboard-card-title" style="font-size:0.9rem;">${escapeHtml(card.label)}</div>
            <div class="dashboard-card-value" style="font-size:1.4rem;font-weight:bold;">${escapeHtml(String(card.value))}</div>
        </div>
    `).join('');

    // Render charts
    if (Object.keys(stats.monthly_counts || {}).length > 0) {
        renderBarChart('monthlyChart', Object.entries(stats.monthly_counts || {}).sort(), 'Monthly Complaint Trend');
    } else {
        const canvas = document.getElementById('monthlyChart');
        if (canvas) {
            const parent = canvas.parentElement;
            const msg = document.createElement('div');
            msg.style.cssText = 'text-align:center;padding:40px 20px;color:var(--text-secondary);';
            msg.innerHTML = '📊 No monthly data available yet';
            parent.replaceChild(msg, canvas);
        }
    }

    if (Object.keys(stats.priority_counts || {}).length > 0) {
        renderBarChart('priorityChart', Object.entries(stats.priority_counts || {}), 'Priority Distribution');
    } else {
        const canvas = document.getElementById('priorityChart');
        if (canvas) {
            const parent = canvas.parentElement;
            const msg = document.createElement('div');
            msg.style.cssText = 'text-align:center;padding:40px 20px;color:var(--text-secondary);';
            msg.innerHTML = '📊 No priority data available yet';
            parent.replaceChild(msg, canvas);
        }
    }
}

async function loadCivicPredictions() {
    try {
        const response = await fetch(`${API_BASE_URL}/dashboard/predictions`);
        if (!response.ok) throw new Error('Failed to load predictions');
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Unable to load predictions');
        renderCivicPredictions(data.predictions || {});
    } catch (error) {
        console.warn('Predictions error:', error);
        const container = document.getElementById('predictionCards');
        if (container) {
            container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-secondary);">Unable to load predictions. Please try again later.</div>';
        }
    }
}

function renderCivicPredictions(predictions) {
    const container = document.getElementById('predictionCards');
    if (!container) return;

    const hotspots = (predictions.hotspots || []).slice(0, 3);
    const hasHotspots = hotspots.length > 0;
    const hotspotsHtml = hasHotspots
        ? hotspots.map(item => `<div style="padding:8px;background:rgba(255,255,255,0.05);border-radius:6px;margin-bottom:6px;font-size:0.9rem;">📍 ${escapeHtml(item.location)}<br><small style="color:var(--text-secondary);">Complaints: ${item.count}</small></div>`).join('')
        : '<div style="color:var(--text-secondary);font-size:0.9rem;">No hotspots identified yet</div>';

    const getRiskEmoji = (level) => {
        if (level === 'Critical' || level === 'High') return '🔴';
        if (level === 'Moderate') return '🟡';
        return '🟢';
    };

    const getRiskColor = (level) => {
        if (level === 'Critical') return '#ff6b6b';
        if (level === 'High') return '#ff922b';
        if (level === 'Moderate') return '#ffd43b';
        return '#51cf66';
    };

    container.innerHTML = `
        <div class="prediction-card" style="background:linear-gradient(135deg,rgba(255,107,107,0.1),rgba(255,107,107,0.05));">
            <strong style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">🌡️ Disease Risk</strong>
            <div style="font-size:1.4rem;font-weight:bold;color:${getRiskColor(predictions.disease_risk || 'Low')};margin-bottom:8px;">${getRiskEmoji(predictions.disease_risk || 'Low')} ${escapeHtml(predictions.disease_risk || 'Low')}</div>
        </div>
        <div class="prediction-card" style="background:linear-gradient(135deg,rgba(255,192,0,0.1),rgba(255,192,0,0.05));">
            <strong style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">🗑️ Garbage Accumulation</strong>
            <div style="font-size:1.4rem;font-weight:bold;color:${getRiskColor(predictions.garbage_accumulation || 'Low')};margin-bottom:8px;">${getRiskEmoji(predictions.garbage_accumulation || 'Low')} ${escapeHtml(predictions.garbage_accumulation || 'Low')}</div>
        </div>
        <div class="prediction-card" style="background:linear-gradient(135deg,rgba(100,200,255,0.1),rgba(100,200,255,0.05));">
            <strong style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">🌊 Flood Risk</strong>
            <div style="font-size:1.4rem;font-weight:bold;color:${getRiskColor(predictions.flood_risk || 'Low')};margin-bottom:8px;">${getRiskEmoji(predictions.flood_risk || 'Low')} ${escapeHtml(predictions.flood_risk || 'Low')}</div>
        </div>
        <div class="prediction-card" style="background:linear-gradient(135deg,rgba(76,175,80,0.1),rgba(76,175,80,0.05));">
            <strong style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">📍 Complaint Hotspots</strong>
            <div>${hotspotsHtml}</div>
        </div>
        ${(predictions.recommendations || []).length > 0 ? `
        <div class="prediction-card" style="grid-column:1/-1;background:linear-gradient(135deg,rgba(100,200,255,0.1),rgba(100,200,255,0.05));">
            <strong style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">💡 Recommendations</strong>
            <ul style="margin:0;padding-left:20px;color:var(--text-secondary);font-size:0.9rem;">
                ${(predictions.recommendations || []).map(rec => `<li style="margin-bottom:6px;">${escapeHtml(rec)}</li>`).join('')}
            </ul>
        </div>
        ` : ''}
    `;
}

async function loadNotifications() {
    try {
        const response = await fetch(`${API_BASE_URL}/notifications`, { credentials: 'same-origin' });
        if (!response.ok) return;
        const data = await response.json();
        if (data.success && data.notifications && data.notifications.length) {
            const list = document.getElementById('notificationsPanel');
            if (list) {
                list.innerHTML = data.notifications.map(item => `<div class="timeline-item"><strong>${escapeHtml(item.title)}</strong><div>${escapeHtml(item.message)}</div></div>`).join('');
            }
        }
    } catch (error) {
        console.warn('Notifications error:', error);
    }
}

async function loadRewards() {
    try {
        const response = await fetch(`${API_BASE_URL}/rewards`, { credentials: 'same-origin' });
        if (!response.ok) return;
        const data = await response.json();
        if (!data.success) return;
        const container = document.getElementById('rewardsPanel');
        if (!container) return;
        const rewards = data.rewards || {};
        const leaderboard = data.leaderboard || [];
        container.innerHTML = `
            <div class="reward-card"><strong>Points</strong><div>${rewards.points || 0}</div></div>
            <div class="reward-card"><strong>Badge</strong><div>${escapeHtml(rewards.badge || 'Bronze')}</div></div>
            <div class="reward-card"><strong>Leaderboard</strong><div>${leaderboard.slice(0, 5).map(entry => `<div>${escapeHtml(entry.username)} - ${entry.points}</div>`).join('')}</div></div>
        `;
    } catch (error) {
        console.warn('Rewards error:', error);
    }
}

function renderBarChart(canvasId, entries, label) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // Handle empty data
    if (!entries || entries.length === 0) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const parent = canvas.parentElement;
        if (parent) {
            const msg = document.createElement('div');
            msg.style.cssText = 'text-align:center; padding:40px 20px; color:var(--text-secondary); font-size:1.1rem;';
            msg.textContent = 'No complaint data available';
            parent.replaceChild(msg, canvas);
        }
        return;
    }

    const labels = entries.map(([k]) => k);
    const values = entries.map(([, v]) => v);

    // Destroy previous chart if exists
    if (canvasId === 'adminChart' && adminDashboardChart) adminDashboardChart.destroy();
    if (canvasId === 'departmentChart' && departmentChart) departmentChart.destroy();
    if (canvasId === 'monthlyChart' && monthlyChart) monthlyChart.destroy();
    if (canvasId === 'priorityChart' && priorityChart) priorityChart.destroy();

    // Generate colors dynamically based on number of entries
    const colors = ['#51cf66', '#3385ff', '#ff6b6b', '#ffd43b', '#4ecdc4', '#764ba2', '#05c8d4', '#ff922b', '#748ffc', '#ff6a88'];
    const backgroundColor = values.map((_, i) => colors[i % colors.length]);

    const chartConfig = {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: values,
                backgroundColor: backgroundColor,
                borderColor: 'rgba(255, 255, 255, 0.2)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'x',
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: 'rgba(255, 255, 255, 0.8)',
                        font: { size: 12 }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    titleColor: '#fff',
                    bodyColor: '#fff'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.6)',
                        stepSize: Math.ceil(Math.max(...values, 1) / 5)
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.6)',
                        maxRotation: 45,
                        minRotation: 0
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    }
                }
            }
        }
    };

    // Create new chart
    const chartInstance = new Chart(canvas, chartConfig);
    if (canvasId === 'adminChart') adminDashboardChart = chartInstance;
    if (canvasId === 'departmentChart') departmentChart = chartInstance;
    if (canvasId === 'monthlyChart') monthlyChart = chartInstance;
    if (canvasId === 'priorityChart') priorityChart = chartInstance;
}

const translations = {
    en: {
        heroTitle: 'AI Community Guardian',
        heroSubtitle: 'Smart Solutions for Safer Communities',
        heroDescription: 'Report civic issues, get AI-powered analysis, and access emergency support with a single platform',
        reportIssueBtn: '🎯 Report Issue',
        chatWithAIBtn: '💬 Chat with AI',
        chatHeading: '💬 AI Chat Assistant',
        chatDescription: 'Ask questions about community issues, safety tips, and emergency procedures',
        analyzerHeading: '📸 Image Analyzer',
        analyzerDescription: 'Upload an image of a civic issue for AI-powered detection and analysis',
        servicesHeading: '🚨 Nearby Emergency Services',
        servicesDescription: 'Find hospitals, police stations, fire services, and ambulances near you',
        helpHeading: '☎️ Emergency Contact Numbers',
        helpDescription: 'Important emergency numbers for India - Save these in your phone!',
        historyHeading: '📂 My Complaints',
        historyDescription: 'View complaints you\'ve submitted',
        chatPlaceholder: 'Ask me anything... (e.g., \'How do I report a pothole?\')'
    },
    hi: {
        heroTitle: 'एआई कम्युनिटी गार्जियन',
        heroSubtitle: 'स्मार्ट समाधान सुरक्षित समुदायों के लिए',
        heroDescription: 'सार्वजनिक समस्याओं की रिपोर्ट करें, एआई विश्लेषण प्राप्त करें और एक मंच से आपातकालीन समर्थन प्राप्त करें',
        reportIssueBtn: '🎯 समस्या रिपोर्ट करें',
        chatWithAIBtn: '💬 एआई से चैट करें',
        chatHeading: '💬 एआई चैट सहायक',
        chatDescription: 'सामुदायिक मुद्दों, सुरक्षा सुझावों और आपातकालीन प्रक्रियाओं के बारे में प्रश्न पूछें',
        analyzerHeading: '📸 इमेज एनालाइज़र',
        analyzerDescription: 'एआई-समर्थित पहचान और विश्लेषण के लिए नागरिक समस्या की छवि अपलोड करें',
        servicesHeading: '🚨 पास के आपातकालीन सेवाएँ',
        servicesDescription: 'अपने पास अस्पताल, पुलिस स्टेशन, अग्निशमन सेवा और एम्बुलेंस खोजें',
        helpHeading: '☎️ आपातकालीन संपर्क नंबर',
        helpDescription: 'भारत के महत्वपूर्ण आपातकालीन नंबर - इन्हें अपने फोन में सेव करें!',
        historyHeading: '📂 मेरी शिकायतें',
        historyDescription: 'आपकी सबमिट की गई शिकायतें देखें',
        chatPlaceholder: 'मुझसे कुछ भी पूछें... (जैसे, \"मैं गड्ढा कैसे रिपोर्ट करूं?\")'
    },
    kn: {
        heroTitle: 'ಎಐ ಸಮುದಾಯ ಗಾರ್ಡಿಯನ್',
        heroSubtitle: 'ಸುರಕ್ಷಿತ ಸಮುದಾಯಗಳಿಗಾಗಿ ಬುದ್ಧಿವಂತ ಪರಿಹಾರಗಳು',
        heroDescription: 'ಸಾಮಾಜಿಕ ಸಮಸ್ಯೆಗಳನ್ನು ವರದಿ ಮಾಡಿ, ಎಐ ವಿಶ್ಲೇಷಣೆ ಪಡೆಯಿರಿ ಮತ್ತು ಒಂದು ವೇದಿಕೆಯಲ್ಲಿಯೇ ತುರ್ತು ಬೆಂಬಲವನ್ನು ಪಡೆಯಿರಿ',
        reportIssueBtn: '🎯 ಸಮಸ್ಯೆ ವರದಿ ಮಾಡಿ',
        chatWithAIBtn: '💬 ಎಐ ಜೊತೆ ಚಾಟ್ ಮಾಡಿ',
        chatHeading: '💬 ಎಐ ಚಾಟ್ ಸಹಾಯಕ',
        chatDescription: 'ಸಮುದಾಯ ಸಮಸ್ಯೆಗಳು, ಭದ್ರತಾ ಸಲಹೆಗಳು ಮತ್ತು ತುರ್ತು ಕ್ರಮಗಳ ಬಗ್ಗೆ ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳಿ',
        analyzerHeading: '📸 ಚಿತ್ರ ವಿಶ್ಲೇಷಕ',
        analyzerDescription: 'ಎಐ ಶಕ್ತಿಯೊಂದಿಗೆ ನಾಗರಿಕ ಸಮಸ್ಯೆಯುಳ್ಳ ಇಮೇಜ್ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ',
        servicesHeading: '🚨 ಸಮೀಪದ ತುರ್ತು ಸೇವೆಗಳು',
        servicesDescription: 'ನಿಮ್ಮ ಹತ್ತಿರದ ಆಸ್ಪತ್ರೆಗಳು, ಪೊಲೀಸರ ಠಾಣೆಗಳು, ಅಗ್ನಿಶಾಮಕ ಸೇವೆಗಳು ಮತ್ತು ಆಂಬುಲೆನ್ಸ್‌ಗಳನ್ನು ಕಂಡುಹಿಡಿಯಿರಿ',
        helpHeading: '☎️ ತುರ್ತು ಸಂಪರ್ಕ ಸಂಖ್ಯೆಗಳು',
        helpDescription: 'ಭಾರತದ ಪ್ರಮುಖ ತುರ್ತು ಸಂಖ್ಯೆಗಳು - ನಿಮ್ಮ ಫೋನಿನಲ್ಲಿ ಉಳಿಸಿ!',
        historyHeading: '📂 ನನ್ನ ದೂರುಗಳು',
        historyDescription: 'ನೀವು ಸಲ್ಲಿಸಿದ ದೂರುಗಳನ್ನು ವೀಕ್ಷಿಸಿ',
        chatPlaceholder: 'ನಾನು ಯಾವುದನ್ನಾದರೂ ಕೇಳಿ... (ಉದಾಹರಣೆಗೆ, \"ನಾನು ಗದ್ದೆ ಹೇಗೆ ವರದಿ ಮಾಡಬಹುದು?\")'
    }
};

function localizePage() {
    const values = translations[currentLanguage] || translations.en;
    const setText = (selector, value) => {
        const el = document.querySelector(selector);
        if (el) el.textContent = value;
    };

    setText('.hero-title', values.heroTitle);
    setText('.hero-subtitle', values.heroSubtitle);
    setText('.hero-description', values.heroDescription);
    setText('.hero-buttons button:first-child', values.reportIssueBtn);
    setText('.hero-buttons button:last-child', values.chatWithAIBtn);
    setText('#chat .section-header h2', values.chatHeading);
    setText('#chat .section-header p', values.chatDescription);
    setText('#analyzer .section-header h2', values.analyzerHeading);
    setText('#analyzer .section-header p', values.analyzerDescription);
    setText('#services .section-header h2', values.servicesHeading);
    setText('#services .section-header p', values.servicesDescription);
    setText('#help .section-header h2', values.helpHeading);
    setText('#help .section-header p', values.helpDescription);
    setText('#history .section-header h2', values.historyHeading);
    setText('#history .section-header p', values.historyDescription);

    const chatInput = document.getElementById('chatInput');
    if (chatInput) chatInput.placeholder = values.chatPlaceholder;
}

function showError(element, message) {
    if (!element) return;
    const cleanMessage = String(message || '').replace(/\n/g, '<br>');
    element.innerHTML = `❌ ${cleanMessage}`;
    element.style.display = 'block';
}

/**
 * Show notification message
 */
function showNotification(message, type = 'success') {
    const container = document.getElementById('toastContainer') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'error' : 'success'}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 4200);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}

/**
 * ==================== Global Event Listeners ====================
 */

/**
 * Scroll to specific section
 */
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

/**
 * Show error message
 */
function updateAuthUI(username) {
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const userLabel = document.getElementById('userLabel');
    if (username) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'inline-flex';
        if (userLabel) {
            userLabel.style.display = 'inline-flex';
            userLabel.textContent = `Logged in as ${username}`;
        }
        fetchMyComplaints();
    } else {
        if (loginBtn) loginBtn.style.display = 'inline-flex';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (userLabel) userLabel.style.display = 'none';
        document.getElementById('complaintList').textContent = 'You must be logged in to view your complaints.';
    }
}

async function loadUserState() {
    try {
        const res = await fetch(`${API_BASE_URL}/user`);
        if (!res.ok) throw new Error('Failed to load user state');
        const data = await res.json();
        if (data.success && data.username) {
            updateAuthUI(data.username);
        } else {
            updateAuthUI(null);
        }
    } catch (e) {
        updateAuthUI(null);
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * ==================== Global Event Listeners ====================
 */

// Handle API errors globally
window.addEventListener('error', function (event) {
    console.error('Global error:', event.error);
});

// Log when page loads
console.log('✅ AI Community Guardian frontend loaded successfully');

// ----------------- Authentication (frontend helpers) -----------------
async function submitRegister() {
    const user = document.getElementById('authUsername').value.trim();
    const pass = document.getElementById('authPassword').value.trim();
    const err = document.getElementById('authError');
    if (!user || !pass) { err.style.display = 'block'; err.textContent = 'Username and password required'; return; }
    try {
        const res = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, password: pass })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            err.style.display = 'none'; alert('Registered successfully. Please login.');
        } else {
            err.style.display = 'block'; err.textContent = data.error || 'Register failed';
        }
    } catch (e) { err.style.display = 'block'; err.textContent = e.message; }
}

async function submitLogin() {
    const user = document.getElementById('authUsername').value.trim();
    const pass = document.getElementById('authPassword').value.trim();
    const err = document.getElementById('authError');
    if (!user || !pass) { err.style.display = 'block'; err.textContent = 'Username and password required'; return; }
    try {
        const res = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, password: pass })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            err.style.display = 'none';
            closeAuthModal();
            updateAuthUI(user);
            showNotification('Logged in successfully');
        } else {
            err.style.display = 'block'; err.textContent = data.error || 'Login failed';
        }
    } catch (e) { err.style.display = 'block'; err.textContent = e.message; }
}

function openAuthModal() { document.getElementById('authModal').style.display = 'block'; }
function closeAuthModal() { document.getElementById('authModal').style.display = 'none'; }

async function submitQuickComplaint() {
    const issueType = document.getElementById('complaintIssueType').value.trim();
    const severity = document.getElementById('complaintSeverity').value;
    const priority = document.getElementById('complaintPriority').value;
    const department = document.getElementById('complaintDepartment').value.trim();
    const location = document.getElementById('complaintLocation').value.trim();
    const description = document.getElementById('complaintDescription').value.trim();
    const imageInput = document.getElementById('complaintImage');
    const errorDiv = document.getElementById('complaintFormError');
    if (!issueType || !description) {
        showError(errorDiv, 'Please fill the issue type and description');
        return;
    }
    const formData = new FormData();
    formData.append('issue_type', issueType);
    formData.append('severity', severity);
    formData.append('priority', priority);
    formData.append('department', department);
    formData.append('location', location);
    formData.append('description', description);
    formData.append('check_duplicate', 'true');
    if (imageInput && imageInput.files[0]) {
        formData.append('image', imageInput.files[0]);
    }
    try {
        const response = await fetch(`${API_BASE_URL}/complaints`, { method: 'POST', credentials: 'same-origin', body: formData });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
            if (data.duplicate) {
                const shouldContinue = window.confirm(`${data.message}. Continue anyway?`);
                if (!shouldContinue) return;
                const continueFormData = new FormData();
                continueFormData.append('issue_type', issueType);
                continueFormData.append('severity', severity);
                continueFormData.append('priority', priority);
                continueFormData.append('department', department);
                continueFormData.append('location', location);
                continueFormData.append('description', description);
                continueFormData.append('check_duplicate', 'false');
                if (imageInput && imageInput.files[0]) {
                    continueFormData.append('image', imageInput.files[0]);
                }
                const continueResponse = await fetch(`${API_BASE_URL}/complaints`, { method: 'POST', credentials: 'same-origin', body: continueFormData });
                const continueData = await continueResponse.json().catch(() => ({}));
                if (!continueResponse.ok || !continueData.success) throw new Error(continueData.error || 'Failed to submit complaint');
                showNotification('Complaint submitted successfully');
                fetchMyComplaints();
                await loadNotifications();
                await refreshAllDashboards();
                return;
            }
            throw new Error(data.error || 'Failed to submit complaint');
        }
        showNotification('Complaint submitted successfully');
        fetchMyComplaints();
        await loadNotifications();
        await refreshAllDashboards();
    } catch (error) {
        showError(errorDiv, error.message);
    }
}

function openViewReportModal() {
    const modal = document.getElementById('viewReportModal');
    if (modal) modal.style.display = 'block';
}

function closeViewReportModal() {
    const modal = document.getElementById('viewReportModal');
    if (modal) modal.style.display = 'none';
}

function openBeforeAfterModal(complaintId) {
    selectedComplaintForResolution = complaintId;
    document.getElementById('beforeAfterModal').style.display = 'block';
}

function closeBeforeAfterModal() {
    document.getElementById('beforeAfterModal').style.display = 'none';
    selectedComplaintForResolution = null;
}

async function submitAfterImage() {
    const imageInput = document.getElementById('afterImageInput');
    if (!selectedComplaintForResolution || !imageInput || !imageInput.files[0]) {
        showNotification('Please choose a repaired image first', 'error');
        return;
    }
    const formData = new FormData();
    formData.append('image', imageInput.files[0]);
    try {
        const response = await fetch(`${API_BASE_URL}/complaints/${selectedComplaintForResolution}/resolve`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ after_image_path: imageInput.files[0].name })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) throw new Error(data.error || 'Unable to resolve complaint');
        showNotification('Complaint marked as resolved');
        closeBeforeAfterModal();
        fetchMyComplaints();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function viewComplaint(id) {
    const modal = document.getElementById('viewReportModal');
    const content = document.getElementById('viewReportContent');
    const title = document.getElementById('viewReportTitle');
    if (!content || !title) {
        showNotification('Unable to open report modal', 'error');
        return;
    }

    try {
        title.textContent = 'Loading report...';
        content.innerHTML = '<p>Loading report details...</p>';
        openViewReportModal();

        const res = await fetch(`${API_BASE_URL}/complaints/${id}`, { credentials: 'same-origin' });
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to fetch report');
        }

        const data = await res.json();
        if (!data.success || !data.report) {
            throw new Error(data.error || 'Report not found');
        }

        const report = data.report;
        title.textContent = report.title || 'Report Detail';
        const history = await fetch(`${API_BASE_URL}/complaints/${id}/status`, { credentials: 'same-origin' }).then(r => r.json()).catch(() => ({ success: false }));
        const timeline = history.success ? (history.history || []).map(item => `<div class="timeline-item"><span class="dot"></span><strong>${escapeHtml(item.status)}</strong><div>${escapeHtml(item.note || '')}</div></div>`).join('') : '<p>No status timeline yet.</p>';
        content.innerHTML = `
            <p><strong>Issue:</strong> ${escapeHtml(report.issue || 'N/A')}</p>
            <p><strong>Description:</strong> ${escapeHtml(report.description || 'N/A')}</p>
            <p><strong>Severity:</strong> ${escapeHtml(report.severity || 'N/A')}</p>
            <p><strong>Location:</strong> ${escapeHtml(report.location || 'N/A')}</p>
            <p><strong>Recommended Action:</strong> ${escapeHtml(report.recommended_action || 'N/A')}</p>
            <p><strong>Department:</strong> ${escapeHtml(report.department || 'N/A')}</p>
            <p><strong>Status:</strong> ${escapeHtml(report.status || 'N/A')}</p>
            <p><strong>Created At:</strong> ${escapeHtml(report.created_at || 'N/A')}</p>
            <div style="margin-top:16px;padding:14px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:rgba(255,255,255,0.04)">
                <h4 style="margin:0 0 8px 0;">Full Report Text</h4>
                <pre style="white-space:pre-wrap;word-break:break-word;line-height:1.5;margin:0;">${escapeHtml(report.report_text || '')}</pre>
            </div>
            <div style="margin-top:16px;padding:14px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:rgba(255,255,255,0.04)">
                <h4 style="margin:0 0 8px 0;">Complaint Timeline</h4>
                <div>${timeline}</div>
            </div>
        `;
    } catch (e) {
        showNotification(e.message, 'error');
        title.textContent = 'Report Detail';
        content.innerHTML = `<p>Unable to load report details.</p><p>${escapeHtml(e.message)}</p>`;
    }
}

async function logout() {
    try {
        const res = await fetch(`${API_BASE_URL}/logout`, { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.success) {
            updateAuthUI(null);
            showNotification('Logged out successfully');
        }
    } catch (e) {
        showNotification('Failed to logout', 'error');
    }
}

async function deleteComplaint(event, id) {
    const card = event?.target?.closest?.('.complaint-item');
    try {
        const res = await fetch(`${API_BASE_URL}/complaints/${id}`, {
            method: 'DELETE',
            credentials: 'same-origin'
        });
        const data = await res.json();
        if (res.ok && data.success) {
            showNotification(data.message || 'Complaint deleted successfully');
            if (card) {
                card.remove();
                const list = document.getElementById('complaintList');
                if (!list.querySelector('.complaint-item')) {
                    list.textContent = 'No complaints found.';
                }
            } else {
                fetchMyComplaints();
            }
        } else {
            throw new Error(data.error || 'Failed to delete complaint');
        }
    } catch (e) {
        showNotification(e.message, 'error');
    }
}
