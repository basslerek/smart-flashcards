// Firebase imports (will be loaded from CDN)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// State management
let apiKey = localStorage.getItem('openai_api_key') || '';
let flashcards = [];
let currentQuizCard = null;
let quizQueue = [];
let db = null;
let auth = null;
let userId = null;
let unsubscribe = null;

// Initialize Firebase
async function initFirebase() {
    const firebaseConfig = localStorage.getItem('firebase_config');
    
    if (!firebaseConfig) {
        return false;
    }
    
    try {
        const config = JSON.parse(firebaseConfig);
        const app = initializeApp(config);
        auth = getAuth(app);
        db = getFirestore(app);
        
        // Sign in anonymously
        await signInAnonymously(auth);
        
        onAuthStateChanged(auth, (user) => {
            if (user) {
                userId = user.uid;
                syncFromFirebase();
            }
        });
        
        return true;
    } catch (error) {
        console.error('Firebase init error:', error);
        return false;
    }
}

// Sync flashcards from Firebase
function syncFromFirebase() {
    if (!db || !userId) return;
    
    const userDocRef = doc(db, 'users', userId);
    
    // Real-time sync
    unsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            flashcards = data.flashcards || [];
            if (data.apiKey) {
                apiKey = data.apiKey;
                localStorage.setItem('openai_api_key', apiKey);
            }
            updateStats();
        }
    });
}

// Save to Firebase
async function saveToFirebase() {
    if (!db || !userId) {
        // Fallback to localStorage
        localStorage.setItem('flashcards', JSON.stringify(flashcards));
        return;
    }
    
    try {
        const userDocRef = doc(db, 'users', userId);
        await setDoc(userDocRef, {
            flashcards,
            apiKey,
            lastUpdated: Date.now()
        }, { merge: true });
    } catch (error) {
        console.error('Firebase save error:', error);
        // Fallback to localStorage
        localStorage.setItem('flashcards', JSON.stringify(flashcards));
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    // Try to init Firebase
    const firebaseReady = await initFirebase();
    
    // If no Firebase, load from localStorage
    if (!firebaseReady) {
        flashcards = JSON.parse(localStorage.getItem('flashcards')) || [];
    }
    
    if (apiKey) {
        document.getElementById('api-key').value = '••••••••';
        document.getElementById('setup-section').classList.add('hidden');
        showSection('input-section');
        showSection('deck-section');
        updateStats();
    }
});

// API Key Management
function saveApiKey() {
    const input = document.getElementById('api-key');
    const key = input.value.trim();
    
    if (!key || key === '••••••••') {
        alert('Please enter a valid API key');
        return;
    }
    
    apiKey = key;
    localStorage.setItem('openai_api_key', apiKey);
    input.value = '••••••••';
    
    // Save to Firebase if available
    saveToFirebase();
    
    document.getElementById('setup-section').classList.add('hidden');
    showSection('input-section');
    showSection('deck-section');
    updateStats();
    alert('API key saved successfully!');
}

// Firebase Config Management
async function saveFirebaseConfig() {
    const input = document.getElementById('firebase-config');
    const configText = input.value.trim();
    
    if (!configText) {
        alert('Please paste your Firebase config');
        return;
    }
    
    try {
        const config = JSON.parse(configText);
        
        // Validate required fields
        if (!config.apiKey || !config.projectId) {
            throw new Error('Invalid Firebase config');
        }
        
        localStorage.setItem('firebase_config', configText);
        alert('Firebase config saved! Reloading app...');
        
        // Reload to initialize Firebase
        window.location.reload();
    } catch (error) {
        alert('Invalid Firebase config JSON. Please check and try again.');
        console.error(error);
    }
}

// Generate flashcards using OpenAI
async function generateFlashcards() {
    const text = document.getElementById('text-input').value.trim();
    
    if (!text) {
        alert('Please paste some text first');
        return;
    }
    
    if (!apiKey) {
        alert('Please set your API key first');
        return;
    }
    
    document.getElementById('loading').classList.remove('hidden');
    
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [{
                    role: 'system',
                    content: 'You are a helpful assistant that creates flashcards. Generate 5-10 flashcards from the given text. Return ONLY a JSON array with objects containing "question" and "answer" fields. No other text.'
                }, {
                    role: 'user',
                    content: `Create flashcards from this text:\n\n${text}`
                }],
                temperature: 0.7
            })
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        const content = data.choices[0].message.content;
        
        // Parse JSON from response
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            throw new Error('Could not parse flashcards from response');
        }
        
        const newCards = JSON.parse(jsonMatch[0]);
        
        // Add SM-2 metadata to each card
        newCards.forEach(card => {
            flashcards.push({
                ...card,
                easeFactor: 2.5,
                interval: 0,
                repetitions: 0,
                nextReview: Date.now(),
                difficulty: 'easy',
                mistakes: 0
            });
        });
        
        saveFlashcards();
        updateStats();
        document.getElementById('text-input').value = '';
        alert(`Generated ${newCards.length} flashcards!`);
        
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to generate flashcards. Check your API key and try again.');
    } finally {
        document.getElementById('loading').classList.add('hidden');
    }
}

// SM-2 Algorithm (simplified)
function updateCardSchedule(card, quality) {
    // quality: 1 (hard), 3 (good), 5 (easy)
    
    if (quality < 3) {
        card.repetitions = 0;
        card.interval = 0;
        card.mistakes++;
    } else {
        if (card.repetitions === 0) {
            card.interval = 1;
        } else if (card.repetitions === 1) {
            card.interval = 6;
        } else {
            card.interval = Math.round(card.interval * card.easeFactor);
        }
        card.repetitions++;
    }
    
    card.easeFactor = Math.max(1.3, card.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    
    // Calculate next review date
    card.nextReview = Date.now() + (card.interval * 24 * 60 * 60 * 1000);
    
    // Update difficulty based on performance
    if (card.mistakes > 3) {
        card.difficulty = 'hard';
    } else if (card.repetitions > 5 && card.mistakes < 2) {
        card.difficulty = 'easy';
    } else {
        card.difficulty = 'medium';
    }
    
    saveFlashcards();
}

// Quiz functionality
function startQuiz() {
    const dueCards = flashcards.filter(card => card.nextReview <= Date.now());
    
    if (dueCards.length === 0) {
        alert('No cards due for review! Come back later.');
        return;
    }
    
    // Sort by difficulty (hard cards first for adaptive learning)
    quizQueue = dueCards.sort((a, b) => {
        const difficultyOrder = { hard: 0, medium: 1, easy: 2 };
        return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
    });
    
    hideAllSections();
    showSection('quiz-section');
    showNextCard();
}

function showNextCard() {
    if (quizQueue.length === 0) {
        endQuiz();
        return;
    }
    
    currentQuizCard = quizQueue.shift();
    
    document.getElementById('card-question').textContent = currentQuizCard.question;
    document.getElementById('card-answer').textContent = currentQuizCard.answer;
    document.getElementById('card-answer').classList.add('hidden');
    document.getElementById('quiz-controls').classList.add('hidden');
    
    // Update difficulty badge
    const badge = document.getElementById('difficulty-badge');
    badge.textContent = currentQuizCard.difficulty.charAt(0).toUpperCase() + currentQuizCard.difficulty.slice(1);
    badge.className = `difficulty-badge ${currentQuizCard.difficulty}`;
}

function flipCard() {
    document.getElementById('card-answer').classList.remove('hidden');
    document.getElementById('quiz-controls').classList.remove('hidden');
}

function rateCard(quality) {
    updateCardSchedule(currentQuizCard, quality);
    updateStats();
    showNextCard();
}

function endQuiz() {
    hideAllSections();
    showSection('input-section');
    showSection('deck-section');
    alert('Quiz completed! Great job! 🎉');
}

// Card management
function viewAllCards() {
    const listDiv = document.getElementById('card-list');
    listDiv.innerHTML = '';
    
    if (flashcards.length === 0) {
        listDiv.innerHTML = '<p>No flashcards yet. Generate some first!</p>';
    } else {
        flashcards.forEach((card, index) => {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'card-item';
            cardDiv.innerHTML = `
                <div class="card-item-question">Q: ${card.question}</div>
                <div class="card-item-answer">A: ${card.answer}</div>
                <div class="card-item-meta">
                    Difficulty: ${card.difficulty} | 
                    Repetitions: ${card.repetitions} | 
                    Mistakes: ${card.mistakes}
                </div>
            `;
            listDiv.appendChild(cardDiv);
        });
    }
    
    hideAllSections();
    showSection('list-section');
}

function closeCardList() {
    hideAllSections();
    showSection('input-section');
    showSection('deck-section');
}

// Stats
function updateStats() {
    const total = flashcards.length;
    const due = flashcards.filter(card => card.nextReview <= Date.now()).length;
    const mastered = flashcards.filter(card => card.repetitions >= 5 && card.mistakes < 2).length;
    
    document.getElementById('total-cards').textContent = total;
    document.getElementById('due-cards').textContent = due;
    document.getElementById('mastered-cards').textContent = mastered;
}

// Utility functions
function showSection(sectionId) {
    document.getElementById(sectionId).classList.remove('hidden');
}

function hideAllSections() {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.add('hidden');
    });
}

function saveFlashcards() {
    saveToFirebase();
}

function toggleSettings() {
    const setupSection = document.getElementById('setup-section');
    setupSection.classList.toggle('hidden');
}

// Make all functions globally available
window.saveApiKey = saveApiKey;
window.saveFirebaseConfig = saveFirebaseConfig;
window.generateFlashcards = generateFlashcards;
window.startQuiz = startQuiz;
window.flipCard = flipCard;
window.rateCard = rateCard;
window.endQuiz = endQuiz;
window.viewAllCards = viewAllCards;
window.closeCardList = closeCardList;
window.toggleSettings = toggleSettings;
