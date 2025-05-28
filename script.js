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
let currentStream = null;
let microphonePermissionGranted = false;

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

// Speech recognition setup
let recognition = null;
let transcriptionText = '';

// Initialize the application
function initializeApp() {
    setupEventListeners();
    renderNotes();
    updateStatistics();
    updateSettingsUI();
    setupSpeechRecognition();
    detectLocation();
    
    // Show initial tab
    showTab('grabar');
    
    // Check microphone permission on load
    checkMicrophonePermission();
}

// Check microphone permission
async function checkMicrophonePermission() {
    try {
        if (navigator.permissions) {
            const permission = await navigator.permissions.query({ name: 'microphone' });
            if (permission.state === 'granted') {
                microphonePermissionGranted = true;
                showNotification('Micrófono disponible', 'success');
            } else if (permission.state === 'denied') {
                showNotification('Permiso de micrófono denegado. Por favor, habilítalo en la configuración del navegador.', 'error');
            }
        }
    } catch (error) {
        console.log('No se puede verificar permisos de micrófono:', error);
    }
}

// Setup speech recognition
function setupSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'es-ES';
        
        recognition.onresult = function(event) {
            let finalTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }
            
            if (finalTranscript) {
                transcriptionText += finalTranscript + ' ';
            }
        };
        
        recognition.onerror = function(event) {
            console.log('Speech recognition error:', event.error);
        };
    }
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
    // Hide all tabs completely
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
        tab.classList.remove('flex');
        tab.style.display = 'none';
    });

    // Show selected tab
    const selectedTab = document.getElementById(tabName + '-tab');
    if (selectedTab) {
        selectedTab.classList.remove('hidden');
        selectedTab.style.display = 'flex';
        selectedTab.style.flexDirection = 'column';
        
        if (tabName === 'grabar') {
            selectedTab.style.justifyContent = 'center';
            selectedTab.style.alignItems = 'center';
        }
    }

    // Update navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('text-blue-500', 'bg-blue-50');
        btn.classList.add('text-gray-600');
    });

    const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeBtn) {
        activeBtn.classList.remove('text-gray-600');
        activeBtn.classList.add('text-blue-500', 'bg-blue-50');
    }

    setTimeout(() => lucide.createIcons(), 100);
}

// Recording functionality - MEJORADO
async function toggleRecording() {
    if (!isRecording) {
        await startRecording();
    } else {
        stopRecording();
    }
}

async function startRecording() {
    try {
        // Mostrar mensaje de carga
        showNotification('Solicitando acceso al micrófono...', 'info');
        
        // Verificar si el navegador soporta getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Tu navegador no soporta grabación de audio');
        }

        // Configuración de audio más compatible
        const constraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 44100
            }
        };

        // Intentar acceso básico primero
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (error) {
            // Si falla, intentar con configuración básica
            console.log('Intentando con configuración básica de audio...');
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        
        currentStream = stream;
        microphonePermissionGranted = true;
        
        // Verificar soporte para MediaRecorder
        if (!window.MediaRecorder) {
            throw new Error('Tu navegador no soporta MediaRecorder');
        }

        // Detectar formato de audio soportado
        let mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported('audio/webm')) {
            if (MediaRecorder.isTypeSupported('audio/mp4')) {
                mimeType = 'audio/mp4';
            } else if (MediaRecorder.isTypeSupported('audio/wav')) {
                mimeType = 'audio/wav';
            } else {
                mimeType = ''; // Usar formato por defecto
            }
        }
        
        // Crear MediaRecorder
        const options = mimeType ? { mimeType } : {};
        mediaRecorder = new MediaRecorder(stream, options);
        
        audioChunks = [];
        transcriptionText = '';
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { 
                type: mediaRecorder.mimeType || 'audio/wav' 
            });
            const audioUrl = URL.createObjectURL(audioBlob);
            saveNote(audioUrl);
            
            // Limpiar stream
            if (currentStream) {
                currentStream.getTracks().forEach(track => track.stop());
                currentStream = null;
            }
        };
        
        mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder error:', event.error);
            showNotification('Error en la grabación: ' + event.error, 'error');
            resetRecordingUI();
        };
        
        // Iniciar grabación
        mediaRecorder.start(1000);
        
        // Iniciar reconocimiento de voz si está disponible
        if (recognition && settings.transcription) {
            try {
                recognition.start();
            } catch (error) {
                console.log('Speech recognition no disponible:', error);
            }
        }
        
        // Update UI
        isRecording = true;
        recordingTime = 0;
        
        updateRecordingUI(true);
        
        recordingInterval = setInterval(() => {
            recordingTime++;
            updateTimer();
        }, 1000);
        
        showNotification('¡Grabación iniciada! Habla ahora', 'success');
        
    } catch (error) {
        console.error('Error starting recording:', error);
        
        let errorMessage = 'Error al acceder al micrófono';
        let suggestions = '';
        
        if (error.name === 'NotAllowedError' || error.message.includes('Permission denied')) {
            errorMessage = 'Permiso de micrófono denegado';
            suggestions = 'Ve a la configuración del navegador y permite el acceso al micrófono para este sitio.';
        } else if (error.name === 'NotFoundError') {
            errorMessage = 'No se encontró ningún micrófono';
            suggestions = 'Verifica que tu dispositivo tenga un micrófono conectado.';
        } else if (error.name === 'NotSupportedError' || error.message.includes('not supported')) {
            errorMessage = 'Grabación no soportada';
            suggestions = 'Tu navegador no soporta grabación de audio. Prueba con Chrome o Firefox.';
        } else if (error.name === 'NotReadableError') {
            errorMessage = 'Micrófono en uso';
            suggestions = 'El micrófono está siendo usado por otra aplicación. Cierra otras apps y vuelve a intentar.';
        }
        
        // Mostrar error detallado
        showNotification(errorMessage, 'error');
        if (suggestions) {
            setTimeout(() => {
                showNotification(suggestions, 'info');
            }, 2000);
        }
        
        // Mostrar botón de ayuda para permisos
        showPermissionHelp();
        
        resetRecordingUI();
    }
}

function stopRecording() {
    try {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
        
        if (recognition) {
            recognition.stop();
        }
        
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
        }
        
        resetRecordingUI();
        showNotification('Grabación finalizada correctamente', 'success');
        
    } catch (error) {
        console.error('Error stopping recording:', error);
        showNotification('Error al finalizar la grabación', 'error');
        resetRecordingUI();
    }
}

function updateRecordingUI(recording) {
    const recordBtn = document.getElementById('record-btn');
    const recordingTimer = document.getElementById('recording-timer');
    const recordingVisualizer = document.getElementById('recording-visualizer');
    const icon = recordBtn.querySelector('i');

    if (recording) {
        recordBtn.classList.remove('bg-blue-500', 'hover:bg-blue-600');
        recordBtn.classList.add('bg-red-500', 'hover:bg-red-600', 'recording-pulse', 'recording');
        
        icon.setAttribute('data-lucide', 'mic-off');
        
        recordingTimer.classList.remove('hidden');
        recordingVisualizer.classList.remove('hidden');
        
        generateWaves();
    } else {
        recordBtn.classList.remove('bg-red-500', 'hover:bg-red-600', 'recording-pulse', 'recording');
        recordBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
        
        icon.setAttribute('data-lucide', 'mic');
        
        recordingTimer.classList.add('hidden');
        recordingVisualizer.classList.add('hidden');
    }
    
    lucide.createIcons();
}

function resetRecordingUI() {
    isRecording = false;
    clearInterval(recordingInterval);
    updateRecordingUI(false);
}

function showPermissionHelp() {
    // Crear modal de ayuda para permisos
    const helpModal = document.createElement('div');
    helpModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    helpModal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 class="text-lg font-semibold mb-4">¿Cómo habilitar el micrófono?</h3>
            <div class="space-y-3 text-sm">
                <p><strong>En Chrome/Edge:</strong></p>
                <p>1. Haz clic en el ícono de candado 🔒 en la barra de direcciones</p>
                <p>2. Cambia "Micrófono" a "Permitir"</p>
                <p>3. Recarga la página</p>
                
                <p class="mt-4"><strong>En Safari (iOS):</strong></p>
                <p>1. Ve a Configuración > Safari > Cámara y micrófono</p>
                <p>2. Selecciona "Preguntar" o "Permitir"</p>
            </div>
            <button class="w-full mt-4 bg-blue-500 text-white py-2 rounded-lg" onclick="this.parentElement.parentElement.remove()">
                Entendido
            </button>
        </div>
    `;
    
    document.body.appendChild(helpModal);
    
    // Remover modal al hacer clic fuera
    helpModal.addEventListener('click', (e) => {
        if (e.target === helpModal) {
            helpModal.remove();
        }
    });
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
    
    // Usar transcripción real si está disponible
    let content = transcriptionText.trim();
    if (!content) {
        content = "Nota de audio guardada. La transcripción automática no está disponible en este momento.";
    }
    
    const newNote = {
        id: Date.now(),
        title: customTag || `Nota de voz ${notes.length + 1}`,
        content: content,
        time: timeString,
        date: dateString,
        category: detectCategory(customTag || content),
        location: getCurrentLocation(),
        duration: `${Math.floor(recordingTime / 60)}:${(recordingTime % 60).toString().padStart(2, '0')}`,
        audioUrl: audioUrl
    };
    
    notes.unshift(newNote);
    document.getElementById('custom-tag').value = '';
    
    localStorage.setItem('notes', JSON.stringify(notes));
    
    renderNotes();
    updateStatistics();
    
    showNotification('Nota guardada exitosamente', 'success');
}

function detectCategory(title) {
    const workKeywords = ['reunión', 'trabajo', 'proyecto', 'equipo', 'cliente', 'oficina', 'empresa'];
    const personalKeywords = ['compras', 'familia', 'personal', 'casa', 'cumpleaños'];
    const ideaKeywords = ['idea', 'innovación', 'concepto', 'propuesta', 'implementar'];
    const taskKeywords = ['tarea', 'pendiente', 'hacer', 'revisar', 'completar'];
    
    const titleLower = title.toLowerCase();
    
    if (workKeywords.some(keyword => titleLower.includes(keyword))) return 'trabajo';
    if (personalKeywords.some(keyword => titleLower.includes(keyword))) return 'personal';
    if (ideaKeywords.some(keyword => titleLower.includes(keyword))) return 'ideas';
    if (taskKeywords.some(keyword => titleLower.includes(keyword))) return 'tareas';
    
    return 'personal';
}

// Notes functionality
function renderNotes() {
    const container = document.getElementById('notes-container');
    const searchQuery = document.getElementById('search-notes').value.toLowerCase();
    
    let filteredNotes = notes;
    
    if (currentFilter !== 'todas') {
        filteredNotes = filteredNotes.filter(note => note.category === currentFilter);
    }
    
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
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('bg-blue-100', 'text-blue-800');
        btn.classList.add('border-gray-300');
    });
    
    const activeFilter = document.querySelector(`[data-filter="${category}"]`);
    if (activeFilter) {
        activeFilter.classList.add('bg-blue-100', 'text-blue-800');
        activeFilter.classList.remove('border-gray-300');
    }
    
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
                const locationDisplay = document.getElementById('location-display');
                if (locationDisplay) {
                    locationDisplay.textContent = 'Ubicación detectada: Actual';
                }
            },
            (error) => {
                console.error('Geolocation error:', error);
            }
        );
    }
    return 'Casa';
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
    
    const monthlyElement = document.getElementById('monthly-notes');
    const totalTimeElement = document.getElementById('total-time');
    
    if (monthlyElement) {
        monthlyElement.textContent = monthlyNotes;
    }
    
    if (totalTimeElement) {
        totalTimeElement.textContent = `${(totalMinutes / 60).toFixed(1)}h`;
    }
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
        }).catch(error => {
            console.error('Error sharing:', error);
            copyToClipboard(summaryText);
        });
    } else {
        copyToClipboard(summaryText);
    }
}

function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('Copiado al portapapeles', 'success');
        }).catch(() => {
            // Fallback method
            fallbackCopyTextToClipboard(text);
        });
    } else {
        // Fallback method for older browsers
        fallbackCopyTextToClipboard(text);
    }
}

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    
    // Avoid scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showNotification('Copiado al portapapeles', 'success');
        } else {
            showNotification('Error al copiar', 'error');
        }
    } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
        showNotification('Error al copiar', 'error');
    }
    
    document.body.removeChild(textArea);
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
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
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
        const searchInput = document.getElementById('search-notes');
        if (searchInput) {
            searchInput.focus();
        }
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

// Prevent page refresh on mobile pull-to-refresh
document.addEventListener('touchstart', handleTouchStart, { passive: true });
document.addEventListener('touchmove', handleTouchMove, { passive: false });

let xDown = null;
let yDown = null;

function handleTouchStart(evt) {
    const firstTouch = evt.touches[0];
    xDown = firstTouch.clientX;
    yDown = firstTouch.clientY;
}

function handleTouchMove(evt) {
    if (!xDown || !yDown) {
        return;
    }

    const xUp = evt.touches[0].clientX;
    const yUp = evt.touches[0].clientY;

    const xDiff = xDown - xUp;
    const yDiff = yDown - yUp;

    // Prevent pull-to-refresh on certain swipe patterns
    if (Math.abs(yDiff) > Math.abs(xDiff) && yDiff < 0 && window.scrollY === 0) {
        evt.preventDefault();
    }

    xDown = null;
    yDown = null;
}

// Error handling for unhandled promise rejections
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    showNotification('Error inesperado en la aplicación', 'error');
});

// Error handling for general errors
window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
    showNotification('Error en la aplicación', 'error');
});

// Initialize theme based on system preference
function initializeTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
    }
}

// Listen for theme changes
if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (e.matches) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    });
}

// Initialize theme on load
initializeTheme();

// Cleanup function for when the page is unloaded
window.addEventListener('beforeunload', function() {
    // Stop any ongoing recording
    if (isRecording) {
        stopRecording();
    }
    
    // Clean up any active streams
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }
    
    // Stop speech recognition
    if (recognition) {
        recognition.stop();
    }
});

// Visibility change handler (for when user switches tabs)
document.addEventListener('visibilitychange', function() {
    if (document.hidden && isRecording) {
        // Optionally pause recording when tab is hidden
        console.log('Tab hidden while recording');
    } else if (!document.hidden && isRecording) {
        // Resume or continue recording when tab is visible again
        console.log('Tab visible while recording');
    }
});

// Battery status monitoring (if supported)
if ('getBattery' in navigator) {
    navigator.getBattery().then(function(battery) {
        function updateBatteryInfo() {
            if (battery.level < 0.1 && isRecording) {
                showNotification('Batería baja. Considera finalizar la grabación.', 'warning');
            }
        }
        
        battery.addEventListener('levelchange', updateBatteryInfo);
        updateBatteryInfo();
    });
}

// Memory usage monitoring (if supported)
if ('memory' in performance) {
    setInterval(() => {
        const memInfo = performance.memory;
        const memUsage = memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit;
        
        if (memUsage > 0.9) {
            console.warn('High memory usage detected');
            showNotification('Uso alto de memoria detectado', 'warning');
        }
    }, 30000); // Check every 30 seconds
}

// Export functions for potential external use
window.VoiceNotesApp = {
    toggleRecording,
    showTab,
    renderNotes,
    showNotification,
    exportToPDF,
    shareSummary
};