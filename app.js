// Firebase imports (will be loaded from CDN)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, setDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

// State management
let apiKey = localStorage.getItem('openai_api_key') || '';
let selectedModel = localStorage.getItem('openai_model') || 'gpt-3.5-turbo';
let flashcards = [];
let currentQuizCard = null;
let quizQueue = [];
let db = null;
let auth = null;
let userId = null;
let unsubscribe = null;

// Initialize Firebase
async function initFirebase() {
    try {
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        
        // Check if user is already logged in
        return new Promise((resolve) => {
            onAuthStateChanged(auth, (user) => {
                if (user) {
                    userId = user.uid;
                    console.log('User logged in:', user.email);
                    syncFromFirebase();
                    resolve(true);
                } else {
                    console.log('No user logged in');
                    resolve(false);
                }
            });
        });
    } catch (error) {
        console.error('Firebase init error:', error);
        return false;
    }
}

// Login function
async function login() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();
    
    if (!email || !password) {
        alert('Please enter email and password');
        return;
    }
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
        document.getElementById('auth-section').classList.add('hidden');
        showSection('deck-section');
        alert('Logged in successfully!');
    } catch (error) {
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            alert('Invalid email or password');
        } else {
            alert('Login error: ' + error.message);
        }
        console.error('Login error:', error);
    }
}

// Signup function
async function signup() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();
    
    if (!email || !password) {
        alert('Please enter email and password');
        return;
    }
    
    if (password.length < 6) {
        alert('Password must be at least 6 characters');
        return;
    }
    
    try {
        await createUserWithEmailAndPassword(auth, email, password);
        document.getElementById('auth-section').classList.add('hidden');
        showSection('deck-section');
        alert('Account created successfully!');
    } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
            alert('Email already in use. Try logging in instead.');
        } else if (error.code === 'auth/invalid-email') {
            alert('Invalid email address');
        } else {
            alert('Signup error: ' + error.message);
        }
        console.error('Signup error:', error);
    }
}

// Sync flashcards from Firebase
function syncFromFirebase() {
    if (!db || !userId) return;
    
    const userDocRef = doc(db, 'users', userId);
    
    // Real-time sync
    unsubscribe = onSnapshot(userDocRef, (docSnap) => {
        console.log('Firebase sync triggered');
        if (docSnap.exists()) {
            const data = docSnap.data();
            flashcards = data.flashcards || [];
            console.log(`Loaded ${flashcards.length} cards from Firebase`);
            
            if (data.apiKey) {
                apiKey = data.apiKey;
                localStorage.setItem('openai_api_key', apiKey);
                const apiKeyInput = document.getElementById('api-key');
                if (apiKeyInput) apiKeyInput.value = '••••••••';
                document.getElementById('auth-section').classList.add('hidden');
                document.getElementById('setup-section').classList.add('hidden');
                showSection('deck-section');
            } else {
                // User logged in but no API key set
                document.getElementById('auth-section').classList.add('hidden');
                document.getElementById('setup-section').classList.remove('hidden');
            }
            if (data.model) {
                selectedModel = data.model;
                localStorage.setItem('openai_model', selectedModel);
                const setupSelect = document.getElementById('model-select');
                const mainSelect = document.getElementById('model-select-main');
                if (setupSelect) setupSelect.value = selectedModel;
                if (mainSelect) mainSelect.value = selectedModel;
            }
            updateStats();
            
            // Update sync status
            const syncStatus = document.getElementById('sync-status');
            if (syncStatus) {
                syncStatus.textContent = `✓ Synced with Firebase (${flashcards.length} cards)`;
                syncStatus.style.color = '#4a9eff';
            }
        } else {
            console.log('No Firebase data found');
            // No data in Firebase yet - show setup if no local API key
            if (!apiKey) {
                document.getElementById('setup-section').classList.remove('hidden');
            }
            
            const syncStatus = document.getElementById('sync-status');
            if (syncStatus) {
                syncStatus.textContent = 'No data in Firebase yet';
                syncStatus.style.color = '#888';
            }
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
            model: selectedModel,
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
    console.log('App initializing...');
    // Show loading state
    document.getElementById('setup-section').innerHTML = '<h2>Loading...</h2><p>Connecting to Firebase...</p>';
    
    // Try to init Firebase
    const firebaseReady = await initFirebase();
    console.log('Firebase ready:', firebaseReady);
    
    // Restore setup section content
    document.getElementById('setup-section').innerHTML = `
        <h2>Setup</h2>
        <form onsubmit="event.preventDefault(); saveApiKey();">
            <div class="input-group">
                <input type="password" id="api-key" placeholder="Enter your OpenAI API key" autocomplete="off">
                <button type="submit">Save Key</button>
            </div>
        </form>
        <p class="hint">Your API key syncs across all your devices via Firebase</p>
        
        <div style="margin-top: 20px;">
            <label for="model-select" style="display: block; margin-bottom: 8px; font-weight: 600;">AI Model:</label>
            <select id="model-select" onchange="saveModel()" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 1em;">
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Fast, Cheap)</option>
                <option value="gpt-4o-mini">GPT-4o Mini (Balanced)</option>
                <option value="gpt-4o">GPT-4o (Best Quality)</option>
                <option value="gpt-4-turbo">GPT-4 Turbo (Premium)</option>
            </select>
            <p class="hint">Cheaper models work fine for flashcards. Change if you hit rate limits.</p>
        </div>
    `;
    
    // Restore model selection
    const setupSelect = document.getElementById('model-select');
    const mainSelect = document.getElementById('model-select-main');
    if (setupSelect) setupSelect.value = selectedModel;
    if (mainSelect) mainSelect.value = selectedModel;
    
    // If user not logged in, show auth screen
    if (!firebaseReady) {
        document.getElementById('setup-section').classList.add('hidden');
        document.getElementById('auth-section').classList.remove('hidden');
    } else {
        document.getElementById('auth-section').classList.add('hidden');
        // Check if API key is set
        if (apiKey) {
            const apiKeyInput = document.getElementById('api-key');
            if (apiKeyInput) apiKeyInput.value = '••••••••';
            document.getElementById('setup-section').classList.add('hidden');
            showSection('deck-section');
            updateStats();
        } else {
            // Show setup to enter API key
            document.getElementById('setup-section').classList.remove('hidden');
        }
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
    showSection('deck-section');
    updateStats();
    alert('API key saved successfully!');
}

function saveModel() {
    const select = document.getElementById('model-select');
    if (select) {
        selectedModel = select.value;
        localStorage.setItem('openai_model', selectedModel);
        saveToFirebase();
        // Sync with main selector
        const mainSelect = document.getElementById('model-select-main');
        if (mainSelect) mainSelect.value = selectedModel;
    }
}

function saveModelMain() {
    const select = document.getElementById('model-select-main');
    if (select) {
        selectedModel = select.value;
        localStorage.setItem('openai_model', selectedModel);
        saveToFirebase();
        // Sync with setup selector
        const setupSelect = document.getElementById('model-select');
        if (setupSelect) setupSelect.value = selectedModel;
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
    
    // Retry logic for rate limits
    let retries = 3;
    let delay = 2000; // Start with 2 seconds
    
    for (let i = 0; i < retries; i++) {
        try {
            if (i > 0) {
                document.getElementById('loading').textContent = `Rate limited, retrying in ${delay/1000}s... (${i}/${retries})`;
                await new Promise(resolve => setTimeout(resolve, delay));
                document.getElementById('loading').textContent = 'Generating flashcards...';
            }
            
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: selectedModel,
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
                if (response.status === 429 && i < retries - 1) {
                    delay *= 2; // Double the delay for next retry
                    continue; // Retry
                }
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
            document.getElementById('loading').classList.add('hidden');
            alert(`Generated ${newCards.length} flashcards!`);
            closeGenerateSection();
            return; // Success, exit retry loop
            
        } catch (error) {
            if (i === retries - 1) {
                // Last retry failed
                console.error('Error:', error);
                document.getElementById('loading').classList.add('hidden');
                alert('Failed to generate flashcards. Rate limit exceeded. Please wait a minute and try again.');
                return;
            }
            // Continue to next retry
            delay *= 2;
        }
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

// Learning session functionality
function startQuiz() {
    const dueCards = flashcards.filter(card => card.nextReview <= Date.now());
    
    if (dueCards.length === 0) {
        alert('No cards due for review! Come back later or add more cards.');
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
    showSection('deck-section');
    alert('Learning session completed! Great job! 🎉');
}

// Card management
function viewAllCards() {
    const listDiv = document.getElementById('card-list');
    listDiv.innerHTML = '';
    
    if (flashcards.length === 0) {
        listDiv.innerHTML = '<p>No flashcards yet. Generate some first!</p>';
    } else {
        flashcards.forEach((card, index) => {
            const nextReviewDate = new Date(card.nextReview);
            const isOverdue = card.nextReview <= Date.now();
            
            const cardDiv = document.createElement('div');
            cardDiv.className = 'card-item';
            cardDiv.id = `card-${index}`;
            cardDiv.innerHTML = `
                <div id="card-view-${index}">
                    <div class="card-item-question"><strong>Q:</strong> ${escapeHtml(card.question)}</div>
                    <div class="card-item-answer"><strong>A:</strong> ${escapeHtml(card.answer)}</div>
                    <div class="card-item-meta">
                        Difficulty: <span class="difficulty-badge ${card.difficulty}">${card.difficulty}</span> | 
                        Repetitions: ${card.repetitions} | 
                        Mistakes: ${card.mistakes} | 
                        Next review: ${isOverdue ? '<strong>Due now</strong>' : nextReviewDate.toLocaleDateString()}
                    </div>
                    <div style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap;">
                        <button onclick="editCard(${index})" class="secondary-btn" style="padding: 6px 12px; font-size: 0.9em;">✏️ Edit</button>
                        <button onclick="resetCard(${index})" class="secondary-btn" style="padding: 6px 12px; font-size: 0.9em;">🔄 Reset Progress</button>
                        <button onclick="deleteCard(${index})" class="secondary-btn" style="padding: 6px 12px; font-size: 0.9em; background: #dc3545; color: white;">🗑️ Delete</button>
                    </div>
                </div>
                <div id="card-edit-${index}" class="hidden" style="background: #f0f0f0; padding: 15px; border-radius: 8px;">
                    <div style="margin-bottom: 10px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600;">Question:</label>
                        <input type="text" id="edit-question-${index}" value="${escapeHtml(card.question)}" style="width: 100%; padding: 8px; border: 2px solid #e0e0e0; border-radius: 6px;">
                    </div>
                    <div style="margin-bottom: 10px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600;">Answer:</label>
                        <textarea id="edit-answer-${index}" style="width: 100%; padding: 8px; border: 2px solid #e0e0e0; border-radius: 6px; min-height: 80px;">${escapeHtml(card.answer)}</textarea>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="saveCardEdit(${index})" class="primary-btn" style="padding: 6px 12px; font-size: 0.9em;">💾 Save</button>
                        <button onclick="cancelCardEdit(${index})" class="secondary-btn" style="padding: 6px 12px; font-size: 0.9em;">Cancel</button>
                    </div>
                </div>
            `;
            listDiv.appendChild(cardDiv);
        });
    }
    
    hideAllSections();
    showSection('list-section');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showAddCardForm() {
    document.getElementById('add-card-form').classList.remove('hidden');
    document.getElementById('new-question').focus();
}

function cancelAddCard() {
    document.getElementById('add-card-form').classList.add('hidden');
    document.getElementById('new-question').value = '';
    document.getElementById('new-answer').value = '';
}

function addCard() {
    const question = document.getElementById('new-question').value.trim();
    const answer = document.getElementById('new-answer').value.trim();
    
    if (!question || !answer) {
        alert('Please enter both question and answer');
        return;
    }
    
    flashcards.push({
        question,
        answer,
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        nextReview: Date.now(),
        difficulty: 'easy',
        mistakes: 0
    });
    
    saveFlashcards();
    updateStats();
    cancelAddCard();
    viewAllCards();
    alert('Card added successfully!');
}

function editCard(index) {
    document.getElementById(`card-view-${index}`).classList.add('hidden');
    document.getElementById(`card-edit-${index}`).classList.remove('hidden');
    document.getElementById(`edit-question-${index}`).focus();
}

function cancelCardEdit(index) {
    document.getElementById(`card-view-${index}`).classList.remove('hidden');
    document.getElementById(`card-edit-${index}`).classList.add('hidden');
}

function saveCardEdit(index) {
    const newQuestion = document.getElementById(`edit-question-${index}`).value.trim();
    const newAnswer = document.getElementById(`edit-answer-${index}`).value.trim();
    
    if (!newQuestion || !newAnswer) {
        alert('Question and answer cannot be empty');
        return;
    }
    
    flashcards[index].question = newQuestion;
    flashcards[index].answer = newAnswer;
    saveFlashcards();
    viewAllCards();
}

function resetCard(index) {
    if (confirm('Reset learning progress for this card?')) {
        flashcards[index].easeFactor = 2.5;
        flashcards[index].interval = 0;
        flashcards[index].repetitions = 0;
        flashcards[index].nextReview = Date.now();
        flashcards[index].difficulty = 'easy';
        flashcards[index].mistakes = 0;
        
        saveFlashcards();
        updateStats();
        viewAllCards();
        alert('Card progress reset!');
    }
}

function deleteCard(index) {
    if (confirm('Delete this card permanently?')) {
        flashcards.splice(index, 1);
        saveFlashcards();
        updateStats();
        viewAllCards();
        alert('Card deleted!');
    }
}

function closeCardList() {
    hideAllSections();
    showSection('deck-section');
}

function showGenerateSection() {
    hideAllSections();
    const section = document.getElementById('input-section');
    section.style.display = 'block';
    section.classList.remove('hidden');
}

function closeGenerateSection() {
    const section = document.getElementById('input-section');
    section.style.display = 'none';
    section.classList.add('hidden');
    hideAllSections();
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
window.login = login;
window.signup = signup;
window.saveApiKey = saveApiKey;
window.saveModel = saveModel;
window.saveModelMain = saveModelMain;
window.generateFlashcards = generateFlashcards;
window.startQuiz = startQuiz;
window.flipCard = flipCard;
window.rateCard = rateCard;
window.endQuiz = endQuiz;
window.viewAllCards = viewAllCards;
window.closeCardList = closeCardList;
window.toggleSettings = toggleSettings;
window.showGenerateSection = showGenerateSection;
window.closeGenerateSection = closeGenerateSection;
window.showAddCardForm = showAddCardForm;
window.cancelAddCard = cancelAddCard;
window.addCard = addCard;
window.editCard = editCard;
window.saveCardEdit = saveCardEdit;
window.cancelCardEdit = cancelCardEdit;
window.resetCard = resetCard;
window.deleteCard = deleteCard;
