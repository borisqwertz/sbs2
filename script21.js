// Constants for DOM elements and images
const imgDome = '<img src="images/dome.svg" alt="dome" height="auto" width="100%" id="dome">';
const imgLevel1 = '<img src="images/buildLevel.svg" alt="level" height="auto" width="100%" id="level1">';

// Game state variables
let droppedInCell, oldCell, currentClass, currentToken;
let turnNumber = 1;
let touchMove, touchBuild, touchDome, touchRemove;
let boardHistory = [];
let userSavedBoard;
let historyIndex = -1;
const MAX_HISTORY = 5000;
let gMessage = [];

let player1 = $("#p1Button").text() == "Player 1" ? "White" : "god";;
// todo function handle godnames

// Detect touch device
// Detect touch device and set global touchMode flag
let touchMode = (() => {
    // Primary detection methods
    const isTouch =
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        navigator.msMaxTouchPoints > 0;

    // Secondary detection for older browsers
    if (!isTouch) {
        try {
            document.createEvent('TouchEvent');
            return true;
        } catch (e) { }
    }

    return isTouch;
})();

// Initialize the game
$(document).ready(function () {
    initializeGameState();
    drawTestBoard();
    initHistoryPanel();
    setupEventHandlers();
    console.log("Santorini Board initialized");
    // player1 = $("#p1Button").text();
    // console.log(player1+"pl");
    // player1 = $("#p1Button").text() == "Player 1" ? "White" : "god";
});

function initializeGameState() {
    const initialState = saveBoardstate();
    boardHistory = [initialState];
    gMessage = [""];
    historyIndex = 0;
}

/**
 * Sets up all event handlers for the game
 */
function setupEventHandlers() {
    // Game control buttons
    $("#userSaveButton").click(handleUserSave);
    $("#userLoadButton").click(handleUserLoad);
    $("#historySaveButton").click(() => saveBoardstate(boardHistory));

    $("#helpButton").click(showHelp);

    // History navigation
    $("#backButton").click(() => navigateHistory(-1));
    $("#forthButton").click(() => navigateHistory(1));
    $("#startButton").click(goToStart);
    $("#endButton").click(goToEnd);
    $("#copyHistoryButton").click(copyHistory);
    $("#screenShotButton").click(screenshotBoard);
    $("#screenShotNoCoordsButton").click(screenshotBoardNoCoords);

    $("#importHistoryButton").click(function () {
        const history = prompt("(experimental/broken token movement) paste copied history:");
        if (history) {
            // Normalize input
            const normalized = history
                .replace(/(\d+)\.(\S)/g, '$1. $2') // Add space after numbers
                .replace(/\s+/g, ' ')
                .trim();

            importHistory(normalized);
        }
    });

    $("#importBGAButton").click(function () {
        const history = prompt("(experimental) paste full bga replay (from STRG+A STRG+C):");
        if (history) {
            importFromBGA(history);
        }
    });

    // Game management
    $("#writeURLButton").click(writeURL);
    $("#loadBoardButton").click(() => location.reload());
    $("#resetButton").click(resetGame);
    $("#createShortURLButton").click(() => { writeURL(); createShortURL(); });
    $("#textURL").click(function () { this.select(); });

    $("#toggleTouchButton").click(() => { enabledisableTouch(); });


    // Player setup
    $("#p1Button, #p2Button, #p3Button, #p4Button").click(function () {
        $(this).text($("#godslist").val());
    });

    // Board interactions
    setupBoardInteractions();
    setupDragAndDrop();
    setupTouchSupport();

    // Add hotkey handler
    $(document).on('keydown', handleHotkeys);

    $(".dropZone, #historyPanel").on('wheel', function (e) {  // todo maybe simple change to body
        // Prevent default scrolling
        e.preventDefault();
        if (e.originalEvent.deltaY < 0) {
            navigateHistory(-1);
        } else {
            navigateHistory(1);
        }

    });

    // // todo for testing
    // $(document).on('keydown', console.log("current key " + e.key.toLowerCase()));
}

function handleHotkeys(e) {
    // Ignore keys when focused on inputs
    if ($(e.target).is('input, textarea, select')) return;

    const key = e.key.toLowerCase();
    const ctrlCmd = e.ctrlKey || e.metaKey;
    console.log("current key " + key);


    // Navigation
    switch (key) {
        case 'a':
        case 'arrowleft':
        case 'backspace':
            e.preventDefault();
            $("#backButton").click();
            break;

        case 'd':
        case 'arrowright':
        case 'enter':
            e.preventDefault();
            $("#forthButton").click();
            break;

        case 'w':
        case 'arrowup':
        case 'home':
            e.preventDefault();
            $("#startButton").click();
            break;

        case 's':
        case 'arrowdown':
        case 'end':
            e.preventDefault();
            $("#endButton").click();
            break;
    }

    // // Save/Load
    // if (ctrlCmd) {
    //     switch (key) {
    //         case 's':
    //             e.preventDefault();
    //             $("#userSaveButton").click();
    //             break;

    //         case 'l':
    //             e.preventDefault();
    //             $("#userLoadButton").click();
    //             break;

    //         // case 'h':
    //         //     e.preventDefault();
    //         //     $('#historyPanel').toggle();

    //         //     break;
    //     }
    // }
}


function handleUserSave() {
    const currentState = saveBoardstate();
    userSavedBoard = currentState;

    // Only add new state if different from current history
    if (currentState !== boardHistory[historyIndex]) {
        updateHistory(currentState);
    }


    showFeedback("#userSaveButton", `${historyIndex}. ${gMessage[historyIndex]}`, 'mark turn');
    showFeedback("#userLoadButton", `-> ${historyIndex}. ${gMessage[historyIndex]}`, `-> ${historyIndex}. ${gMessage[historyIndex]}`);
}

function handleUserLoad() {
    if (!userSavedBoard) {
        return;
    }

    const existingIndex = boardHistory.findIndex(state => state === userSavedBoard);

    if (existingIndex !== -1) {
        historyIndex = existingIndex;
        drawTestBoard(userSavedBoard);
    } else {
        updateHistory(userSavedBoard);
        drawTestBoard(userSavedBoard);
    }
}

function showFeedback(selector, tempText, originalText) {
    // Pad tempText with non-breaking spaces if shorter
    const paddedText = tempText.length < originalText.length
        ? tempText + '\u00A0'.repeat(originalText.length - tempText.length)
        : tempText;
    $(selector)
        .addClass("active-feedback")
        .html(paddedText.replace(/ /g, '&nbsp;')) // Replace spaces with &nbsp;
        .delay(1000)
        .queue(function () {
            $(this)
                .removeClass("active-feedback")
                .text(originalText)
                .dequeue();
        });
}

/**
 * Handles mouse interactions with the game board
 */
function setupBoardInteractions() {
    $(".dropZone").mousedown(function (e) {
        e.preventDefault();
        // Skip if interacting with a worker/token or in move mode
        // todo
        if ($(".workerOnField:hover").length > 0 || $(".tokenOnField:hover").length > 0 || touchMove) {
            // if (touchBuild || touchDome || touchRemove) { } else
            return;
        }

        const $cell = $(this);
        let blocks = Number($cell.attr("data-b"));

        // Handle different interaction modes
        if (touchBuild) handleBuildAction($cell, blocks);
        else if (touchRemove) handleRemoveAction($cell, blocks);
        else if (touchDome) handleDomeAction($cell);
        else handleDefaultClickActions($cell, blocks, e.which);

        draw($cell);
        // resetDragState(); // just in case
        // saveBoardstate(boardHistory);
    });
}

/**
 * Handles build actions (blocks and domes)
 */
function handleBuildAction($cell, blocks) {
    if (blocks < 3 && $cell.attr("data-d") == 0) {
        $cell.attr("data-b", blocks + 1);
        logAction(`${$cell.attr("id")}(${blocks + 1})`);
    }
    else if ($cell.attr("data-d") == 0) {
        $cell.attr("data-d", "1");
        logAction(`${$cell.attr("id")}(X)`);
    }
}

/**
 * Handles remove actions (blocks and domes)
 */
function handleRemoveAction($cell, blocks) {
    if ($cell.attr("data-d") == 1) {
        $cell.attr("data-d", "0");
        logAction(`${$cell.attr("id")}(${blocks})-`);
    }
    else if (blocks > 0) {
        $cell.attr("data-b", blocks - 1);
        logAction(`${$cell.attr("id")}(${blocks - 1})-`);
    }
}

/**
 * Toggles dome state
 */
function handleDomeAction($cell) {
    const newState = $cell.attr("data-d") == "1" ? "0" : "1";
    $cell.attr("data-d", newState);
    //  logAction(`${newState == "1" ? "BUILD" : "remove"} dome on ${$cell.attr("id")}`);
    logAction(`${$cell.attr("id")}${newState == "1" ? "(X)" : `(${$cell.attr("data-b")})-`}`);
}

/**
 * Handles default click actions based on mouse button
 */
function handleDefaultClickActions($cell, blocks, mouseButton) {
    switch (mouseButton) {
        case 1: // Left click - build
            handleBuildAction($cell, blocks)
            break;

        case 3: // Right click - remove
            handleRemoveAction($cell, blocks)
            break;

        case 2: // Middle click - toggle dome
            // todo preven moddle mouse scroll symbol Event.preventDefault();
            handleDomeAction($cell);
            break;
    }
}

/**
 * Sets up drag and drop functionality for workers and tokens
 */
function setupDragAndDrop() {
    // Toolbox figures
    $(".figures").draggable({
        helper: "clone",
        start: function () {
            $(this).css("z-index", 7000); // todo works for now dragged stuff is in the foreground
            console.log("hello");
            currentToken = $(this).attr("data-t");
        }
    });

    // Workers and tokens on the board
    $("body")
        .on("dragstart", ".workerOnField, .tokenOnField", function () {
            droppedInCell = false;
            oldCell = $(this).parent().attr("id");

            currentClass = $(this).attr("data-w");
            currentToken = $(this).attr("data-t");
        })
        .on("dragstop", ".workerOnField, .tokenOnField", function () {

            if (!droppedInCell) handleDroppedOutside();
        });

    // Drop zones
    $(".dropZone").droppable({
        accept: ".figures, .workerOnField, .tokenOnField",
        drop: handleDrop
    });
}

/**
 * Handles items dropped outside valid cells
 */
function handleDroppedOutside() {
    console.log("droppped Outside");
    console.log("ui dragggable" + $(this).attr("data-w"));
    if (!oldCell) { console.log("no old cell"); return };

    if (currentClass) {
        $("#" + oldCell).attr("data-w", "0");
        // logAction(`remove ${$("#" + oldCell).attr("data-w")} from ${oldCell}`);
        logAction(`${oldCell}-X-${currentClass}`);
    }
    else {
        // Remove the appropriate token
        for (let i = 1; i <= 4; i++) {
            if ($("#" + oldCell).attr(`data-t${i}`) == currentToken) {
                $("#" + oldCell).attr(`data-t${i}`, "0");
                logAction(`${oldCell}-X-${currentToken}`);
                break;
            }
        }
    }

    draw($("#" + oldCell));
    resetDragState();
}

/**
 * Handles drops onto valid cells
 */
function handleDrop(event, ui) {
    droppedInCell = true;
    const $cell = $(this);

    // Ignore drop on same cell
    if ($cell.attr("id") == oldCell) return;

    const currentWorker = $(ui.draggable).attr("data-w");

    // Handle worker placement
    if (currentWorker && $cell.attr("data-d") == 0) {
        $cell.attr("data-w", currentWorker);
        if (!oldCell) {
            logAction(`${$cell.attr("id")}-${currentWorker}`);
        }
    }

    // Handle token placement
    if (currentToken) {
        for (let i = 1; i <= 4; i++) {
            if ($cell.attr(`data-t${i}`) == "0") {
                $cell.attr(`data-t${i}`, currentToken);
                if (!oldCell)
                    logAction(`${$cell.attr("id")}-${currentToken}`);
                break;
            }
        }
    }

    // Handle movement from old cell
    if (oldCell) {
        if (currentWorker) {
            $("#" + oldCell).attr("data-w", "0");
            logAction(`${oldCell}-${$cell.attr("id")}`);
        }
        else {
            for (let i = 1; i <= 4; i++) {
                if ($("#" + oldCell).attr(`data-t${i}`) == currentToken) {
                    $("#" + oldCell).attr(`data-t${i}`, "0");
                    logAction(`${oldCell}-${$cell.attr("id")}-${currentToken}`);
                    break;
                }
            }
        }
        draw($("#" + oldCell));
    }

    draw($cell);
    resetDragState();
}

/**
 * Resets drag state variables
 */
function resetDragState() {
    droppedInCell = oldCell = currentClass = currentToken = false;
}

/**
 * Sets up touch support for mobile devices
 */
function setupTouchSupport() {
    const modes = [
        { id: "moveButton", text: "move", mode: () => touchMove = 1 },
        { id: "domeButton", text: "dome", mode: () => touchDome = 1 },
        { id: "removeButton", text: "remove", mode: () => touchRemove = 1 },
        { id: "buildButton", text: "build", mode: () => touchBuild = 1 }
    ];

    modes.forEach(m => {
        $(".touchDiv").append(
            $(`<button type="button" id="${m.id}">${m.text}</button>`)
                .click(function () {
                    if (touchMode) {
                        touchBuild = touchDome = touchRemove = touchMove = 0;
                        m.mode();
                        modes.forEach(m => $(`#${m.id}`).css("background-color", ""));
                        $(this).css("background-color", "rgb(191 75 75)");
                    }
                })
        );
    });


    if (touchMode) {
        $("#moveButton").css("background-color", "rgb(191 75 75)");
        $("#toggleTouch").prop("checked", true);

        touchMove = 1;
        touchBuild = touchDome = touchRemove = 0;
    }

}

function enabledisableTouch() {
    touchMode == false ? touchMode = true : touchMode = false;
    if (touchMode) {
        $("#moveButton").css("background-color", "rgb(191 75 75)");
        $("#toggleTouch").prop("checked", true);

        touchMove = 1;
        touchBuild = touchDome = touchRemove = 0;
    } else {
        $("#moveButton, #domeButton, #removeButton , #buildButton").css("background-color", " #3a3a3a");
        $("#toggleTouch").prop("checked", false);
        touchMove = touchBuild = touchDome = touchRemove = 0;
    }

}



/**
 * Draws the contents of a cell based on its data attributes
 */
function draw(tdToFill) {
    const $cell = $(tdToFill);
    $cell.empty();
    // Add cleanup for cloned elements
    $cell.find('.workerOnField, .tokenOnField').draggable('destroy').remove();
    // Before adding new elements



    // Draw dome if present
    if ($cell.attr("data-d") == "1") {
        $cell.prepend(imgDome);
    }

    // Draw building levels
    const blocks = Number($cell.attr("data-b"));
    for (let i = 0; i < blocks; i++) {
        $cell.append(imgLevel1);
    }

    // Draw tokens (4 possible slots)
    for (let i = 4; i >= 1; i--) {
        const token = $cell.attr(`data-t${i}`);
        if (token != "0") {
            $cell.prepend(
                $(`#${token}`).clone()
                    .draggable({ helper: "clone" })
                    .css("position", "static")
                    .addClass("tokenOnField")
            );
        }
    }

    // Draw worker if present
    const worker = $cell.attr("data-w");
    if (worker != "0") {
        $cell.prepend(
            $(`#${worker}`).clone()
                .draggable({ helper: "clone" })
                .css("position", "static")
                .addClass("workerOnField")
        );
    }
}

/**
 * Clears and resets the entire board
 */
function clearBoard() {
    $(".dropZone").each(function () {
        $(this).empty().attr({
            'data-d': '0',
            'data-b': '0',
            'data-w': '0',
            'data-t1': '0',
            'data-t2': '0',
            'data-t3': '0',
            'data-t4': '0'
        });
    });
}



/**
 * Logs an action to the game log
 */
function logAction(message) {

    // Save state to history after each action
    const currentState = saveBoardstate();
    if (currentState !== boardHistory[historyIndex]) {

        updateHistory(currentState, message);
    }

}

/**
 * Resets the game to initial state
 */
function resetGame() {
    window.history.replaceState({}, '', location.pathname);
    boardHistory = [""];
    gMessage = [""];
    historyIndex = 0;

    drawTestBoard();
    //not neeed anymore location.reload();
}

function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}
/**
 * Updates the URL with the current game state
 */
function writeURL() {
    window.history.replaceState({}, '', location.pathname);
    const newParams = saveBoardstate();
    window.history.replaceState({}, '', `${location.pathname}?${newParams}`);
}

/**
 * Saves the current board state
 */
function saveBoardstate(target = {}) {
    const params = new URLSearchParams();
    const defaultPlayerNames = ["Player 1", "Player 2", "Player 3", "Player 4"];

    // Save cell states
    $(".dropZone").each(function () {
        const $cell = $(this);
        const cellId = $cell.attr("id");

        ['b', 'd', 'w', 't1', 't2', 't3', 't4'].forEach(attr => {
            const value = $cell.attr(`data-${attr}`);
            if (value && value !== "0" && !(attr === "d" && value !== "1")) {
                params.set(`${cellId}-${attr}`, value);
            }
        });
    });

    // Save player names
    for (let i = 1; i <= 4; i++) {
        const playerName = $(`#p${i}Button`).text();
        if (playerName !== defaultPlayerNames[i - 1]) {
            params.set(`p${i}`, playerName);
        }
    }

    const stateString = params.toString();

    // Handle different output targets
    if (typeof target === 'object') {
        if (Array.isArray(target)) {
            target.push(stateString);
        }
        else if (target !== null) {
            Object.assign(target, { boardState: stateString });
        }
    }
    else if (typeof target === 'string') {
        window[target] = stateString;
    }

    return stateString;
}

/**
 * Initializes the history panel
 */
function initHistoryPanel() {
    // Override array push to auto-update history panel
    const originalPush = Array.prototype.push;
    Array.prototype.push = function () {
        const result = originalPush.apply(this, arguments);
        if (this === boardHistory) updateHistoryItems();
        return result;
    };
}

/**
 * Updates the history items display
 */
function updateHistoryItems() {
    const $historyItems = $('#historyItems').empty();

    if (boardHistory.length === 0) {
        $historyItems.append('<div>No history yet</div>');
        return;
    }

    boardHistory.forEach((state, index) => {
        const isCurrent = index === historyIndex;
        //todo change the text default: index+1          ${index}.  ${index > 0 ? gMessage : ""}        ${index }. ${state.length > 30 ? state.substring(0, 30) + '...' : state}  
        $historyItems.append(`
            <div style="padding: 5px; border-bottom: 1px solid #eee; cursor: pointer;     width: fit-content; float: left;
                        ${isCurrent ? 'background:rgb(135, 70, 70); font-weight: bold;' : ''}" 
                 data-index="${index}">
                ${index}. ${gMessage[index]}  
            </div>
        `);
    });

    $('#historyItems div[data-index]').click(function () {
        historyIndex = $(this).data('index');
        drawTestBoard(boardHistory[historyIndex]);
    });
}

/**
 * Updates the game history with the current state
 */
function updateHistory(boardStateToAdd, message) {
    // Remove future states if not at end
    if (historyIndex < boardHistory.length - 1) {
        boardHistory = boardHistory.slice(0, historyIndex + 1);
        //todo not sure if right way
        gMessage = gMessage.slice(0, historyIndex + 1);
    }

    // Add new state only if different from current
    if (boardStateToAdd !== boardHistory[historyIndex]) {
        boardHistory.push(boardStateToAdd);
        gMessage.push(message == undefined ? "url" : message);
        historyIndex++;
    }

    // Limit history size
    while (boardHistory.length > MAX_HISTORY) {
        boardHistory.shift();
        historyIndex = Math.max(historyIndex - 1, 0);
    }

    updateHistoryItems();
}

/**
 * Navigates through history
 */
// Navigation functions with boundary checks
function navigateHistory(direction) {
    const newIndex = historyIndex + direction;

    // Validate new index range
    if (newIndex >= 0 && newIndex < boardHistory.length) {
        historyIndex = newIndex;
        drawTestBoard(boardHistory[historyIndex]);
        updateHistoryItems();
    } else {
        console.log("Reached history boundary");
        // Optional: Add visual feedback
    }
}


/**
 * Copy history/gMessage to clipboard
 */
function copyHistory() {
    // Replace line breaks/tabs with space // Collapse multiple spaces // Trim whitespace // Remove leading "0. "
    let str = $('#historyItems').text().replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^0\.\s+/, '');
    navigator.clipboard.writeText(str);
    showFeedback("#copyHistoryButton", "Copied", "Copy History");
}


/**
 * Goes to the first state in history
 */
function goToStart() {
    if (boardHistory.length > 0) {
        historyIndex = 0;
        drawTestBoard(boardHistory[0]);
    }
}

/**
 * Goes to the most recent state in history
 */
function goToEnd() {
    if (boardHistory.length > 0) {
        historyIndex = boardHistory.length - 1;
        drawTestBoard(boardHistory[historyIndex]);
    }
}

/**
 * 
 * draws the board
 */
function drawTestBoard(boardState) {
    clearBoard();

    let params;
    let isFromHistory = false;
    const validAttributes = new Set(['b', 'd', 'w', 't1', 't2', 't3', 't4']);
    const cellUpdates = new Map(); // To batch cell updates

    // Determine state source
    if (typeof boardState === 'undefined' || boardState === null) {
        params = new URLSearchParams(window.location.search.slice(1));
    } else if (typeof boardState === 'string') {
        isFromHistory = boardHistory.includes(boardState);
        params = new URLSearchParams(boardState);
    } else {
        console.error("Invalid board state provided");
        return;
    }

    // Batch process parameters
    for (const [key, value] of params.entries()) {
        // Handle player names first
        if (key.startsWith('p') && key.length === 2) {
            const playerNum = key[1];
            if (playerNum >= 1 && playerNum <= 4) {
                $(`#p${playerNum}Button`).text(value);
            }
            continue;
        }

        // Process cell attributes
        const cellId = key.slice(0, 2).toUpperCase();
        const attribute = key.slice(3);

        if (!validAttributes.has(attribute)) {
            if (!key.startsWith('p')) console.warn("Unknown attribute:", attribute);
            continue;
        }

        // Group updates by cell ID
        if (!cellUpdates.has(cellId)) {
            cellUpdates.set(cellId, { $cell: $(`#${cellId}`), attrs: {} });
        }
        cellUpdates.get(cellId).attrs[attribute] = value;
    }

    // Apply batched cell updates
    cellUpdates.forEach(({ $cell, attrs }) => {
        if (!$cell.length) {
            console.warn("Invalid cell ID:", $cell.attr('id'));
            return;
        }

        // Set all attributes at once
        Object.entries(attrs).forEach(([attr, val]) => {
            $cell.attr(`data-${attr}`, val);
        });

        draw($cell); // Single draw call per cell
    });

    // Update history state
    if (!isFromHistory) {
        const currentState = saveBoardstate();
        if (boardHistory[historyIndex] !== currentState) {
            updateHistory(currentState);
        }
    }

    // Batch UI updates
    requestAnimationFrame(() => {
        updateHistoryItems();
    });
}

function importHistory(historyString) {
    resetGame();
    let previousStates = [];
    let historyCounter = 0;

    // Improved parsing with URL filtering
    const actions = historyString
        .split(/(\d+)\.\s+/)
        .filter(a => {
            const clean = a.trim();
            return clean && !clean.toLowerCase().includes('url') && !/^\d+$/.test(clean);
        });

    actions.forEach((rawAction, index) => {
        const action = rawAction.trim();
        if (!action || action === 'url') return;

        // Store state before modification
        previousStates.push(saveBoardstate());

        // Process action types
        if (action.endsWith('(X)')) { // DOME PLACEMENT
            const cell = action.split('(')[0];
            const $cell = $(`#${cell.toUpperCase()}`);
            $cell.attr('data-d', '1'); // Set dome without changing blocks
        }
        else if (action.match(/\(\d+\)/)) { // BLOCK BUILDING
            const [cell, level] = action.split(/[()]/);
            const $cell = $(`#${cell.toUpperCase()}`);
            $cell.attr('data-b', level).attr('data-d', '0');
        }
        else if (action.includes('-X-')) { // REMOVAL
            const [cell, _, target] = action.split('-');
            const $cell = $(`#${cell.toUpperCase()}`);

            if (target.match(/^[WRBY][mf]$/)) {
                $cell.attr('data-w', '0');
            } else {
                for (let i = 1; i <= 4; i++) {
                    if ($cell.attr(`data-t${i}`) === target) {
                        $cell.attr(`data-t${i}`, '0');
                        break;
                    }
                }
            }
        }
        else if (action.match(/-[WRBY][fmt]$/)) { // DIRECT PLACEMENT
            const [cell, piece] = action.split('-');
            const $cell = $(`#${cell.toUpperCase()}`);

            if (piece.endsWith('t')) {
                for (let i = 1; i <= 4; i++) {
                    if ($cell.attr(`data-t${i}`) === '0') {
                        $cell.attr(`data-t${i}`, piece);
                        break;
                    }
                }
            } else {
                $cell.attr('data-w', piece);
            }
        }
        else if (action.includes('-')) { // MOVEMENT
            const parts = action.split('-');
            const fromCell = parts[0];
            const toCell = parts[1];
            const piece = parts[2];

            const $from = $(`#${fromCell.toUpperCase()}`);

            const $to = $(`#${toCell.toUpperCase()}`);

            // Handle all token types (Wt/Bt/Rt/Yt)
            if (piece?.match(/^[WRBY]t$/i)) { // Case-insensitive match
                let moved = false;
                // Remove from source
                for (let i = 1; i <= 4; i++) {
                    if ($from.attr(`data-t${i}`) === piece.toUpperCase()) { // Ensure uppercase
                        $from.attr(`data-t${i}`, '0');
                        moved = true;
                        break;
                    }
                }
                // Add to target
                if (moved) {
                    for (let j = 1; j <= 4; j++) {
                        if ($to.attr(`data-t${j}`) === '0') {
                            $to.attr(`data-t${j}`, piece.toUpperCase());
                            break;
                        }
                    }
                }
                // Force redraw of both cells
                draw($from);
                draw($to);
            }
            else if ($from.attr('data-w') !== '0') { // WORKER MOVEMENT
                const worker = $from.attr('data-w');
                $to.attr('data-w', worker);
                $from.attr('data-w', '0');
                draw($from);
                draw($to);
            }
        }

        else if (action.endsWith('-')) { // BLOCK/DOME REMOVAL
            const cleanAction = action.replace('-', '');
            const [cell, value] = cleanAction.split(/[()]/);
            const $cell = $(`#${cell.toUpperCase()}`);

            // Get previous state from our stored array
            const prevParams = new URLSearchParams(previousStates[index]);
            const prevDome = prevParams.get(`${cell}-d`);
            const prevBlocks = prevParams.get(`${cell}-b`);

            if (prevDome === '1') {
                $cell.attr('data-d', '0');
            } else {
                $cell.attr('data-b', Math.max(0, parseInt(prevBlocks) - 1));
            }
        }

        // Update visuals and history without URL entries
        draw($(`#${action.substring(0, 2).toUpperCase()}`));
        const newState = saveBoardstate();
        updateHistory(newState, action);
        historyCounter++;
    });

    // Clean final history from any URL entries
    boardHistory = boardHistory.filter((_, i) => gMessage[i] !== 'url');
    gMessage = gMessage.filter(m => m !== 'url');
    historyIndex = boardHistory.length - 1;

    drawTestBoard();
    console.log("Imported", historyCounter, "actions successfully");
}


function screenshotBoard() {
    const element = document.getElementById('gameBoardtable');
    const now = new Date();
    let name = "sbs " + now.toLocaleString() + ".png";


    domtoimage.toPng(element)
        .then(function (dataUrl) {
            // Create a download link
            const link = document.createElement('a');
            link.download = name;
            link.href = dataUrl;
            link.click();
            $("th").css("background-color", "#1a1a1a").css("color", "#e0e0e0");
        })
        .catch(function (error) {
            console.error('Error capturing element:', error);
            $("th").css("background-color", "#1a1a1a").css("color", "#e0e0e0");
        });

}

function screenshotBoardNoCoords() {
    $("th").css("background-color", "transparent").css("color", "transparent");
    screenshotBoard();
}

// function importFromBGA(bgaReplay) {
//     boardHistory = [""];
//     gMessage = [""];
//     historyIndex = 0;

//     const lines = bgaReplay.split('\n');
//     let historyString = '';
//     let playerColors = {};
//     let workerCount = {
//         blue: { femalePlaced: false, count: 0 },
//         white: { femalePlaced: false, count: 0 }
//     };
//     let actionCount = 0;

//     // Enhanced regex patterns
//     const CONTROL_REGEX = /(.+)\scontrols\s(the\s)?(blue|white)\sworkers?/i;
//     const MOVE_HEADER_REGEX = /^Move\s+\d+.*:/i;
//     const ACTION_REGEX = /^(.*?)\s+(places|moves|builds|uses|removes|dome)/i;
//     const CELL_REGEX = /([A-Ea-e]\s*[1-5])/gi;
//     const LEVEL_REGEX = /level\s+(\d+)/i;
//     const DOME_REGEX = /dome/i;

//     let currentPlayer = null;
//     let inMoveBlock = false;

//     lines.forEach(line => {
//         line = line.trim();
//         if (!line) return;

//         // 1. Detect player colors
//         const controlMatch = line.match(CONTROL_REGEX);
//         if (controlMatch) {
//             const [, player, , color] = controlMatch;
//             playerColors[color.toLowerCase()] = player.trim();
//             console.log(`Player association: ${player} -> ${color}`);
//             return;
//         }

//         // 2. Detect move blocks
//         if (MOVE_HEADER_REGEX.test(line)) {
//             inMoveBlock = true;
//             currentPlayer = null;
//             console.log(`\nProcessing move block: ${line}`);
//             return;
//         }

//         if (!inMoveBlock) return;

//         // 3. Parse actions within move blocks
//         const actionMatch = line.match(ACTION_REGEX);
//         if (!actionMatch) return;

//         const [, playerRaw, actionType] = actionMatch;
//         const player = playerRaw.replace(/[^a-zA-Z\s]/g, '').trim(); // Clean player name
//         currentPlayer = currentPlayer || player;

//         console.log(`Processing action: ${actionType} by ${player}`);

//         try {
//             const color = getPlayerColor(currentPlayer, playerColors);
//             let action = null;

//             switch (actionType.toLowerCase()) {
//                 case 'places':
//                     const cells = line.match(CELL_REGEX);
//                     if (cells?.[0]) {
//                         const cell = cells[0].replace(/\s/g, '').toUpperCase();
//                         const workerType = getWorkerType(color, workerCount);
//                         action = `${cell}-${workerType}`;
//                     }
//                     break;

//                 case 'moves':
//                     const moveCells = line.match(CELL_REGEX);
//                     if (moveCells?.length === 2) {
//                         const from = moveCells[0].replace(/\s/g, '').toUpperCase();
//                         const to = moveCells[1].replace(/\s/g, '').toUpperCase();
//                         action = `${from}-${to}`;
//                     }
//                     break;

//                 case 'builds':
//                 case 'dome':
//                     const buildCell = line.match(CELL_REGEX)?.[0]?.replace(/\s/g, '').toUpperCase();
//                     if (buildCell) {
//                         const isDome = DOME_REGEX.test(line);
//                         const level = line.match(LEVEL_REGEX)?.[1] || '1';
//                         action = isDome ?
//                             `${buildCell}(X)` :
//                             `${buildCell}(${Math.min(3, level)})`; // Cap at level 3
//                     }
//                     break;
//             }

//             if (action) {
//                 historyString += `${++actionCount}. ${action} `;
//                 console.log(`Added action: ${actionCount}. ${action}`);
//             }
//         } catch (e) {
//             console.error(`Error processing line: ${line}`, e);
//         }
//     });

//     console.log('Final history string:', historyString);
//     importHistory(historyString.trim());

//     // Helper functions
//     function getPlayerColor(player, colors) {
//         return Object.entries(colors).find(([_, name]) =>
//             name.toLowerCase() === player.toLowerCase()
//         )?.[0] || 'blue';
//     }

//     function getWorkerType(color, counts) {
//         const team = counts[color] || counts.blue;
//         if (!team.femalePlaced) {
//             team.femalePlaced = true;
//             return color === 'blue' ? 'Bf' : 'Wf';
//         }
//         return color === 'blue' ? 'Bm' : 'Wm';
//     }
// }



function showHelp() {
    $("#helpDiv").toggle()
};

/*
improve reset
better buttonnames 
help text
css
*/ 