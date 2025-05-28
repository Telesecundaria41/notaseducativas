// Initialize Lucide icons when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    lucide.createIcons();
    initializeApp();
});

// App state
let isRecording = false;
let recordingTime = 0;
let recordingInterval;
let currentFilter = 'todas';
let mediaRecorder = null;
let audioChunks = [];

// Sample notes data with localStorage persistence
let notes = JSON.parse(localStorage.getItem('notes')) || [
    {
        id: 1,
        title: "Reunión equipo marketing",
        content: "Discutimos la nueva campaña publicitaria. Acordamos aumentar el presupuesto en redes sociales en un 30% para el próximo trimestre. También se definió la estrategia de contenido para las próximas semanas.",
        time: "14:30",
        date: "2025-05-28",
        category: "trabajo",
        location: "Oficina",
        duration: "5:23",
        audioUrl: null
    },
    {
        id: 2,
        title: "Ideas para el proyecto",
        content: "Implementar sistema de notificaciones push para mejorar la experiencia del usuario. Considerar la integración con APIs de terceros y mejorar la interfaz de usuario con componentes más modernos.",
        time: "16:45",
        date: "2025-05-28",
        category: "ideas",
        location: "Casa",
        duration: "2:15",
        audioUrl: null
    },
    {
        id: 3,
        title: "Lista de compras",
        content: "Comprar leche, pan, huevos para el desayuno. No olvidar el cumpleaños de mamá el viernes, necesito comprar un regalo. También revisar si necesitamos más productos de limpieza.",
        time: "09:15",
        date: "2025-05-28",
        category: "personal",
        location: "Casa",
        duration: "1:30",
        audioUrl: null
    },
    {
        id: 4,
        title: "Tareas pendientes",
        content: "Revisar código del proyecto antes de la entrega. Hacer backup de archivos importantes en el servidor. Actualizar la documentación técnica del sistema.",
        time: "11:20",
        date: "2025-05-28",
        category: "tareas",
        location: "Oficina",
        duration: "3:45",
        audioUrl: null
    }
];

// Settings with localStorage persistence
let settings = JSON.parse(localStorage.getItem('settings')) || {
    transcription: true,
    location: true,
    dailySummaryTime: '20:00',
    notifications: true
};

// Initialize the application
function initializeApp() {
    setupEventListeners();
    renderNotes();
    updateStatistics();
    updateSettingsUI();
    requestMicrophonePermission();
    detectLocation();
}

// Setup all event listeners
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.currentTarget.dataset.tab;
            showTab(tab);
        });
    });

    // Recording
    document.getElementById('record-btn').addEventListener('click', toggleRecording);

    // Search
    document.getElementById('search-notes').addEventListener('input', (e) => {
        searchNotes(e.target.value);
    });

    // Filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const filter = e.currentTarget.dataset.filter;
            filterNotes(filter);
        });
    });

    // Settings toggles
    document.querySelectorAll('.toggle-switch').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            const setting = e.currentTarget.dataset.setting;
            toggleSetting(setting);
        });
    });

    // Export and share buttons
    document.getElementById('export-pdf').addEventListener('click', exportToPDF);
    document.getElementById('share-summary').addEventListener('click', shareSummary);

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

// Navigation functionality
function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
        tab.classList.remove('flex');
    });

    // Show selected tab
    const selectedTab = document.getElementById(tabName + '-tab');
    selectedTab.classList.remove('hidden');
    if (tabName === 'grabar') {
        selectedTab.classList.add('flex');
    } else {
        selectedTab.classList.add('flex');
        selectedTab.style.display = 'flex';
        selectedTab.style.flexDirection = 'column';
    }

    // Update navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('text-blue-500', 'bg-blue-50');
        btn.classList.add('text-gray-600');
    });

    const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
    activeBtn.classList.remove('text-gray-600');
    activeBtn.classList.add('text-blue-500', 'bg-blue-50');

    // Refresh icons after tab change
    setTimeout(() => lucide.createIcons(), 100);
}

// Recording functionality
async function requestMicrophonePermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        console.log('Microphone permission granted');
    } catch (error) {
        console.error('Microphone permission denied:', error);
        showNotification('Permiso de micrófono requerido para grabar notas', 'error');
    }
}

async function toggleRecording() {
    if (!isRecording) {
        await startRecording();
    } else {
        stopRecording();
    }
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(audioBlob);
            saveNote(audioUrl);
        };
        
        mediaRecorder.start();
        
        // Update UI
        isRecording = true;
        recordingTime = 0;
        
        const recordBtn = document.getElementById('record-btn');
        const recordingTimer = document.getElementById('recording-timer');
        const recordingVisualizer = document.getElementById('recording-visualizer');
        const icon = recordBtn.querySelector('i');

        recordBtn.classList.remove('bg-blue-500', 'hover:bg-blue-600');
        recordBtn.classList.add('bg-red-500', 'hover:bg-red-600', 'recording-pulse', 'recording');
        
        icon.setAttribute('data-lucide', 'mic-off');
        lucide.createIcons();
        
        recordingTimer.classList.remove('hidden');
        recordingVisualizer.classList.remove('hidden');
        
        generateWaves();
        
        recordingInterval = setInterval(() => {
            recordingTime++;
            updateTimer();
        }, 1000);
        
        showNotification('Grabación iniciada', 'success');
        
    } catch (error) {
        console.error('Error starting recording:', error);
        showNotification('Error al iniciar la grabación', 'error');
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    
    // Update UI
    const recordBtn = document.getElementById('record-btn');
    const recordingTimer = document.getElementById('recording-timer');
    const recordingVisualizer = document.getElementById('recording-visualizer');
    const icon = recordBtn.querySelector('i');

    isRecording = false;
    clearInterval(recordingInterval);
    
    recordBtn.classList.remove('bg-red-500', 'hover:bg-red-600', 'recording-pulse', 'recording');
    recordBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
    
    icon.setAttribute('data-lucide', 'mic');
    lucide.createIcons();
    
    recordingTimer.classList.add('hidden');
    recordingVisualizer.classList.add('hidden');
    
    showNotification('Grabación finalizada', 'success');
}

function updateTimer() {
    const minutes = Math.floor(recordingTime / 60);
    const seconds = recordingTime % 60;
    const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('timer-display').textContent = display;
}

function generateWaves() {
    const container = document.getElementById('wave-container');
    container.innerHTML = '';
    
    for (let i = 0; i < 25; i++) {
        const wave = document.createElement('div');
        wave.className = 'w-1 bg-blue-400 rounded-full wave-bar';
        wave.style.height = `${Math.random() * 25 + 8}px`;
        wave.style.animationDelay = `${i * 0.05}s`;
        wave.style.animationDuration = `${0.8 + Math.random() * 0.4}s`;
        container.appendChild(wave);
    }
}

function saveNote(audioUrl = null) {
    const customTag = document.getElementById('custom-tag').value.trim();
    const now = new Date();
    const timeString = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const dateString = now.toISOString().split('T')[0];
    
    const newNote = {
        id: Date.now(),
        title: customTag || `Nota de voz ${notes.length + 1}`,
        content: "Transcripción automática en proceso... Esta nota fue grabada y será procesada para generar el texto correspondiente.",
        time: timeString,
        date: dateString,
        category: detectCategory(customTag),
        location: getCurrentLocation(),
        duration: `${Math.floor(recordingTime / 60)}:${(recordingTime % 60).toString().padStart(2, '0')}`,
        audioUrl: audioUrl
    };
    
    notes.unshift(newNote);
    document.getElementById('custom-tag').value = '';
    
    // Save to localStorage
    localStorage.setItem('notes', JSON.stringify(notes));
    
    renderNotes();
    updateStatistics();
    
    // Simulate transcription after a delay
    setTimeout(() => {
        simulateTranscription(newNote.id);
    }, 2000);
    
    showNotification('Nota guardada exitosamente', 'success');
}

function detectCategory(title) {
    const workKeywords = ['reunión', 'trabajo', 'proyecto', 'equipo', 'cliente'];
    const personalKeywords = ['compras', 'familia', 'personal', 'casa'];
    const ideaKeywords = ['idea', 'innovación', 'concepto', 'propuesta'];
    const taskKeywords = ['tarea', 'pendiente', 'hacer', 'revisar'];
    
    const titleLower = title.toLowerCase();
    
    if (workKeywords.some(keyword => titleLower.includes(keyword))) return 'trabajo';
    if (personalKeywords.some(keyword => titleLower.includes(keyword))) return 'personal';
    if (ideaKeywords.some(keyword => titleLower.includes(keyword))) return 'ideas';
    if (taskKeywords.some(keyword => titleLower.includes(keyword))) return 'tareas';
    
    return 'personal';
}

function simulateTranscription(noteId) {
    const note = notes.find(n => n.id === noteId);
    if (note) {
        const transcriptions = [
            "En esta reunión discutimos los objetivos del próximo trimestre y las estrategias de marketing digital que implementaremos.",
            "Ideas importantes para mejorar la experiencia del usuario en nuestra aplicación móvil y web.",
            "Lista de tareas pendientes para completar antes del fin de semana, incluyendo revisiones de código.",
            "Notas personales sobre planificación familiar y actividades del fin de semana."
        ];
        
        note.content = transcriptions[Math.floor(Math.random() * transcriptions.length)];
        localStorage.setItem('notes', JSON.stringify(notes));
        renderNotes();
        showNotification('Transcripción completada', 'info');
    }
}

// Notes functionality
function renderNotes() {
    const container = document.getElementById('notes-container');
    const searchQuery = document.getElementById('search-notes').value.toLowerCase();
    
    let filteredNotes = notes;
    
    // Apply category filter
    if (currentFilter !== 'todas') {
        filteredNotes = filteredNotes.filter(note => note.category === currentFilter);
    }
    
    // Apply search filter
    if (searchQuery) {
        filteredNotes = filteredNotes.filter(note => 
            note.title.toLowerCase().includes(searchQuery) ||
            note.content.toLowerCase().includes(searchQuery)
        );
    }
    
    container.innerHTML = '';
    
    if (filteredNotes.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8">
                <i data-lucide="file-text" class="w-12 h-12 text-gray-300 mx-auto mb-4"></i>
                <p class="text-gray-500">No se encontraron notas</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }
    
    filteredNotes.forEach((note, index) => {
        const noteElement = document.createElement('div');
        noteElement.className = 'bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow note-loading';
        noteElement.style.animationDelay = `${index * 0.1}s`;
        
        const categoryColors = {
            trabajo: 'category-trabajo',
            personal: 'category-personal',
            ideas: 'category-ideas',
            tareas: 'category-tareas'
        };
        
        noteElement.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <h3 class="font-semibold text-gray-800 flex-1 mr-2">${note.title}</h3>
                <span class="px-2 py-1 rounded-full text-xs font-medium ${categoryColors[note.category] || 'bg-gray-100 text-gray-800'} whitespace-nowrap">${note.category}</span>
            </div>
            
            <p class="text-gray-600 text-sm mb-3 line-clamp-2">${note.content}</p>
            
            <div class="flex items-center justify-between text-xs text-gray-500">
                <div class="flex items-center space-x-3">
                    <div class="flex items-center">
                        <i data-lucide="clock" class="w-3 h-3 mr-1"></i>
                        <span>${note.time}</span>
                    </div>
                    <div class="flex items-center">
                        <i data-lucide="map-pin" class="w-3 h-3 mr-1"></i>
                        <span>${note.location}</span>
                    </div>
                </div>
                <div class="flex items-center space-x-2">
                    <span>${note.duration}</span>
                    ${note.audioUrl ? `
                        <button class="p-1 hover:bg-gray-100 rounded play-audio" data-audio="${note.audioUrl}">
                            <i data-lucide="play" class="w-3 h-3"></i>
                        </button>
                    ` : ''}
                    <button class="p-1 hover:bg-gray-100 rounded share-note" data-note-id="${note.id}">
                        <i data-lucide="share-2" class="w-3 h-3"></i>
                    </button>
                    <button class="p-1 hover:bg-gray-100 rounded delete-note" data-note-id="${note.id}">
                        <i data-lucide="trash-2" class="w-3 h-3"></i>
                    </button>
                </div>
            </div>
        `;
        
        container.appendChild(noteElement);
    });
    
    // Add event listeners for note actions
    document.querySelectorAll('.play-audio').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const audioUrl = e.currentTarget.dataset.audio;
            playAudio(audioUrl);
        });
    });
    
    document.querySelectorAll('.share-note').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const noteId = parseInt(e.currentTarget.dataset.noteId);
            shareNote(noteId);
        });
    });
    
    document.querySelectorAll('.delete-note').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const noteId = parseInt(e.currentTarget.dataset.noteId);
            deleteNote(noteId);
        });
    });
    
    lucide.createIcons();
}

function filterNotes(category) {
    currentFilter = category;
    
    // Update filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('bg-blue-100', 'text-blue-800');
        btn.classList.add('border-gray-300');
    });
    
    const activeFilter = document.querySelector(`[data-filter="${category}"]`);
    activeFilter.classList.add('bg-blue-100', 'text-blue-800');
    activeFilter.classList.remove('border-gray-300');
    
    renderNotes();
}

function searchNotes(query) {
    renderNotes();
}

function playAudio(audioUrl) {
    const audio = new Audio(audioUrl);
    audio.play().catch(error => {
        console.error('Error playing audio:', error);
        showNotification('Error al reproducir audio', 'error');
    });
}

function shareNote(noteId) {
    const note = notes.find(n => n.id === noteId);
    if (note && navigator.share) {
        navigator.share({
            title: note.title,
            text: note.content,
            url: window.location.href
        }).catch(error => {
            console.error('Error sharing:', error);
            copyToClipboard(`${note.title}\n\n${note.content}`);
        });
    } else {
        copyToClipboard(`${note.title}\n\n${note.content}`);
    }
}

function deleteNote(noteId) {
    if (confirm('¿Estás seguro de que quieres eliminar esta nota?')) {
        notes = notes.filter(n => n.id !== noteId);
        localStorage.setItem('notes', JSON.stringify(notes));
        renderNotes();
        updateStatistics();
        showNotification('Nota eliminada', 'success');
    }
}

// Settings functionality
function toggleSetting(setting) {
    settings[setting] = !settings[setting];
    localStorage.setItem('settings', JSON.stringify(settings));
    updateSettingsUI();
    showNotification(`${setting} ${settings[setting] ? 'activado' : 'desactivado'}`, 'info');
}

function updateSettingsUI() {
    document.querySelectorAll('.toggle-switch').forEach(toggle => {
        const setting = toggle.dataset.setting;
        const circle = toggle.querySelector('.toggle-circle');
        
        if (settings[setting]) {
            toggle.classList.add('active');
            toggle.classList.remove('inactive');
        } else {
            toggle.classList.add('inactive');
            toggle.classList.remove('active');
        }
    });
}

// Utility functions
function getCurrentLocation() {
    if (settings.location && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                // In a real app, you would reverse geocode the coordinates
                document.getElementById('location-display').textContent = 'Ubicación detectada: Actual';
            },
            (error) => {
                console.error('Geolocation error:', error);
            }
        );
    }
    return 'Casa'; // Default location
}

function detectLocation() {
    if (settings.location) {
        getCurrentLocation();
    }
}

function updateStatistics() {
    const monthlyNotes = notes.filter(note => {
        const noteDate = new Date(note.date);
        const currentDate = new Date();
        return noteDate.getMonth() === currentDate.getMonth() && 
               noteDate.getFullYear() === currentDate.getFullYear();
    }).length;
    
    const totalMinutes = notes.reduce((total, note) => {
        const [minutes, seconds] = note.duration.split(':').map(Number);
        return total + minutes + (seconds / 60);
    }, 0);
    
    document.getElementById('monthly-notes').textContent = monthlyNotes;
    document.getElementById('total-time').textContent = `${(totalMinutes / 60).toFixed(1)}h`;
}

function exportToPDF() {
    showNotification('Función de exportación en desarrollo', 'info');
}

function shareSummary() {
    const summaryText = "Resumen diario de notas educativas - 28 de Mayo, 2025";
    if (navigator.share) {
        navigator.share({
            title: 'Resumen Diario',
            text: summaryText,
            url: window.location.href
        });
    } else {
        copyToClipboard(summaryText);
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Copiado al portapapeles', 'success');
    }).catch(() => {
        showNotification('Error al copiar', 'error');
    });
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm transform transition-all duration-300 translate-x-full`;
    
    const colors = {
        success: 'bg-green-500 text-white',
        error: 'bg-red-500 text-white',
        info: 'bg-blue-500 text-white',
        warning: 'bg-yellow-500 text-black'
    };
    
    notification.classList.add(...colors[type].split(' '));
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.classList.remove('translate-x-full');
    }, 100);
    
    // Animate out and remove
    setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

function handleKeyboardShortcuts(e) {
    // Space bar to toggle recording (when not in input field)
    if (e.code === 'Space' && !e.target.matches('input, textarea')) {
        e.preventDefault();
        toggleRecording();
    }
    
    // Escape to stop recording
    if (e.code === 'Escape' && isRecording) {
        stopRecording();
    }
    
    // Ctrl/Cmd + F to focus search
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyF') {
        e.preventDefault();
        document.getElementById('search-notes').focus();
    }
}

// Service Worker registration for PWA functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// Handle online/offline status
window.addEventListener('online', () => {
    showNotification('Conexión restaurada', 'success');
});

window.addEventListener('offline', () => {
    showNotification('Sin conexión a internet', 'warning');
});