// --- 資料庫 ---
let vocabulary = [
  {
        word: "apple",
        definitions: [{
            pos: "(n.)",
            meaning: "蘋果",
            example: {
                en: "An apple a day keeps the doctor away.",
                zh: "一天一蘋果，醫生遠離我。"
            }
        }],
        synonyms: ["pome"]
    },
    {
        word: "book",
        definitions: [
            {
                pos: "(n.)",
                meaning: "書本",
                example: { en: "I am reading an interesting book.", zh: "我正在讀一本有趣的書。" }
            },
            {
                pos: "(v.)",
                meaning: "預定",
                example: { en: "I'd like to book a table for two.", zh: "我想預定一張兩人桌。" }
            }
        ],
        synonyms: ["volume", "reserve"]
    },
    {
        word: "cat",
        definitions: [{
            pos: "(n.)",
            meaning: "貓",
            example: {
                en: "The cat is sleeping on the sofa.",
                zh: "那隻貓正在沙發上睡覺。"
            }
        }],
        synonyms: ["feline", "kitty"]
    },
    {
        word: "dog",
        definitions: [{
            pos: "(n.)",
            meaning: "狗",
            example: {
                en: "My dog likes to play fetch.",
                zh: "我的狗喜歡玩接球遊戲。"
            }
        }],
        synonyms: ["canine", "puppy"]
    },
    {
        word: "elephant",
        definitions: [{
            pos: "(n.)",
            meaning: "大象",
            example: {
                en: "The elephant is the largest land animal.",
                zh: "大象是最大的陸地動物。"
            }
        }],
        synonyms: ["pachyderm"]
    }
];

// --- 全域變數和狀態管理 ---
let organizedWords = {};
let currentFlashcardUnit = [];
let currentCardIndex = 0;
let currentWordObject = null;
let currentSessionInfo = { letter: null, unit: null, type: 'normal' };
let practiceSettings = { type: 'balloon' };
let selectedUnits = {};
let balloonGameManager = {};
let monsterGameManager = {};
let synthesisVoice = null;
let favoriteFolders = [new Set(), new Set(), new Set(), new Set(), new Set()];
let userAddedWordsSet = new Set();

// --- 頁面導航 & 彈出視窗 ---
function showPage(pageId) {
    document.querySelectorAll('#app > div, .monster-game-screen, #potion-game-wrapper').forEach(page => page.classList.add('hidden'));
    const targetPage = document.getElementById(pageId);
    if (targetPage) targetPage.classList.remove('hidden');

    document.body.style.backgroundColor = '#fffde7'; 
    if (pageId === 'practice-setup-page') document.body.style.backgroundColor = '#ffe5ec'; 
    else if(pageId === 'practice-quiz-page' || pageId === 'balloon-game-page') document.body.style.backgroundColor = '#e2efff';

    if (pageId === 'learn-main-page') renderMajorUnits();
    if (pageId === 'favorite-folders-page') renderFavoriteFolders();
    if (pageId === 'practice-setup-page') {
        initializePracticeSetup();
        document.getElementById('fx-container').innerHTML = '';
    }
    if (pageId === 'success-page') triggerSuccessPageConfetti();
}

function openModal(modalId) { document.getElementById(modalId).classList.remove('hidden'); }
function closeModal(modalId) { document.getElementById(modalId).classList.add('hidden'); }

// --- 搜尋 & 新增/編輯單字邏輯 ---
function searchWord() {
    const input = document.getElementById('search-input');
    const searchTerm = input.value.trim().toLowerCase();
    if (!searchTerm) return;

    const foundWord = vocabulary.find(v => v.word.toLowerCase() === searchTerm);
    if (foundWord) {
        const letter = foundWord.word[0].toUpperCase();
        let unitNum, wordIndex;
        const units = organizedWords[letter] || {};
        for (const uNum in units) {
            const index = units[uNum].findIndex(w => w.word === foundWord.word);
            if (index !== -1) {
                unitNum = uNum;
                wordIndex = index;
                break;
            }
        }
        if (unitNum !== undefined) {
            startFlashcardSession(letter, unitNum, wordIndex);
        }
    } else {
        showConfirmModal('無收錄單字', `是否要新增單字 "${searchTerm}" 至資料庫？`, () => openWordForm(null, searchTerm));
    }
    input.value = '';
}

function openWordForm(wordData = null, newWord = '') {
    closeModal('confirm-modal');
    const container = document.getElementById('definitions-container');
    container.innerHTML = '';
    
    document.getElementById('word-form-title').textContent = wordData ? '編輯單字' : '新增單字';
    document.getElementById('word-form-en').value = wordData ? wordData.word : newWord;
    document.getElementById('word-form-synonyms').value = wordData && wordData.synonyms ? wordData.synonyms.join(', ') : '';
    
    if (wordData && wordData.definitions) {
        wordData.definitions.forEach(def => addDefinitionBlock(def));
    } else {
        addDefinitionBlock();
    }

    const saveBtn = document.getElementById('word-form-save-btn');
    if (wordData) {
        saveBtn.onclick = () => saveWordChanges(wordData.word);
    } else {
        saveBtn.onclick = saveNewWord;
    }

    openModal('word-form-modal');
}

function openEditWordModal() {
    openWordForm(currentWordObject);
}

function addDefinitionBlock(definition = {}) {
    const container = document.getElementById('definitions-container');
    const block = document.createElement('div');
    block.className = 'definition-block border-t pt-4 mt-4 relative';
    const pos = definition.pos ? definition.pos.replace(/[()]/g, '') : '';
    block.innerHTML = `
        <button onclick="this.parentElement.remove()" class="absolute top-4 right-0 text-red-400 hover:text-red-600 text-lg"><i class="fas fa-times-circle"></i></button>
        <div><label class="font-semibold">詞性 <span class="text-red-500">*</span></label><input type="text" class="new-word-pos w-full p-2 border rounded mt-1" placeholder="n., v., adj..." value="${pos}"></div>
        <div class="mt-2"><label class="font-semibold">中文意思 <span class="text-red-500">*</span></label><input type="text" class="new-word-meaning w-full p-2 border rounded mt-1" placeholder="請輸入中文意思..." value="${definition.meaning || ''}"></div>
        <div class="mt-2"><label class="font-semibold">英文例句 <span class="text-red-500">*</span></label><textarea class="new-word-ex-en w-full p-2 border rounded mt-1" rows="2" placeholder="請輸入英文例句...">${(definition.example && definition.example.en) || ''}</textarea></div>
        <div class="mt-2"><label class="font-semibold">中文例句</label><textarea class="new-word-ex-zh w-full p-2 border rounded mt-1" rows="2" placeholder="請輸入中文例句...">${(definition.example && definition.example.zh) || ''}</textarea></div>
    `;
    container.appendChild(block);
}

function validateAndGetWordFormData() {
    const definitionBlocks = document.querySelectorAll('#word-form-modal .definition-block');
    const synonymsInput = document.getElementById('word-form-synonyms').value.trim();
    const newDefinitions = [];

    const validPOSRegex = /^[a-zA-Z\.]+(,\s*[a-zA-Z\.]+)*$/;
    const onlyChineseRegex = /^[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]+$/;
    const validEnglishTextRegex = /^[a-zA-Z0-9\s.,!?'"-]+$/;
    const validMixedTextRegex = /^[\u4e00-\u9fa5a-zA-Z0-9\s.,!?'"-，。？！‘’“”]+$/;
    
    if (synonymsInput && !validEnglishTextRegex.test(synonymsInput.replace(/,/g, ''))) {
        alert('「同義字」包含無效字元，只允許英文、數字和逗號。');
        return null;
    }

    for (let i = 0; i < definitionBlocks.length; i++) {
        const block = definitionBlocks[i];
        const posInput = block.querySelector('.new-word-pos').value.trim();
        const meaningInput = block.querySelector('.new-word-meaning').value.trim();
        const exEnInput = block.querySelector('.new-word-ex-en').value.trim();
        const exZhInput = block.querySelector('.new-word-ex-zh').value.trim();

        if (!posInput || !meaningInput || !exEnInput) {
            alert(`定義 ${i+1} 中有必填欄位（詞性、中文意思、英文例句）未填寫！`);
            return null;
        }
        if (!validPOSRegex.test(posInput)) {
             alert(`定義 ${i+1} 的「詞性」格式不正確。\n請使用如 "n.", "v." 的縮寫。`);
            return null;
        }
        if (!onlyChineseRegex.test(meaningInput)) {
            alert(`定義 ${i+1} 的「中文意思」只能包含中文字元。`);
            return null;
        }
        if (!validEnglishTextRegex.test(exEnInput)) {
            alert(`定義 ${i+1} 的「英文例句」包含無效字元。`);
            return null;
        }
        if (exZhInput && !validMixedTextRegex.test(exZhInput)) {
            alert(`定義 ${i+1} 的「中文例句」包含無效字元。`);
            return null;
        }
        
        newDefinitions.push({
            pos: `(${posInput})`,
            meaning: meaningInput,
            example: { en: exEnInput, zh: exZhInput }
        });
    }

    if (newDefinitions.length === 0) {
        alert('請至少新增一組定義！');
        return null;
    }
    
    return {
        definitions: newDefinitions,
        synonyms: synonymsInput.split(',').map(s => s.trim()).filter(Boolean)
    };
}

function saveNewWord() {
    const wordData = validateAndGetWordFormData();
    if (!wordData) return;

    const newWord = {
        word: document.getElementById('word-form-en').value,
        definitions: wordData.definitions,
        synonyms: wordData.synonyms
    };
    
    vocabulary.push(newWord);
    userAddedWordsSet.add(newWord.word);
    organizeAndSortWords();
    closeModal('word-form-modal');
    searchWordWithValue(newWord.word);
}

function saveWordChanges(originalWord) {
    const wordData = validateAndGetWordFormData();
    if (!wordData) return;
    
    const wordIndex = vocabulary.findIndex(w => w.word === originalWord);
    if (wordIndex === -1) {
        alert('儲存失敗：找不到原始單字。');
        return;
    }
    
    vocabulary[wordIndex].definitions = wordData.definitions;
    vocabulary[wordIndex].synonyms = wordData.synonyms;
    
    organizeAndSortWords();
    closeModal('word-form-modal');
    displayCard(); // Refresh current card
}

function searchWordWithValue(wordValue) {
    document.getElementById('search-input').value = wordValue;
    searchWord();
}

// --- 學習模式邏輯 ---
function removeDuplicateWords() {
    const seenWords = new Set();
    const uniqueVocabulary = [];
    // 使用 for...of 迴圈遍歷單字庫
    for (const wordObj of vocabulary) {
        // 將單字轉換為小寫以進行不區分大小寫的比對
        const wordKey = wordObj.word.toLowerCase();
        // 如果這個單字還沒有見過
        if (!seenWords.has(wordKey)) {
            // 就將它加入到 'seen' 集合和新的單字庫中
            seenWords.add(wordKey);
            uniqueVocabulary.push(wordObj);
        }
    }
    // 計算移除了多少重複的單字
    const removedCount = vocabulary.length - uniqueVocabulary.length;
    if (removedCount > 0) {
        // 在開發者控制台顯示訊息，方便您確認
        console.log(`啟動時自動移除了 ${removedCount} 個重複的單字。`);
    }
    // 用處理過的、無重複的單字庫替換舊的
    vocabulary = uniqueVocabulary;
}

function organizeAndSortWords() {
    const sorted = vocabulary.sort((a, b) => a.word.localeCompare(b.word));
    sorted.forEach((word, index) => { word.number = index + 1; });
    const groupedByLetter = sorted.reduce((acc, word) => {
        const firstLetter = word.word[0].toUpperCase();
        if (!acc[firstLetter]) acc[firstLetter] = [];
        acc[firstLetter].push(word);
        return acc;
    }, {});
    
    organizedWords = {};
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('').forEach(letter => {
        if (groupedByLetter[letter]) {
            organizedWords[letter] = {};
            const wordsInLetter = groupedByLetter[letter];
            for (let i = 0; i < wordsInLetter.length; i += 10) {
                organizedWords[letter][Math.floor(i / 10) + 1] = wordsInLetter.slice(i, i + 10);
            }
        }
    });
    
    // Organize favorite words (all folders combined for the main button)
    const allFavoriteWords = vocabulary.filter(word => favoriteFolders.some(folder => folder.has(word.word)));
    if (allFavoriteWords.length > 0) {
         organizedWords['★'] = { 1: allFavoriteWords }; // Simplified for hasWords check
    } else {
         delete organizedWords['★'];
    }

    // Organize user-added words
    const userWords = vocabulary.filter(word => userAddedWordsSet.has(word.word));
    if (userWords.length > 0) {
        organizedWords['+'] = {};
        for (let i = 0; i < userWords.length; i += 10) {
            organizedWords['+'][Math.floor(i / 10) + 1] = userWords.slice(i, i + 10);
        }
    } else {
        delete organizedWords['+'];
    }
}

function renderMajorUnits() {
    const grid = document.getElementById('major-units-grid');
    grid.innerHTML = '';
    const specialUnits = ['★', '+', '🎲'];
    const allUnits = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('').concat(specialUnits);

    allUnits.forEach(unit => {
        let hasWords = organizedWords[unit];
        if (unit === '🎲') {
            hasWords = vocabulary.length >= 10;
        }
        const button = document.createElement('button');
        let iconHtml = unit;
        if (unit === '★') iconHtml = `<i class="fas fa-star ${hasWords ? 'text-yellow-400' : ''}"></i>`;
        if (unit === '+') iconHtml = `<i class="fas fa-plus ${hasWords ? 'text-green-500' : ''}"></i>`;
        if (unit === '🎲') iconHtml = `<i class="fas fa-dice ${hasWords ? 'text-blue-500' : ''}"></i>`;
        button.innerHTML = iconHtml;
        button.className = `p-4 text-xl font-bold rounded-lg shadow transition-transform transform hover:scale-105 ${hasWords ? 'bg-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`;
        
        if (hasWords) {
            if (unit === '★') {
                button.onclick = () => showPage('favorite-folders-page');
            } else if (unit === '🎲') {
                button.onclick = startRandomSession;
            } else {
                button.onclick = () => showMinorUnits(unit);
            }
        } else {
            // Allow clicking on empty '+' unit to see the page
            if(unit === '+') {
                 button.onclick = () => showMinorUnits(unit);
                 button.disabled = false;
                 button.className = `p-4 text-xl font-bold rounded-lg shadow transition-transform transform hover:scale-105 bg-white`;
            } else {
                 button.disabled = true;
            }
        }
        grid.appendChild(button);
    });
}

function showMinorUnits(letter, sessionType = 'normal') {
    const minorUnitGrid = document.getElementById('minor-units-grid');
    minorUnitGrid.innerHTML = '';
    
    const headerRight = document.getElementById('minor-unit-header-right');
    headerRight.innerHTML = '';

    let title = `單元 ${letter}`;
     if (letter === '+') {
        title = '新增的單字';
    } else if (sessionType.startsWith('favorite-')) {
        const folderIndex = parseInt(sessionType.split('-')[1]);
        title = `最愛資料夾 ${folderIndex + 1}`;
        
        const clearButton = document.createElement('button');
        clearButton.className = 'btn bg-red-400 text-white';
        clearButton.innerHTML = '<i class="fa fa-trash mr-2"></i>清空資料夾';
        clearButton.onclick = () => confirmClearSingleFolder(folderIndex);
        headerRight.appendChild(clearButton);
    }
    document.getElementById('minor-unit-title').textContent = title;
    
    document.getElementById('back-to-major-from-minor').onclick = () => {
        if (sessionType.startsWith('favorite-')) showPage('favorite-folders-page');
        else showPage('learn-main-page');
    };

    const units = organizedWords[letter];
    if (!units || Object.keys(units).length === 0) {
         minorUnitGrid.innerHTML = `<p class="text-center text-gray-500 col-span-full mt-8">這裡還沒有任何單字喔！</p>`;
    } else {
        for(const unitNumber in units) {
            const unitWords = units[unitNumber];
            if (unitWords.length === 0) continue;
            const firstWord = unitWords[0];
            const lastWord = unitWords[unitWords.length - 1];
            const button = document.createElement('button');
            button.innerHTML = `<span class="block">${firstWord.number}. ${firstWord.word}</span><span class="block text-gray-400">~</span><span class="block">${lastWord.number}. ${lastWord.word}</span>`;
            button.className = 'btn btn-blue text-base text-center p-3 h-28 flex flex-col justify-center items-center leading-tight';
            button.onclick = () => startFlashcardSession(letter, unitNumber, 0, sessionType);
            minorUnitGrid.appendChild(button);
        }
    }
    showPage('learn-minor-page');
}

function startRandomSession() {
    if (vocabulary.length < 10) {
        alert('單字庫中需至少有10個單字才能使用此功能！');
        return;
    }
    const shuffled = [...vocabulary].sort(() => 0.5 - Math.random());
    const randomWords = shuffled.slice(0, 10);
    
    // Create a temporary unit for these words
    organizedWords['🎲'] = { 1: randomWords };
    
    startFlashcardSession('🎲', 1, 0, 'random');
}

function startFlashcardSession(letter, unitNumber, targetIndex = 0, sessionType = 'normal') {
    currentFlashcardUnit = organizedWords[letter]?.[unitNumber] || [];
    currentCardIndex = targetIndex;
    currentSessionInfo = { letter, unit: unitNumber, type: sessionType };
    
    const backButton = document.getElementById('back-to-minor-units');
    if (sessionType === 'random') {
        backButton.onclick = () => showPage('learn-main-page');
    } else {
        backButton.onclick = () => showMinorUnits(letter, sessionType);
    }

    displayCard();
    showPage('flashcard-page');
}

function displayCard() {
    if (!currentFlashcardUnit || currentFlashcardUnit.length === 0) {
        if (currentSessionInfo.type.startsWith('favorite-')) {
            showPage('favorite-folders-page');
        } else {
            showMinorUnits(currentSessionInfo.letter, currentSessionInfo.type);
        }
        return;
    }
    currentWordObject = currentFlashcardUnit[currentCardIndex];
    document.getElementById('flashcard-word').textContent = currentWordObject.word;
    const detailsContainer = document.getElementById('flashcard-details');
    let detailsHTML = `<h3 class="text-3xl font-bold mb-4 text-center" style="color:var(--color-text-dark);">${currentWordObject.word}</h3>`;
    currentWordObject.definitions.forEach(def => {
        detailsHTML += `<div class="mb-4"><p class="text-lg"><strong style="color:var(--color-purple);">${def.pos}</strong> ${def.meaning}</p><p class="mt-1 text-md" style="color:var(--color-text);">${def.example.en}</p><p class="text-md" style="color:var(--color-text);">${def.example.zh}</p></div>`;
    });
    if (currentWordObject.synonyms && currentWordObject.synonyms.length > 0) {
        detailsHTML += `<div class="mt-4"><p class="text-lg"><strong style="color:var(--color-blue);">同義字:</strong> ${currentWordObject.synonyms.join(', ')}</p></div>`;
    }
    detailsContainer.innerHTML = detailsHTML;
    document.getElementById('flashcard-progress').textContent = `${currentCardIndex + 1} / ${currentFlashcardUnit.length}`;
    document.getElementById('flashcard').classList.remove('is-flipped');
    updateFavoriteButtonState();

    const headerRight = document.getElementById('flashcard-header-right');
    headerRight.innerHTML = '';
    if (currentSessionInfo.type === 'random') {
        const addAllBtn = document.createElement('button');
        addAllBtn.className = 'btn btn-blue text-sm';
        addAllBtn.innerHTML = '<i class="fa fa-star mr-2"></i>一鍵加入最愛';
        addAllBtn.onclick = () => openAddToFavoriteModal(true); // isBatch = true
        headerRight.appendChild(addAllBtn);
    }
    
    const deleteBtn = document.getElementById('delete-word-btn');
    if (userAddedWordsSet.has(currentWordObject.word)) {
        deleteBtn.classList.remove('hidden');
    } else {
        deleteBtn.classList.add('hidden');
    }
}

// --- 最愛單字相關 ---

function renderFavoriteFolders() {
    const grid = document.getElementById('favorite-folders-grid');
    grid.innerHTML = '';
    for (let i = 0; i < 5; i++) {
        const count = favoriteFolders[i].size;
        const folderButton = document.createElement('button');
        folderButton.className = 'btn btn-pink text-lg h-32 flex flex-col justify-center items-center';
        folderButton.innerHTML = `<span><i class="fas fa-folder mr-2"></i>資料夾 ${i+1}</span><span class="text-sm mt-2">(${count} 個單字)</span>`;
        folderButton.onclick = () => showFavoriteFolderContents(i);
        grid.appendChild(folderButton);
    }
}

function showFavoriteFolderContents(folderIndex) {
    const folderWords = vocabulary.filter(w => favoriteFolders[folderIndex].has(w.word));
    const tempUnitName = `fav-${folderIndex}`;
    organizedWords[tempUnitName] = {};
    if (folderWords.length > 0) {
        for (let i = 0; i < folderWords.length; i += 10) {
             organizedWords[tempUnitName][Math.floor(i / 10) + 1] = folderWords.slice(i, i + 10);
        }
    }
    showMinorUnits(tempUnitName, `favorite-${folderIndex}`);
}

function handleFavoriteClick() {
    const wordToHandle = currentWordObject.word;
    const isFav = favoriteFolders.some(folder => folder.has(wordToHandle));
    if (isFav) {
        favoriteFolders.forEach(folder => folder.delete(wordToHandle));
        organizeAndSortWords();
        updateFavoriteButtonState();
    } else {
        openAddToFavoriteModal(false);
    }
}

function openAddToFavoriteModal(isBatch = false) {
    const container = document.getElementById('favorite-modal-folders');
    container.innerHTML = '';
     for (let i = 0; i < 5; i++) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-blue';
        btn.textContent = `資料夾 ${i+1}`;
        if (isBatch) {
            btn.onclick = () => addAllCurrentWordsToFavorite(i);
        } else {
            btn.onclick = () => addToFavorite(i);
        }
        container.appendChild(btn);
    }
    openModal('add-to-favorite-modal');
}

function addToFavorite(folderIndex) {
    const wordToAdd = currentWordObject.word;
    if (favoriteFolders[folderIndex].size >= 500) {
        alert(`資料夾 ${folderIndex+1} 已滿 (上限500)！`);
        return;
    }
    favoriteFolders.forEach(folder => folder.delete(wordToAdd));
    favoriteFolders[folderIndex].add(wordToAdd);
    
    organizeAndSortWords();
    updateFavoriteButtonState();
    closeModal('add-to-favorite-modal');
}

function addAllCurrentWordsToFavorite(folderIndex) {
    if (!currentFlashcardUnit || currentFlashcardUnit.length === 0) return;
    
    let addedCount = 0;
    let alreadyInFolder = 0;
    const totalWords = currentFlashcardUnit.length;

    currentFlashcardUnit.forEach(wordObj => {
        const wordToAdd = wordObj.word;
        
        if (favoriteFolders[folderIndex].has(wordToAdd)) {
            alreadyInFolder++;
            return; 
        }

        if (favoriteFolders[folderIndex].size >= 500) {
            return; 
        }
        
        favoriteFolders.forEach((folder, idx) => {
            if (idx !== folderIndex) {
                folder.delete(wordToAdd);
            }
        });
        
        favoriteFolders[folderIndex].add(wordToAdd);
        addedCount++;
    });
    
    let alertMessage = '';
    if (addedCount > 0) {
        alertMessage += `成功加入 ${addedCount} 個新單字至資料夾 ${folderIndex + 1}！\n`;
    }
    if (alreadyInFolder > 0) {
        alertMessage += `${alreadyInFolder} 個單字已存在於該資料夾。\n`;
    }
    if (addedCount + alreadyInFolder < totalWords) {
         alertMessage += `部分單字因資料夾已滿 (上限500) 而未加入。`;
    }
    
    if(alertMessage.trim() === '') {
        alertMessage = "沒有單字被加入。";
    }

    alert(alertMessage.trim());
    
    organizeAndSortWords();
    updateFavoriteButtonState();
    closeModal('add-to-favorite-modal');
}

function confirmClearSingleFolder(folderIndex) {
    showConfirmModal(`清空資料夾 ${folderIndex + 1}`, '確定要清空此最愛資料夾嗎？此操作無法復原。', () => clearSingleFolder(folderIndex));
}

function clearSingleFolder(folderIndex) {
    favoriteFolders[folderIndex].clear();
    organizeAndSortWords();
    closeModal('confirm-modal');
    showMinorUnits(`fav-${folderIndex}`, `favorite-${folderIndex}`);
}

function updateFavoriteButtonState() {
    const wordData = currentWordObject;
    if (!wordData) return;
    const favBtn = document.getElementById('favorite-btn');
    const isFav = favoriteFolders.some(folder => folder.has(wordData.word));
    if (isFav) {
        favBtn.classList.add('favorited', 'text-yellow-400');
        favBtn.classList.remove('text-gray-400');
    } else {
        favBtn.classList.remove('favorited', 'text-yellow-400');
        favBtn.classList.add('text-gray-400');
    }
}

// --- 刪除單字 ---
function confirmDeleteWord() {
    const wordToDelete = currentWordObject.word;
    showConfirmModal('刪除單字', `確定要永久刪除單字 "${wordToDelete}" 嗎？`, () => deleteWord(wordToDelete));
}

function deleteWord(wordToDelete) {
    vocabulary = vocabulary.filter(w => w.word !== wordToDelete);
    userAddedWordsSet.delete(wordToDelete);
    favoriteFolders.forEach(folder => folder.delete(wordToDelete));
    
    organizeAndSortWords();
    
    currentFlashcardUnit = currentFlashcardUnit.filter(w => w.word !== wordToDelete);
    if (currentCardIndex >= currentFlashcardUnit.length) {
        currentCardIndex = Math.max(0, currentFlashcardUnit.length - 1);
    }
    
    closeModal('confirm-modal');
    displayCard();
}

function showConfirmModal(title, text, onYes) {
    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-text').textContent = text;
    document.getElementById('confirm-modal-yes').onclick = onYes;
    openModal('confirm-modal');
}


function playPronunciation() {
    const utterance = new SpeechSynthesisUtterance(document.getElementById('flashcard-word').textContent);
    if (synthesisVoice) {
        utterance.voice = synthesisVoice;
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
    }
    speechSynthesis.speak(utterance);
}
function nextCard() { currentCardIndex = (currentCardIndex + 1) % currentFlashcardUnit.length; displayCard(); }
function prevCard() { currentCardIndex = (currentCardIndex - 1 + currentFlashcardUnit.length) % currentFlashcardUnit.length; displayCard(); }

// --- 練習模式邏輯 ---
function initializePracticeSetup() {
    renderUnitSelection();
}

function openUnitSelectionModal() { openModal('unit-selection-modal'); }
function confirmUnitSelection() {
    selectedUnits = {};
    document.querySelectorAll('.major-unit-checkbox:checked').forEach(majorCb => { selectedUnits[majorCb.dataset.letter] = 'all'; });
    document.querySelectorAll('.minor-unit-checkbox:checked').forEach(minorCb => {
        const { letter, unit } = minorCb.dataset;
        if (selectedUnits[letter] !== 'all') { if (!selectedUnits[letter]) selectedUnits[letter] = []; selectedUnits[letter].push(unit); }
    });
    closeModal('unit-selection-modal');
}

function renderUnitSelection() {
    const container = document.getElementById('unit-selection-container');
    container.innerHTML = '';
    
    const renderGroup = (letter, isFavorite = false) => {
        let unitData = organizedWords[letter];
        if (isFavorite) {
            const favWords = vocabulary.filter(w => favoriteFolders.some(f => f.has(w.word)));
            if (favWords.length > 0) {
                unitData = { 1: favWords }; // Group all favs into one selectable block
            } else {
                unitData = null;
            }
        }
        const hasWords = unitData && Object.keys(unitData).length > 0;

        const unitGroup = document.createElement('div');
        unitGroup.className = 'unit-group border-b pb-2 mb-2';
        
        const majorLabel = document.createElement('label');
        majorLabel.className = `font-bold text-lg flex items-center ${hasWords ? 'cursor-pointer' : 'text-gray-400 cursor-not-allowed'}`;
        
        const majorCheckbox = document.createElement('input');
        majorCheckbox.type = 'checkbox';
        majorCheckbox.className = 'major-unit-checkbox mr-2 h-5 w-5';
        majorCheckbox.dataset.letter = letter;
        majorCheckbox.disabled = !hasWords;
        
        if (hasWords) {
            majorCheckbox.onchange = (e) => {
                unitGroup.querySelectorAll('.minor-unit-checkbox').forEach(cb => cb.checked = e.target.checked);
            };
        }
        
        majorLabel.appendChild(majorCheckbox);
        majorLabel.append(isFavorite ? `★ 最愛單字 (全選)` : `單元 ${letter} (全選)`);
        unitGroup.appendChild(majorLabel);
        
        if (hasWords && !isFavorite) {
            const minorContainer = document.createElement('div');
            minorContainer.className = 'minor-units-container pl-8 mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2';
            Object.keys(unitData).forEach(unitNum => {
                const unitWords = unitData[unitNum];
                if (!unitWords || unitWords.length === 0) return;
                const firstWord = unitWords[0];
                const lastWord = unitWords[unitWords.length - 1];

                const minorLabel = document.createElement('label');
                minorLabel.className = 'flex items-center cursor-pointer text-sm';
                const minorCheckbox = document.createElement('input');
                minorCheckbox.type = 'checkbox';
                minorCheckbox.className = 'minor-unit-checkbox mr-2 h-4 w-4 flex-shrink-0';
                minorCheckbox.dataset.letter = letter;
                minorCheckbox.dataset.unit = unitNum;
                minorCheckbox.onchange = () => {
                    const allMinorChecked = Array.from(unitGroup.querySelectorAll('.minor-unit-checkbox:not(:disabled)')).every(cb => cb.checked);
                    majorCheckbox.checked = allMinorChecked;
                };
                const textSpan = document.createElement('span');
                textSpan.textContent = `${firstWord.number}. ${firstWord.word} ~ ${lastWord.number}. ${lastWord.word}`;
                minorLabel.appendChild(minorCheckbox);
                minorLabel.appendChild(textSpan);
                minorContainer.appendChild(minorLabel);
            });
            unitGroup.appendChild(minorContainer);
        }
        return unitGroup;
    };

    container.appendChild(renderGroup('★', true));
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('').forEach(letter => {
        if (organizedWords[letter]) container.appendChild(renderGroup(letter));
    });
     if (organizedWords['+']) container.appendChild(renderGroup('+'));

}

function getWordPool() {
    let wordPool = [];
    if (Object.keys(selectedUnits).length === 0) {
        wordPool = [...vocabulary];
    } else {
        for (const letter in selectedUnits) {
            if (letter === '★') {
                const favWords = vocabulary.filter(w => favoriteFolders.some(f => f.has(w.word)));
                wordPool.push(...favWords);
                continue;
            }
            if(!organizedWords[letter]) continue;
            if (selectedUnits[letter] === 'all') {
                for (const unitNum in organizedWords[letter]) {
                    wordPool.push(...organizedWords[letter][unitNum]);
                }
            } else {
                selectedUnits[letter].forEach(unitNum => {
                    if(organizedWords[letter] && organizedWords[letter][unitNum]) {
                        wordPool.push(...organizedWords[letter][unitNum]);
                    }
                });
            }
        }
        wordPool = [...new Map(wordPool.map(item => [item.word, item])).values()];
    }
    return wordPool;
}

function startPractice() {
    practiceSettings.type = document.getElementById('quiz-type').value;
    const wordPool = getWordPool();

    if (practiceSettings.type === 'balloon') {
        if (wordPool.length < 4) {
            alert('單字量不足4個，無法開始射氣球遊戲！請選擇更多單元或新增單字。');
            return;
        }
        showPage('balloon-game-page');
        initBalloonGame(wordPool);
    } else if (practiceSettings.type === 'monster-challenge') {
        if (wordPool.length < 1) {
            alert('請至少選擇一個有單字的單元！');
            return;
        }
        monsterGameManager.init(wordPool);
        switchScreen('practice-setup-page', 'monster-setup-page', true);

    } else if (practiceSettings.type === 'potion') {
         if (wordPool.length < 3) {
            alert('單字量不足3個，無法開始魔藥煉製遊戲！請選擇更多單元或新增單字。');
            return;
        }
        showPage('potion-game-wrapper');
        potionGame.init(wordPool);
    }
}

function endPractice() {
    if (balloonGameManager.stop) balloonGameManager.stop();
    if (monsterGameManager.stop) monsterGameManager.stop();
    if (window.potionGame && window.potionGame.end) window.potionGame.end();
    showPage('practice-setup-page');
}

// --- 射氣球遊戲邏輯 ---
function initBalloonGame(wordPool) {
    const canvas = document.getElementById('balloon-game-canvas');
    const ctx = canvas.getContext('2d');
    const ui = {
        score: document.getElementById('balloon-score'),
        timer: document.getElementById('balloon-timer'),
        question: document.getElementById('balloon-question'),
        overlay: document.getElementById('balloon-game-overlay')
    };
    let state = {
        score: 0,
        timeLeft: 30,
        gameStatus: 'idle',
        balloons: [],
        currentQuestion: null,
        animationFrameId: null,
        timerIntervalId: null,
        availableWords: [...wordPool]
    };

    function setOverlay(status, score) {
        ui.overlay.classList.remove('hidden');
        ui.overlay.classList.add('flex');
        if (status === 'idle') {
            ui.overlay.innerHTML = `<h2 class="text-4xl font-bold mb-4">射氣球遊戲</h2><p class="text-xl mb-6">點擊正確的英文單字氣球！</p><div class="mb-6"><h3 class="text-2xl font-bold mb-3">選擇時間</h3><div class="flex gap-4"><button onclick="balloonGameManager.start(30)" class="btn bg-pink-400 text-white text-xl px-8 py-3">30秒</button><button onclick="balloonGameManager.start(60)" class="btn bg-pink-400 text-white text-xl px-8 py-3">60秒</button><button onclick="balloonGameManager.start(90)" class="btn bg-pink-400 text-white text-xl px-8 py-3">90秒</button></div></div>`;
        } else if (status === 'ended') {
            ui.overlay.innerHTML = `<h2 class="text-4xl font-bold mb-4">遊戲結束！</h2><p class="text-3xl mb-8">你的分數: <span class="text-yellow-300">${score}</span></p><button onclick="showPage('practice-setup-page')" class="btn bg-pink-400 text-white text-xl px-8 py-3">返回</button>`;
        } else if (status === 'all-words-done') {
            ui.overlay.innerHTML = `<h2 class="text-4xl font-bold mb-4">太厲害了！</h2><p class="text-2xl mb-8">你已完成所有單字！<br>最終分數: <span class="text-yellow-300">${score}</span></p><button onclick="endPractice()" class="btn bg-pink-400 text-white text-xl px-8 py-3">返回設定</button>`;
        }
    }

    function nextQuestion() {
        if (state.availableWords.length === 0) {
            state.gameStatus = 'ended';
            setOverlay('all-words-done', state.score);
            stopGame();
            return;
        }
        let questionPool = [...wordPool];
        const correctWord = state.availableWords.splice(Math.floor(Math.random() * state.availableWords.length), 1)[0];
        state.currentQuestion = {
            english: correctWord.word,
            chinese: correctWord.definitions[0].meaning
        };
        ui.question.textContent = state.currentQuestion.chinese;
        let options = [state.currentQuestion.english];
        questionPool = questionPool.filter(w => w.word !== state.currentQuestion.english);
        while (options.length < 4 && questionPool.length > 0) {
            options.push(questionPool.splice(Math.floor(Math.random() * questionPool.length), 1)[0].word);
        }

        const tempBalloons = [];
        const radius = canvas.width / 12;
        const sortedOptions = options.sort(() => 0.5 - Math.random());

        for (const word of sortedOptions) {
            let x, overlaps;
            let attempts = 0;
            do {
                overlaps = false;
                x = Math.random() * (canvas.width - radius * 2) + radius;

                for (const existingBalloon of tempBalloons) {
                    // 檢查水平重疊，確保氣球之間有間隙
                    if (Math.abs(x - existingBalloon.x) < radius * 2) { 
                        overlaps = true;
                        break;
                    }
                }
                attempts++;
            } while (overlaps && attempts < 100); // 安全機制，避免無限迴圈

            tempBalloons.push({
                x: x,
                y: canvas.height + radius + Math.random() * 150, // 隨機化起始 Y 座標
                radius: radius,
                speed: 1 + Math.random(),
                text: word,
                color: `hsl(${Math.random() * 360}, 80%, 70%)`
            });
        }
        state.balloons = tempBalloons;
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        state.balloons.forEach(b => {
            // 氣球繩子
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(b.x, b.y + b.radius * 0.9); // 從氣球下方開始
            ctx.quadraticCurveTo(b.x + (Math.sin(b.y / 20) * 10), b.y + b.radius + 30, b.x, b.y + b.radius + 60);
            ctx.stroke();

            // 氣球主體
            ctx.fillStyle = b.color;
            ctx.beginPath();
            // 讓氣球稍微橢圓一點
            ctx.ellipse(b.x, b.y, b.radius * 0.9, b.radius, 0, 0, Math.PI * 2);
            ctx.fill();

            // 氣球反光
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.beginPath();
            ctx.ellipse(b.x - b.radius * 0.25, b.y - b.radius * 0.3, b.radius * 0.2, b.radius * 0.4, -Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();

            // 氣球繩結
            ctx.fillStyle = b.color;
            ctx.filter = 'brightness(80%)'; // 讓繩結顏色深一點
            ctx.beginPath();
            ctx.moveTo(b.x - b.radius * 0.15, b.y + b.radius * 0.95);
            ctx.lineTo(b.x + b.radius * 0.15, b.y + b.radius * 0.95);
            ctx.lineTo(b.x, b.y + b.radius * 1.1);
            ctx.closePath();
            ctx.fill();
            ctx.filter = 'none'; // 重置濾鏡
            
            // 氣球上的文字
            ctx.fillStyle = 'black';
            const fontSize = b.radius * 0.4;
            ctx.font = `bold ${fontSize}px 'Inter', sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(b.text, b.x, b.y);
        });
    }

    function update() {
        // 從後往前遍歷，方便安全地移除元素
        for (let i = state.balloons.length - 1; i >= 0; i--) {
            const b = state.balloons[i];
            b.y -= b.speed;

            // 如果氣球碰到或超過畫面上緣
            if (b.y - b.radius <= 0) {
                // 檢查是否為正確答案的氣球
                if (b.text === state.currentQuestion.english) {
                    // 正確答案的氣球飛走了，算答錯
                    state.score -= 5; // 因錯過正確答案而扣分
                    ui.score.textContent = state.score;
                    
                    // 在氣球撞擊的頂部位置觸發爆炸特效
                    const rect = canvas.getBoundingClientRect();
                    const screenX = rect.left + (b.x / canvas.width) * rect.width;
                    const screenY = rect.top;
                    triggerExplosion(screenX, screenY);
                    
                    // 直接換下一題並結束這次 update
                    nextQuestion();
                    return; 
                } else {
                    // 錯誤答案的氣球飛走了，就讓它消失
                    state.balloons.splice(i, 1);
                }
            }
        }
    }

    function gameLoop() {
        update();
        draw();
        if (state.gameStatus === 'running') state.animationFrameId = requestAnimationFrame(gameLoop);
    }

    function handleCanvasClick(event) {
        if (state.gameStatus !== 'running') return;
        const rect = canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) * (canvas.width / rect.width);
        const y = (event.clientY - rect.top) * (canvas.height / rect.height);
        for (let i = state.balloons.length - 1; i >= 0; i--) {
            const b = state.balloons[i];
            if (Math.sqrt((x - b.x)**2 + (y - b.y)**2) < b.radius) {
                if (b.text === state.currentQuestion.english) {
                    state.score += 10;
                    triggerClickConfetti(event.clientX, event.clientY);
                } else {
                    state.score -= 5;
                    triggerExplosion(event.clientX, event.clientY);
                }
                ui.score.textContent = state.score;
                nextQuestion();
                break;
            }
        }
    }

    function startGame(time) {
        state.timeLeft = time;
        state.gameStatus = 'running';
        state.score = 0;
        ui.score.textContent = '0';
        state.availableWords = [...wordPool];
        ui.overlay.classList.add('hidden');
        ui.timer.textContent = state.timeLeft;
        state.timerIntervalId = setInterval(() => {
            state.timeLeft--;
            ui.timer.textContent = state.timeLeft;
            if (state.timeLeft <= 0) {
                stopGame();
                state.gameStatus = 'ended';
                setOverlay('ended', state.score);
            }
        }, 1000);
        nextQuestion();
        gameLoop();
    }

    function stopGame() {
        clearInterval(state.timerIntervalId);
        cancelAnimationFrame(state.animationFrameId);
    }
    balloonGameManager.start = startGame;
    balloonGameManager.stop = stopGame;
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    setOverlay('idle');
    canvas.onclick = handleCanvasClick;
}

// --- 怪物遊戲專用畫面切換函式 ---
function switchScreen(hideId, showId, isFromPracticeSetup = false) {
     const hide = document.getElementById(hideId);
     const show = document.getElementById(showId);
     if (!hide || !show) return;

     if(isFromPracticeSetup) {
         // For practice setup, we just need to show the monster setup, not hide anything from the main app
        document.querySelectorAll('#app > div, #success-page, #failure-page').forEach(page => page.classList.add('hidden'));
        show.classList.remove('hidden');
        setTimeout(() => show.classList.remove('opacity-0'), 50); // Fade in
     } else {
        hide.classList.add('opacity-0');
        setTimeout(() => {
            hide.classList.add('hidden');
            show.classList.remove('hidden');
            setTimeout(() => show.classList.remove('opacity-0'), 50);
        }, 500);
     }
}


// --- 怪物遊戲邏輯 ---
(function() {
    const dom = {
        setup: document.getElementById('monster-setup-page'),
        game: document.getElementById('monster-game-page'),
        win: document.getElementById('monster-win-page'),
        lose: document.getElementById('monster-lose-page'),
        hpSelect: document.getElementById('monster-hp-select'),
        timeSelect: document.getElementById('monster-time-select'),
        startBtn: document.getElementById('monster-start-btn'),
        backBtn: document.getElementById('monster-back-btn'),
        monsterDisplay: document.getElementById('monster-display'),
        hpText: document.getElementById('monster-hp-text'),
        hpBarFill: document.getElementById('monster-hp-bar-fill'),
        timerDisplay: document.getElementById('monster-timer-display'),
        wordHint: document.getElementById('monster-word-hint'),
        wordStructure: document.getElementById('monster-word-structure'),
        answerInput: document.getElementById('monster-answer-input'),
        feedback: document.getElementById('monster-feedback-display'),
        skipBtn: document.getElementById('monster-skip-btn'),
        endGameBtn: document.getElementById('monster-end-game-btn')
    };
    const svgs = {
        idle: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><g><path d="M135.2,8.8c-7.2-2-14.6,0.3-20.1,5.8l-12,12l-12.8,12.8c-8.8,8.8-9.6,22.7-2,30.4l14.1,14.1 c7.7,7.7,21.6,6.8,30.4-2l12.8-12.8l12-12c5.5-5.5,7.8-12.9,5.8-20.1L135.2,8.8z" fill="#A0522D"/><circle cx="118" cy="27" r="5" fill="#8B4513"/><circle cx="150" cy="50" r="5" fill="#8B4513"/><circle cx="130" cy="65" r="5" fill="#8B4513"/><path d="M125,100 C140,80 130,50 120,45" stroke="#68D391" stroke-width="18" fill="none" stroke-linecap="round"/><path d="M50,190 C20,100, 180,100, 150,190 Z" fill="#48BB78"/><path d="M70,120 C40,70 160,70 130,120 L70,120 Z" fill="#48BB78"/><path d="M60,80 L40,40 L70,70 Z" fill="#68D391"/><path d="M140,80 L160,40 L130,70 Z" fill="#68D391"/><circle cx="80" cy="95" r="8" fill="#FEE2E2"/><circle cx="120" cy="95" r="8" fill="#FEE2E2"/><path d="M90,115 C95,110 105,110 110,115" stroke="#4A5568" stroke-width="3" fill="none"/><path d="M85,115 v5" stroke="#4A5568" stroke-width="3" stroke-linecap="round"/><path d="M115,115 v5" stroke="#4A5568" stroke-width="3" stroke-linecap="round"/></g></svg>`,
        hurt: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><g><path d="M135.2,8.8c-7.2-2-14.6,0.3-20.1,5.8l-12,12l-12.8,12.8c-8.8,8.8-9.6,22.7-2,30.4l14.1,14.1 c7.7,7.7,21.6,6.8,30.4-2l12.8-12.8l12-12c5.5-5.5,7.8-12.9,5.8-20.1L135.2,8.8z" fill="#A0522D"/><circle cx="118" cy="27" r="5" fill="#8B4513"/><circle cx="150" cy="50" r="5" fill="#8B4513"/><circle cx="130" cy="65" r="5" fill="#8B4513"/><path d="M125,100 C140,80 130,50 120,45" stroke="#68D391" stroke-width="18" fill="none" stroke-linecap="round"/><path d="M50,190 C20,100, 180,100, 150,190 Z" fill="#48BB78"/><path d="M70,120 C40,70 160,70 130,120 L70,120 Z" fill="#48BB78"/><path d="M60,80 L40,40 L70,70 Z" fill="#68D391"/><path d="M140,80 L160,40 L130,70 Z" fill="#68D391"/><path d="M72 88 L88 102 M88 88 L72 102" stroke="#4A5568" stroke-width="4" stroke-linecap="round"/><path d="M112 88 L128 102 M128 88 L112 102" stroke="#4A5568" stroke-width="4" stroke-linecap="round"/><path d="M90,120 Q100,110 110,120" stroke="#4A5568" stroke-width="3" fill="none" stroke-linecap="round"/></g></svg>`,
        happy: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><g><path d="M135.2,8.8c-7.2-2-14.6,0.3-20.1,5.8l-12,12l-12.8,12.8c-8.8,8.8-9.6,22.7-2,30.4l14.1,14.1 c7.7,7.7,21.6,6.8,30.4-2l12.8-12.8l12-12c5.5-5.5,7.8-12.9,5.8-20.1L135.2,8.8z" fill="#A0522D"/><circle cx="118" cy="27" r="5" fill="#8B4513"/><circle cx="150" cy="50" r="5" fill="#8B4513"/><circle cx="130" cy="65" r="5" fill="#8B4513"/><path d="M125,100 C140,80 130,50 120,45" stroke="#68D391" stroke-width="18" fill="none" stroke-linecap="round"/><path d="M50,190 C20,100, 180,100, 150,190 Z" fill="#48BB78"/><path d="M70,120 C40,70 160,70 130,120 L70,120 Z" fill="#48BB78"/><path d="M60,80 L40,40 L70,70 Z" fill="#68D391"/><path d="M140,80 L160,40 L130,70 Z" fill="#68D391"/><path d="M75 90 C 80 80, 90 80, 95 90" stroke="#4A5568" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M105 90 C 110 80, 120 80, 125 90" stroke="#4A5568" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M85,110 Q100,130 115,110" fill="#4A5568"/></g></svg>`
    };
    let state = {
        wordPool: [],
        maxHP: 100,
        currentHP: 100,
        timeLeft: 75,
        currentWord: null,
        timerInterval: null,
        animationInterval: null,
        usedWordIndices: new Set()
    };
    const idleAnimations = ['monster-bob-animation', 'monster-tilt-animation', 'monster-hop-animation'];

    function startIdleAnimation() {
        stopIdleAnimation();
        const setRandomAnimation = () => {
            dom.monsterDisplay.classList.remove(...idleAnimations);
            dom.monsterDisplay.classList.add(idleAnimations[Math.floor(Math.random() * idleAnimations.length)]);
        };
        setRandomAnimation();
        state.animationInterval = setInterval(setRandomAnimation, 4000);
    }

    function stopIdleAnimation() {
        clearInterval(state.animationInterval);
        state.animationInterval = null;
        dom.monsterDisplay.classList.remove(...idleAnimations);
    }

    function startTimer() {
        state.timerInterval = setInterval(() => {
            state.timeLeft--;
            dom.timerDisplay.textContent = state.timeLeft;
            if (state.timeLeft <= 0) endGame(false);
        }, 1000);
    }

    function nextWord() {
        if (state.usedWordIndices.size === state.wordPool.length) {
            state.usedWordIndices.clear();
        }
        let newIndex;
        do {
            newIndex = Math.floor(Math.random() * state.wordPool.length);
        } while (state.usedWordIndices.has(newIndex));
        state.usedWordIndices.add(newIndex);
        state.currentWord = state.wordPool[newIndex];
        dom.wordHint.textContent = `${state.currentWord.definitions[0].meaning} (${state.currentWord.definitions[0].pos})`;
        const word = state.currentWord.word;
        dom.wordStructure.textContent = word.length > 1 ? `${word[0]} ${'_ '.repeat(word.length - 2)} ${word.slice(-1)}` : word;
        dom.answerInput.value = '';
        dom.feedback.textContent = '';
    }

    function checkAnswer() {
        if (dom.answerInput.value.trim().toLowerCase() === state.currentWord.word) {
            dom.answerInput.disabled = true;
            const damage = [0, 5, 10, 15, 20, 50][Math.floor(Math.random() * 6)];
            state.currentHP = Math.max(0, state.currentHP - damage);
            updateHPDisplay();
            stopIdleAnimation();
            dom.monsterDisplay.innerHTML = svgs.hurt;
            dom.monsterDisplay.classList.add('shake-animation');
            setTimeout(() => {
                dom.monsterDisplay.classList.remove('shake-animation');
                if (state.currentHP <= 0) {
                    endGame(true);
                } else {
                    dom.monsterDisplay.innerHTML = svgs.idle;
                    startIdleAnimation();
                    nextWord();
                    dom.answerInput.disabled = false;
                    dom.answerInput.focus();
                }
            }, 800);
        } else {
            dom.feedback.textContent = '[錯囉 再試一次]';
            dom.answerInput.value = '';
            setTimeout(() => {
                dom.feedback.textContent = '';
            }, 2000);
        }
    }

    function skipQuestion() {
        dom.answerInput.disabled = true;
        dom.skipBtn.disabled = true;
        dom.endGameBtn.disabled = true;
        state.currentHP = Math.min(state.maxHP, state.currentHP + Math.floor(Math.random() * 6) + 5);
        updateHPDisplay();
        stopIdleAnimation();
        dom.monsterDisplay.innerHTML = svgs.happy;
        setTimeout(() => {
            dom.monsterDisplay.innerHTML = svgs.idle;
            startIdleAnimation();
            nextWord();
            dom.answerInput.disabled = false;
            dom.skipBtn.disabled = false;
            dom.endGameBtn.disabled = false;
            dom.answerInput.focus();
        }, 1200);
    }

    function updateHPDisplay() {
        dom.hpText.textContent = `HP: ${state.currentHP}/${state.maxHP}`;
        dom.hpBarFill.style.width = `${(state.currentHP / state.maxHP) * 100}%`;
    }
    
    function stopGameLogic() {
        clearInterval(state.timerInterval);
        stopIdleAnimation();
        state.timerInterval = null;
    }

    function endGame(isWin) {
        stopGameLogic();
        if (isWin) {
            switchScreen('monster-game-page', 'monster-win-page');
            createConfetti();
        } else {
            switchScreen('monster-game-page', 'monster-lose-page');
        }
    }

    function createConfetti() {
        const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800'];
        for (let i = 0; i < 100; i++) {
            const c = document.createElement('div');
            c.classList.add('confetti');
            c.style.left = `${Math.random()*100}vw`;
            c.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            c.style.animationDelay = `${Math.random()*3}s`;
            dom.win.appendChild(c);
        }
    }
    
    monsterGameManager.init = (wordPool) => {
        state.wordPool = wordPool;
    };
    monsterGameManager.start = () => {
        state.maxHP = parseInt(dom.hpSelect.value);
        state.currentHP = state.maxHP;
        state.timeLeft = parseInt(dom.timeSelect.value);
        state.usedWordIndices.clear();
        updateHPDisplay();
        dom.timerDisplay.textContent = state.timeLeft;
        switchScreen('monster-setup-page', 'monster-game-page');
        dom.monsterDisplay.innerHTML = svgs.idle;
        startIdleAnimation();
        nextWord();
        startTimer();
        dom.answerInput.focus();
    };
    monsterGameManager.end = endGame;
    monsterGameManager.stop = stopGameLogic;

    dom.startBtn.addEventListener('click', monsterGameManager.start);
    dom.backBtn.addEventListener('click', () => { showPage('practice-setup-page'); });
    dom.skipBtn.addEventListener('click', skipQuestion);
    dom.endGameBtn.addEventListener('click', () => endGame(false));
    dom.answerInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') checkAnswer();
    });
})();

// --- 魔藥煉製遊戲邏輯 ---
(function() {
    window.potionGame = {};
    
    const dom = {
        wrapper: document.getElementById('potion-game-wrapper'),
        startScreen: document.getElementById('potion-start-screen'),
        gameScreen: document.getElementById('potion-game-screen'),
        gameBoard: document.getElementById('potion-game-board'),
        cauldron: document.getElementById('potion-cauldron'),
        mistakesCount: document.getElementById('potion-mistakes-count'),
        starRating: document.getElementById('potion-star-rating'),
        levelCompleteModal: document.getElementById('potion-level-complete-modal'),
        collectionModal: document.getElementById('potion-collection-modal'),
        lineSvg: document.getElementById('potion-line-svg'),
        magicLine: document.getElementById('potion-magic-line'),
        timer: document.getElementById('potion-timer'),
        finalStarRating: document.getElementById('potion-final-star-rating'),
        completionTime: document.getElementById('potion-completion-time'),
        rewardSection: document.getElementById('potion-reward-section'),
        noRewardSection: document.getElementById('potion-no-reward-section'),
        potionName: document.getElementById('potion-name'),
        potionDesc: document.getElementById('potion-desc'),
        replayBtn: document.getElementById('potion-replay-btn'),
        mainMenuBtn: document.getElementById('potion-main-menu-btn'),
        collectionBtn: document.getElementById('potion-collection-btn'),
        collectionGrid: document.getElementById('potion-collection-grid'),
        collectionBackBtn: document.getElementById('potion-collection-back-btn'),
        backToMenuBtn: document.getElementById('potion-back-to-menu-btn')
    };

    let state = {
        wordPool: [],
        currentDifficulty: 'easy',
        wordPairs: [],
        mistakes: 0,
        pairsLeft: 0,
        selectedBubble: null,
        isDragging: false,
        startTime: null,
        timerInterval: null
    };
    
     const potions = [
        // --- 初級 (Easy) ---
        // 3 Stars
        { id: 101, name: "閃亮星星糖漿", desc: "讓你的思路像星星一樣清晰閃亮。", unlocked: false, unlockConditions: { difficulty: 'easy', stars: 3, timeRange: [0, 15] } },
        { id: 102, name: "快樂氣泡飲", desc: "喝下後會忍不住微笑一整天。", unlocked: false, unlockConditions: { difficulty: 'easy', stars: 3, timeRange: [16, 25] } },
        { id: 103, name: "順風耳滴劑", desc: "能稍微聽得更清楚一些。", unlocked: false, unlockConditions: { difficulty: 'easy', stars: 3, timeRange: [26, 35] } },
        { id: 104, name: "活力泉水", desc: "感覺精神飽滿，充滿能量。", unlocked: false, unlockConditions: { difficulty: 'easy', stars: 3, timeRange: [36, 45] } },
        { id: 105, name: "好眠牛奶", desc: "讓你做個關於單字的美夢。", unlocked: false, unlockConditions: { difficulty: 'easy', stars: 3, timeRange: [46, 9999] } },
        // 2 Stars
        { id: 106, name: "微光藥水", desc: "指尖會發出微弱的光芒。", unlocked: false, unlockConditions: { difficulty: 'easy', stars: 2, timeRange: [0, 15] } },
        { id: 107, name: "變色墨水", desc: "寫出來的字會隨心情改變顏色。", unlocked: false, unlockConditions: { difficulty: 'easy', stars: 2, timeRange: [16, 25] } },
        { id: 108, name: "誠實豆", desc: "吃下後短時間內無法說謊。", unlocked: false, unlockConditions: { difficulty: 'easy', stars: 2, timeRange: [26, 35] } },
        { id: 109, name: "溫暖圍巾", desc: "感覺像是被一個溫暖的擁抱包圍。", unlocked: false, unlockConditions: { difficulty: 'easy', stars: 2, timeRange: [36, 45] } },
        { id: 110, name: "普通的水", desc: "呃...它嚐起來就像普通的水。", unlocked: false, unlockConditions: { difficulty: 'easy', stars: 2, timeRange: [46, 9999] } },
        // 1 Star
        { id: 111, name: "健忘糖果", desc: "讓你忘記一件不重要的小事。", unlocked: false, unlockConditions: { difficulty: 'easy', stars: 1, timeRange: [0, 15] } },
        { id: 112, name: "哈啾胡椒粉", desc: "聞一下就會打個大噴嚏。", unlocked: false, unlockConditions: { difficulty: 'easy', stars: 1, timeRange: [16, 25] } },
        { id: 113, name: "悲傷洋蔥汁", desc: "為什麼我的眼淚流不停...", unlocked: false, unlockConditions: { difficulty: 'easy', stars: 1, timeRange: [26, 35] } },
        { id: 114, name: "慢動作糖漿", desc: "接下來的五分鐘，你的動作會變慢。", unlocked: false, unlockConditions: { difficulty: 'easy', stars: 1, timeRange: [36, 45] } },
        { id: 115, name: "漏水的杯子", desc: "魔藥從杯底漏光了，真可惜。", unlocked: false, unlockConditions: { difficulty: 'easy', stars: 1, timeRange: [46, 9999] } },
        
        // --- 中級 (Medium) ---
        // 3 Stars
        { id: 201, name: "天才叡智藥劑", desc: "短時間內大幅提升理解與記憶能力。", unlocked: false, unlockConditions: { difficulty: 'medium', stars: 3, timeRange: [0, 30] } },
        { id: 202, name: "專注糖漿", desc: "幫助你長時間集中精神，不受外界干擾。", unlocked: false, unlockConditions: { difficulty: 'medium', stars: 3, timeRange: [31, 45] } },
        { id: 203, name: "巧言鳥鳴劑", desc: "說話變得像唱歌一樣悅耳動聽。", unlocked: false, unlockConditions: { difficulty: 'medium', stars: 3, timeRange: [46, 60] } },
        { id: 204, name: "植物溝通露", desc: "你可以聽懂路邊小草的竊竊私語。", unlocked: false, unlockConditions: { difficulty: 'medium', stars: 3, timeRange: [61, 75] } },
        { id: 205, name: "穩重之石", desc: "讓你的心情平靜下來，不易浮躁。", unlocked: false, unlockConditions: { difficulty: 'medium', stars: 3, timeRange: [76, 9999] } },
        // 2 Stars
        { id: 206, name: "記憶麵包屑", desc: "吃下後能回想起昨天早餐吃了什麼。", unlocked: false, unlockConditions: { difficulty: 'medium', stars: 2, timeRange: [0, 30] } },
        { id: 207, name: "勇氣軟糖", desc: "給你舉手發問的勇氣。", unlocked: false, unlockConditions: { difficulty: 'medium', stars: 2, timeRange: [31, 45] } },
        { id: 208, name: "反重力髮膠", desc: "你的頭髮會直直地朝向天空。", unlocked: false, unlockConditions: { difficulty: 'medium', stars: 2, timeRange: [46, 60] } },
        { id: 209, name: "小幸運汽水", desc: "今天可能會在路上撿到一枚硬幣。", unlocked: false, unlockConditions: { difficulty: 'medium', stars: 2, timeRange: [61, 75] } },
        { id: 210, name: "平淡無奇湯", desc: "味道不差，但也沒有什麼特別之處。", unlocked: false, unlockConditions: { difficulty: 'medium', stars: 2, timeRange: [76, 9999] } },
        // 1 Star
        { id: 211, name: "舌頭打結藥水", desc: "讓你暫時說話口齒不清。", unlocked: false, unlockConditions: { difficulty: 'medium', stars: 1, timeRange: [0, 30] } },
        { id: 212, name: "尷尬紅暈霜", desc: "臉頰會不由自主地變紅。", unlocked: false, unlockConditions: { difficulty: 'medium', stars: 1, timeRange: [31, 45] } },
        { id: 213, name: "磁力干擾劑", desc: "你身邊的湯匙和叉子會輕微顫抖。", unlocked: false, unlockConditions: { difficulty: 'medium', stars: 1, timeRange: [46, 60] } },
        { id: 214, name: "易怒辣椒油", desc: "喝下後，一點小事就可能讓你生氣。", unlocked: false, unlockConditions: { difficulty: 'medium', stars: 1, timeRange: [61, 75] } },
        { id: 215, name: "煮沸的泥水", desc: "看起來不太能喝的樣子...", unlocked: false, unlockConditions: { difficulty: 'medium', stars: 1, timeRange: [76, 9999] } },
        
        // --- 高級 (Hard) ---
        // 3 Stars
        { id: 301, name: "語言通曉藥劑", desc: "一個小時內，你能聽懂並說出任何一種語言。", unlocked: false, unlockConditions: { difficulty: 'hard', stars: 3, timeRange: [0, 50] } },
        { id: 302, name: "靈感之泉", desc: "文思泉湧，創意不斷！非常適合寫作和藝術創作。", unlocked: false, unlockConditions: { difficulty: 'hard', stars: 3, timeRange: [51, 70] } },
        { id: 303, name: "鷹眼精華", desc: "你的視力會變得像老鷹一樣敏銳。", unlocked: false, unlockConditions: { difficulty: 'hard', stars: 3, timeRange: [71, 90] } },
        { id: 304, name: "福靈劑", desc: "在接下來的一段時間裡，你會事事順利。", unlocked: false, unlockConditions: { difficulty: 'hard', stars: 3, timeRange: [91, 120] } },
        { id: 305, name: "貓之敏捷", desc: "你的動作變得像貓一樣輕盈敏捷。", unlocked: false, unlockConditions: { difficulty: 'hard', stars: 3, timeRange: [121, 9999] } },
        // 2 Stars
        { id: 306, name: "夢境漫遊劑", desc: "今晚你可以控制自己的夢境。", unlocked: false, unlockConditions: { difficulty: 'hard', stars: 2, timeRange: [0, 50] } },
        { id: 307, name: "回聲糖漿", desc: "你說的每句話都會延遲一秒後重複一次。", unlocked: false, unlockConditions: { difficulty: 'hard', stars: 2, timeRange: [51, 70] } },
        { id: 308, name: "氣味幻象劑", desc: "你可以讓周圍的人聞到任何你想像的味道。", unlocked: false, unlockConditions: { difficulty: 'hard', stars: 2, timeRange: [71, 90] } },
        { id: 309, name: "短暫隱形噴霧", desc: "可以隱形十秒鐘，時間一到就會現形。", unlocked: false, unlockConditions: { difficulty: 'hard', stars: 2, timeRange: [91, 120] } },
        { id: 310, name: "變調藥水", desc: "你的聲音音調會隨機忽高忽低。", unlocked: false, unlockConditions: { difficulty: 'hard', stars: 2, timeRange: [121, 9999] } },
        // 1 Star
        { id: 311, name: "黏呼呼之觸", desc: "你碰到的所有東西都會變得有點黏。", unlocked: false, unlockConditions: { difficulty: 'hard', stars: 1, timeRange: [0, 50] } },
        { id: 312, name: "增髮藥劑(副作用)", desc: "頭髮長得很快，但眉毛和鼻毛也一樣。", unlocked: false, unlockConditions: { difficulty: 'hard', stars: 1, timeRange: [51, 70] } },
        { id: 313, name: "色彩失真鏡片", desc: "你眼中的世界暫時失去了所有色彩。", unlocked: false, unlockConditions: { difficulty: 'hard', stars: 1, timeRange: [71, 90] } },
        { id: 314, name: "無感藥劑", desc: "暫時嚐不出任何食物的味道。", unlocked: false, unlockConditions: { difficulty: 'hard', stars: 1, timeRange: [91, 120] } },
        { id: 315, name: "爆炸失敗的藥渣", desc: "發出一聲悶響和一縷黑煙，什麼也沒發生。", unlocked: false, unlockConditions: { difficulty: 'hard', stars: 1, timeRange: [121, 9999] } },

        // --- 終極 (Ultimate) ---
        // 3 Stars
        { id: 401, name: "智慧賢者之釀", desc: "傳說中的魔藥，能讓你窺見知識的真理。", unlocked: false, unlockConditions: { difficulty: 'ultimate', stars: 3, timeRange: [0, 60] } },
        { id: 402, name: "時間旅人沙漏", desc: "可以讓時間暫停五秒鐘。", unlocked: false, unlockConditions: { difficulty: 'ultimate', stars: 3, timeRange: [61, 90] } },
        { id: 403, name: "元素親和劑", desc: "讓你能夠與風、水、火、土進行簡單的交流。", unlocked: false, unlockConditions: { difficulty: 'ultimate', stars: 3, timeRange: [91, 120] } },
        { id: 404, name: "萬物變形水", desc: "可以將一塊石頭變成一塊麵包，或是一隻蝴蝶。", unlocked: false, unlockConditions: { difficulty: 'ultimate', stars: 3, timeRange: [121, 160] } },
        { id: 405, name: "守護者星塵", desc: "一道溫和的光芒環繞著你，為你抵擋一次小小的厄運。", unlocked: false, unlockConditions: { difficulty: 'ultimate', stars: 3, timeRange: [161, 9999] } },
        // 2 Stars
        { id: 406, name: "心靈感應露水", desc: "可以模糊地感應到周遭人的情緒。", unlocked: false, unlockConditions: { difficulty: 'ultimate', stars: 2, timeRange: [0, 60] } },
        { id: 407, name: "魅影步伐", desc: "走路時完全不會發出聲音。", unlocked: false, unlockConditions: { difficulty: 'ultimate', stars: 2, timeRange: [61, 90] } },
        { id: 408, name: "雙倍生長劑", desc: "澆在植物上，它的大小會變成兩倍。", unlocked: false, unlockConditions: { difficulty: 'ultimate', stars: 2, timeRange: [91, 120] } },
        { id: 409, name: "天氣預報糖", desc: "嚐起來的味道會預示明天的天氣，酸是下雨，甜是晴天。", unlocked: false, unlockConditions: { difficulty: 'ultimate', stars: 2, timeRange: [121, 160] } },
        { id: 410, name: "永恆泡沫", desc: "吹出來的泡泡永遠不會破掉。", unlocked: false, unlockConditions: { difficulty: 'ultimate', stars: 2, timeRange: [161, 9999] } },
        // 1 Star
        { id: 411, name: "萬能鑰匙(仿)", desc: "看起來像萬能鑰匙，但其實什麼鎖都打不開。", unlocked: false, unlockConditions: { difficulty: 'ultimate', stars: 1, timeRange: [0, 60] } },
        { id: 412, name: "引力逆轉劑(微量)", desc: "你的頭髮會飄起來，僅此而已。", unlocked: false, unlockConditions: { difficulty: 'ultimate', stars: 1, timeRange: [61, 90] } },
        { id: 413, name: "縮小藥水(不穩定)", desc: "你的小指頭縮小了一半，幾分鐘後又變回來了。", unlocked: false, unlockConditions: { difficulty: 'ultimate', stars: 1, timeRange: [91, 120] } },
        { id: 414, "name": "遺忘之霧", "desc": "呃...我剛剛想說什麼來著？", "unlocked": false, "unlockConditions": { "difficulty": "ultimate", "stars": 1, "timeRange": [121, 160] } },
        { id: 415, name: "一鍋混沌", desc: "所有材料胡亂地混在一起，發出奇怪的顏色和氣味。", unlocked: false, unlockConditions: { difficulty: 'ultimate', stars: 1, timeRange: [161, 9999] } }
     ];
    
    function savePotions() {
        localStorage.setItem('wordPotionCollection', JSON.stringify(potions));
    }

    function loadPotions() {
        const savedPotions = localStorage.getItem('wordPotionCollection');
        if (savedPotions) {
            const parsedPotions = JSON.parse(savedPotions);
            potions.forEach(potion => {
                const saved = parsedPotions.find(p => p.id === potion.id);
                if (saved) {
                    potion.unlocked = saved.unlocked;
                }
            });
        }
    }


    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    function getWordsForDifficulty(difficulty) {
        const sourcePool = state.wordPool;
        let count;
        switch (difficulty) {
            case 'easy': count = 3; break;
            case 'medium': count = 5; break;
            case 'hard': count = 8; break;
            case 'ultimate': count = 10; break;
        }

        // Ensure we don't try to pick more words than available
        count = Math.min(count, sourcePool.length);
        
        const pickedWords = [];
        const usedIndices = new Set();
        
        while (pickedWords.length < count) {
            const randomIndex = Math.floor(Math.random() * sourcePool.length);
            if (!usedIndices.has(randomIndex)) {
                usedIndices.add(randomIndex);
                pickedWords.push(sourcePool[randomIndex]);
            }
        }
        
        return pickedWords.map(w => ({ en: w.word, ch: w.definitions[0].meaning }));
    }
    
    function updateDifficultyButtons() {
        const poolSize = state.wordPool.length;
        document.querySelector('.potion-difficulty-btn[data-difficulty="easy"]').disabled = poolSize < 3;
        document.querySelector('.potion-difficulty-btn[data-difficulty="medium"]').disabled = poolSize < 5;
        document.querySelector('.potion-difficulty-btn[data-difficulty="hard"]').disabled = poolSize < 8;
        document.querySelector('.potion-difficulty-btn[data-difficulty="ultimate"]').disabled = poolSize < 10;
    }

    function startGame(difficulty) {
         state.currentDifficulty = difficulty;
         dom.startScreen.classList.add('hidden');
         dom.gameScreen.classList.remove('hidden');
         dom.gameBoard.innerHTML = '';
         
         state.wordPairs = getWordsForDifficulty(difficulty);
         state.pairsLeft = state.wordPairs.length;
         state.mistakes = 0;
         updateMistakes();
         updateStars();
         clearInterval(state.timerInterval);
         startTimer();
         
         const bubblesData = [];
         state.wordPairs.forEach((pair, index) => {
            bubblesData.push({ text: pair.ch, pairId: index, lang: 'ch' });
            bubblesData.push({ text: pair.en, pairId: index, lang: 'en' });
         });
         shuffleArray(bubblesData);

         requestAnimationFrame(() => {
            bubblesData.forEach((data, i) => {
                const bubble = document.createElement('div');
                bubble.textContent = data.text;
                bubble.dataset.pairId = data.pairId;
                bubble.dataset.lang = data.lang;
                
                const isEnglish = data.lang === 'en';
                const size = isEnglish ? 'w-24 h-24 md:w-28 md:h-28 text-lg' : 'w-20 h-20 md:w-24 md:h-24 text-xl';
                const color = isEnglish ? 'bg-violet-500 border-violet-300' : 'bg-pink-500 border-pink-300';
                bubble.className = `potion-bubble ${size} ${color} border-4 font-bold shadow-lg`;
                
                let top, left, overlaps;
                const bubbleElements = Array.from(dom.gameBoard.children);
                let attempts = 0;
                do {
                    overlaps = false;
                    top = Math.random() * (dom.gameBoard.clientHeight - 150) + 40;
                    left = Math.random() * (dom.gameBoard.clientWidth - 150) + 20;
                     for (const existingBubble of bubbleElements) {
                        const rect1 = { top, left, width: 120, height: 120 };
                        const rect2 = {
                            top: parseFloat(existingBubble.style.top),
                            left: parseFloat(existingBubble.style.left),
                            width: 120, height: 120
                        };
                        if (rect1.left < rect2.left + rect2.width &&
                            rect1.left + rect1.width > rect2.left &&
                            rect1.top < rect2.top + rect2.height &&
                            rect1.top + rect1.height > rect2.top) {
                            overlaps = true;
                            break;
                        }
                    }
                    attempts++;
                } while(overlaps && attempts < 100);
                bubble.style.top = `${top}px`;
                bubble.style.left = `${left}px`;
                bubble.style.zIndex = i;
                bubble.style.animationDelay = `${Math.random() * 2}s`;
                dom.gameBoard.appendChild(bubble);
            });
         });
    }

    function startTimer() {
        state.startTime = Date.now();
        state.timerInterval = setInterval(() => {
            const elapsedTime = Math.floor((Date.now() - state.startTime) / 1000);
            const minutes = String(Math.floor(elapsedTime / 60)).padStart(2, '0');
            const seconds = String(elapsedTime % 60).padStart(2, '0');
            dom.timer.textContent = `時間: ${minutes}:${seconds}`;
        }, 1000);
    }
    
    function updateMistakes() {
        dom.mistakesCount.textContent = state.mistakes;
    }

    function updateStars() {
        const stars = dom.starRating.children;
        let filledStars = 3;
        if (state.mistakes >= 10) filledStars = 0;
        else if (state.mistakes >= 5) filledStars = 1;
        else if (state.mistakes >= 2) filledStars = 2;
        
        for (let i = 0; i < 3; i++) {
            stars[i].classList.toggle('filled', i < filledStars);
        }
    }

    function handleInteractionStart(e) {
        const target = e.target.closest('.potion-bubble');
        if (!target || target.classList.contains('paired')) return;
        
        e.preventDefault();
        state.isDragging = true;
        state.selectedBubble = target;
        target.classList.add('selected');
        
        const rect = target.getBoundingClientRect();
        const startX = rect.left + rect.width / 2;
        const startY = rect.top + rect.height / 2;
        
        dom.magicLine.setAttribute('x1', startX);
        dom.magicLine.setAttribute('y1', startY);
        dom.magicLine.setAttribute('x2', startX);
        dom.magicLine.setAttribute('y2', startY);
        dom.magicLine.style.display = 'block';
        
        window.addEventListener('mousemove', handleInteractionMove);
        window.addEventListener('touchmove', handleInteractionMove, { passive: false });
        window.addEventListener('mouseup', handleInteractionEnd);
        window.addEventListener('touchend', handleInteractionEnd);
    }

    function handleInteractionMove(e) {
        if (!state.isDragging) return;
        e.preventDefault();
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        dom.magicLine.setAttribute('x2', clientX);
        dom.magicLine.setAttribute('y2', clientY);
    }

    function handleInteractionEnd(e) {
        if (!state.isDragging) return;
        const endTarget = document.elementFromPoint(
            e.changedTouches ? e.changedTouches[0].clientX : e.clientX,
            e.changedTouches ? e.changedTouches[0].clientY : e.clientY
        );
        const targetBubble = endTarget ? endTarget.closest('.potion-bubble') : null;

        if (state.selectedBubble && targetBubble && state.selectedBubble !== targetBubble) {
            if (state.selectedBubble.dataset.pairId === targetBubble.dataset.pairId) {
                animateBubbleToCauldron(state.selectedBubble);
                animateBubbleToCauldron(targetBubble);
                dom.cauldron.classList.add('active');
                setTimeout(() => dom.cauldron.classList.remove('active'), 800);
                state.pairsLeft--;
                if (state.pairsLeft === 0) {
                    setTimeout(levelComplete, 1000);
                }
            } else {
                state.mistakes++;
                updateMistakes();
                updateStars();
            }
        }
        resetSelection();
    }

    function resetSelection() {
        state.isDragging = false;
        if(state.selectedBubble) {
            state.selectedBubble.classList.remove('selected');
            state.selectedBubble = null;
        }
        dom.magicLine.style.display = 'none';
        window.removeEventListener('mousemove', handleInteractionMove);
        window.removeEventListener('touchmove', handleInteractionMove);
        window.removeEventListener('mouseup', handleInteractionEnd);
        window.removeEventListener('touchend', handleInteractionEnd);
    }
    
    function animateBubbleToCauldron(bubble) {
        bubble.style.zIndex = 100;
        const bubbleRect = bubble.getBoundingClientRect();
        const cauldronRect = dom.cauldron.getBoundingClientRect();
        const destX = cauldronRect.left + cauldronRect.width / 2;
        const destY = cauldronRect.top + cauldronRect.height / 2;
        const startX = bubbleRect.left + bubbleRect.width / 2;
        const startY = bubbleRect.top + bubbleRect.height / 2;
        const deltaX = destX - startX;
        const deltaY = destY - startY;
        bubble.animate([
            { transform: 'scale(1.1)', opacity: 1 },
            { transform: `translate(${deltaX}px, ${deltaY}px) scale(0.1)`, opacity: 0 }
        ], {
            duration: 800,
            easing: 'cubic-bezier(0.55, 0.085, 0.68, 0.53)',
            fill: 'forwards'
        });
        bubble.classList.add('paired');
    }
    
    function checkUnlocks(difficulty, stars, time) {
        let unlockedPotion = null;
        const matchingPotion = potions.find(potion => {
            const cond = potion.unlockConditions;
            return !potion.unlocked &&
                   cond.difficulty === difficulty &&
                   cond.stars === stars &&
                   time >= cond.timeRange[0] &&
                   time <= cond.timeRange[1];
        });

        if (matchingPotion) {
            matchingPotion.unlocked = true;
            unlockedPotion = matchingPotion;
            savePotions();
        }
        return unlockedPotion;
    }

    function levelComplete() {
        clearInterval(state.timerInterval);
        const completionTime = Math.floor((Date.now() - state.startTime) / 1000);
        const finalStars = dom.starRating.querySelectorAll('.filled').length;
        
        dom.finalStarRating.innerHTML = dom.starRating.innerHTML;
        dom.completionTime.textContent = `完成時間: ${completionTime} 秒`;
        
        const newlyUnlockedPotion = checkUnlocks(state.currentDifficulty, finalStars, completionTime);

        if (newlyUnlockedPotion) {
            dom.rewardSection.classList.remove('hidden');
            dom.noRewardSection.classList.add('hidden');
            dom.potionName.textContent = newlyUnlockedPotion.name;
            dom.potionDesc.textContent = newlyUnlockedPotion.desc;
        } else {
            dom.rewardSection.classList.add('hidden');
            dom.noRewardSection.classList.remove('hidden');
        }
        
        dom.levelCompleteModal.classList.remove('hidden');
    }
    
    function showCollection() {
        const grid = dom.collectionGrid;
        grid.innerHTML = '';
        const difficultyMap = {
            'easy': '初級', 'medium': '中級', 'hard': '高級', 'ultimate': '終極'
        };
        
        potions.forEach(potion => {
            const item = document.createElement('div');
            if (potion.unlocked) {
                item.className = "bg-gray-900/50 rounded-lg p-4 border border-violet-500 text-left";
                item.innerHTML = `
                    <h3 class="text-xl font-bold text-violet-300">${potion.name}</h3>
                    <p class="text-gray-400">${potion.desc}</p>
                `;
            } else {
                const cond = potion.unlockConditions;
                const difficultyText = difficultyMap[cond.difficulty];
                const starText = '★'.repeat(cond.stars) + '☆'.repeat(3 - cond.stars);
                const timeText = `${cond.timeRange[0]} - ${cond.timeRange[1]} 秒`;
                item.className = "bg-gray-900/50 rounded-lg p-4 border border-gray-600 text-left opacity-60";
                item.innerHTML = `
                    <h3 class="text-xl font-bold text-gray-500">未解鎖的魔藥</h3>
                    <p class="text-gray-500 mt-2">
                        <span class="font-semibold">條件:</span> ${difficultyText} |
                        <span class="text-yellow-400">${starText}</span> |
                        ${timeText}
                    </p>
                `;
            }
            grid.appendChild(item);
        });
        
        dom.startScreen.classList.add('hidden');
        dom.collectionModal.classList.remove('hidden');
    }
    
    function hideCollection() {
        dom.collectionModal.classList.add('hidden');
        dom.startScreen.classList.remove('hidden');
    }
    
    function showMenu(){
        dom.gameScreen.classList.add('hidden');
        dom.levelCompleteModal.classList.add('hidden');
        dom.startScreen.classList.remove('hidden');
        clearInterval(state.timerInterval);
    }

    function setupEventListeners() {
        document.querySelectorAll('.potion-difficulty-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if(!btn.disabled) {
                    startGame(btn.dataset.difficulty)
                }
            });
        });
        dom.backToMenuBtn.addEventListener('click', showMenu);
        dom.mainMenuBtn.addEventListener('click', showMenu);
        dom.replayBtn.addEventListener('click', () => {
            dom.levelCompleteModal.classList.add('hidden');
            startGame(state.currentDifficulty);
        });
        dom.collectionBtn.addEventListener('click', showCollection);
        dom.collectionBackBtn.addEventListener('click', hideCollection);
        dom.gameBoard.addEventListener('mousedown', handleInteractionStart);
        dom.gameBoard.addEventListener('touchstart', handleInteractionStart, { passive: false });
    }

    window.potionGame = {
        init: (wordPool) => {
            state.wordPool = wordPool;
            updateDifficultyButtons();
            dom.startScreen.classList.remove('hidden');
            dom.gameScreen.classList.add('hidden');
            dom.levelCompleteModal.classList.add('hidden');
            dom.collectionModal.classList.add('hidden');
            loadPotions();
            // Setup listeners only once
            if(!window.potionGame.initialized) {
                 setupEventListeners();
                 window.potionGame.initialized = true;
            }
        },
        end: () => {
            clearInterval(state.timerInterval);
            dom.startScreen.classList.remove('hidden');
            dom.gameScreen.classList.add('hidden');
        }
    };
})();


// --- 特效函式 ---
function triggerExplosion(x, y) {
    const fxContainer = document.getElementById('fx-container');
    if (!fxContainer) return;
    
    const particleCount = 20;
    const shockwave = document.createElement('div');
    shockwave.style.position = 'absolute';
    shockwave.style.left = `${x}px`;
    shockwave.style.top = `${y}px`;
    shockwave.style.borderRadius = '50%';
    shockwave.style.border = '3px solid rgba(255, 59, 59, 0.7)';
    shockwave.style.transform = 'translate(-50%, -50%) scale(0)';
    shockwave.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
    fxContainer.appendChild(shockwave);

    requestAnimationFrame(() => {
        shockwave.style.transform = 'translate(-50%, -50%) scale(1.5)';
        shockwave.style.opacity = '0';
    });
    setTimeout(() => shockwave.remove(), 300); // 動畫結束後移除自身

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'absolute';
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;
        particle.style.background = `hsl(${Math.random() * 50}, 100%, 50%)`;
        particle.style.width = `${Math.random() * 10 + 5}px`;
        particle.style.height = `${Math.random() * 10 + 5}px`;
        particle.style.clipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)';
        particle.style.transition = 'transform 0.5s ease-out, opacity 0.5s ease-out';
        
        const angle = Math.random() * 2 * Math.PI;
        const distance = Math.random() * 80 + 50;
        const finalX = Math.cos(angle) * distance;
        const finalY = Math.sin(angle) * distance;
        const rotation = Math.random() * 720 - 360;

        fxContainer.appendChild(particle);

        requestAnimationFrame(() => {
            particle.style.transform = `translate(-50%, -50%) translate(${finalX}px, ${finalY}px) rotate(${rotation}deg)`;
            particle.style.opacity = '0';
        });
        setTimeout(() => particle.remove(), 500); // 動畫結束後移除自身
    }
}
function triggerSuccessPageConfetti() { /* ... 保持原樣 ... */ }
function triggerClickConfetti(x, y) {
    const fxContainer = document.getElementById('fx-container');
    if (!fxContainer) return;
    
    const particleCount = 30;
    const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#00bcd4', '#4caf50', '#ffeb3b', '#ff9800'];

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'absolute';
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;
        particle.style.background = colors[Math.floor(Math.random() * colors.length)];
        particle.style.width = `${Math.random() * 8 + 4}px`;
        particle.style.height = `${Math.random() * 15 + 8}px`;
        particle.style.transition = 'transform 0.8s cubic-bezier(0.1, 0.9, 0.2, 1), opacity 0.8s linear';

        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 120 + 80;
        const finalX = Math.cos(angle) * distance;
        const finalY = Math.sin(angle) * distance - 40 + (Math.random() * 250);
        const rotation = Math.random() * 1080 - 540;

        fxContainer.appendChild(particle);

        requestAnimationFrame(() => {
            particle.style.transform = `translate(-50%, -50%) translate(${finalX}px, ${finalY}px) rotate(${rotation}deg)`;
            particle.style.opacity = '0';
        });
        setTimeout(() => particle.remove(), 800); // 動畫結束後移除自身
    }
}

// --- 初始化 ---
window.onload = () => {
    // 頁面載入時，首先執行一次單字去重功能
    removeDuplicateWords();

    function loadVoices() {
        const voices = speechSynthesis.getVoices();
        // 優先選擇 Google US English，其次是任何 US English，最後是第一個英文語音
        synthesisVoice = voices.find(voice => voice.name === 'Google US English') || 
                         voices.find(voice => voice.lang === 'en-US') ||
                         voices.find(voice => voice.lang.startsWith('en-'));
    }

    // 語音是異步載入的
    loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadVoices;
    }

    organizeAndSortWords();
    showPage('home-page');
    document.getElementById('search-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            searchWord();
        }
    });
};

