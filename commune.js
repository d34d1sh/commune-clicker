// commune.js

import sabotagePhrases from './sabotagePhrases.js';

const BASE_FONT_SIZE = 16;
const BUTTON_FONT_SIZE = 18;
const MIN_FONT_SIZE = 12;

// Phaser Scale Manager automatically adjusts FONT_SCALE based on canvas size
let FONT_SCALE = 1.0;

// Function to check if the screen is small and in portrait mode
function isSmallScreenPortrait() {
    return window.innerWidth < 600 && window.innerHeight > window.innerWidth;
}

if (isSmallScreenPortrait()) {
    // **1. Create Overlay for Small Portrait Screens**

    // Create overlay div
    const overlay = document.createElement('div');
    overlay.id = 'orientation-overlay';
    Object.assign(overlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: '1000',
        textAlign: 'center',
        padding: '20px',
        boxSizing: 'border-box'
    });

    // Create message paragraph
    const message = document.createElement('p');
    message.textContent = 'Please rotate your device to horizontal mode for the best experience.';
    message.style.font = '24px "Pixel", sans-serif';
    message.style.marginBottom = '20px';
    overlay.appendChild(message);

    // Create reload button
    const reloadButton = document.createElement('button');
    reloadButton.textContent = 'Reload';
    Object.assign(reloadButton.style, {
        padding: '10px 20px',
        fontSize: '18px',
        fontFamily: 'Pixel',
        cursor: 'pointer',
        border: 'none',
        borderRadius: '5px',
        backgroundColor: '#ff5722',
        color: '#ffffff'
    });

    // Add click event to reload the page
    reloadButton.addEventListener('click', () => {
        window.location.reload();
    });
    overlay.appendChild(reloadButton);

    // Append overlay to the body
    document.body.appendChild(overlay);

    // **End of Overlay Creation**

} else {
    // **2. Initialize Phaser Game for Suitable Screens**

    const config = {
        type: Phaser.AUTO,
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: 0x000000,
        scene: {
            create: create,
            update: update
        },
        scale: {
            mode: Phaser.Scale.RESIZE,
            autoCenter: Phaser.Scale.CENTER_BOTH
        }
    };

    // Initialize Phaser game
    const game = new Phaser.Game(config);

    // **Global Variables**
    let asciiTitle, difficultyPrompt;
    let anarchyButton, insurrectionButton, revolutionButton;
    let difficulty = 'INSURRECTION'; // default difficulty
    let capitalismElements = {};
    let antagonism = 0;
    let sabotageCount = 0;
    let countdownActive = false;
    let logMessages = [];
    let logText;
    let phraseText;
    let countdownText;
    let antagonismText;
    let sabotageText;
    let healthBars = {};
    let comboCount = 0;
    let comboMultiplier = 1.0;
    let comboTimeout;
    let autoplayEnabled = false;
    let autoplayCooldown = 1000; // 1 sec
    let lastAutoplayTime = 0;
    const maxLogMessages = 12;

    const difficultySettings = {
        ANARCHY: {
            startingValues: [70, 100],
            sabotageCost: 3,
            antagonismBoost: 12,
            autoplayCooldown: 700
        },
        INSURRECTION: {
            startingValues: [50, 100],
            sabotageCost: 5,
            antagonismBoost: 7,
            autoplayCooldown: 1000
        },
        REVOLUTION: {
            startingValues: [30, 80],
            sabotageCost: 7,
            antagonismBoost: 5,
            autoplayCooldown: 1300
        }
    };

    // Phaser Containers for UI Elements
    let uiContainer;
    let buttonsContainer; // Container for buttons

    // Combo Display Element
    let comboText;

    // Commit Sabotage Button
    let commitSabotageButton;

    // **Functions**

    // Function to update font scale based on canvas size
    function updateFontScale(width, height) {
        const baseWidth = 800;
        const baseHeight = 600;
        FONT_SCALE = Math.min(width / baseWidth, height / baseHeight, 2.0);
    }

    // Function to update the "Commit Sabotage" button's state
    function updateCommitSabotageButton() {
        if (commitSabotageButton) {
            const sabotageCost = difficultySettings[difficulty].sabotageCost || 5;
            if (antagonism >= sabotageCost) {
                commitSabotageButton.setStyle({ fill: '#00ff00' }); // Enabled color
                commitSabotageButton.setInteractive({ useHandCursor: true });
            } else {
                commitSabotageButton.setStyle({ fill: '#555555' }); // Disabled color
                commitSabotageButton.disableInteractive();
            }
        }
    }

    function create() {
        // Initialize FONT_SCALE based on initial canvas size
        updateFontScale(this.sys.game.canvas.width, this.sys.game.canvas.height);

        // Create UI Container
        uiContainer = this.add.container(0, 0);

        // Build the ASCII title and difficulty selection UI first.
        createAsciiTitle.call(this);
        createDifficultyUI.call(this);
    }

    function update(time) {
        updateHealthBars.call(this);
        checkForCollapse.call(this);

        // Update Combo Display
        if (comboText) {
            comboText.setText(`COMBO: x${comboCount}`);
        }

        // Autoplay sabotage
        if (autoplayEnabled && time > lastAutoplayTime + autoplayCooldown) {
            if (countdownText && countdownText.visible) {
                // Do not perform sabotage during countdown
                return;
            }
            performSabotage(this);
            lastAutoplayTime = time;
        }
    }

    function generateAntagonism() {
        antagonism += Phaser.Math.Between(3, 7);
        antagonismText.setText(`ANTAGONISM: ${antagonism}`);

        // Update Commit Sabotage Button state based on new antagonism
        updateCommitSabotageButton();
    }

    function insurrectionEvent() {
        antagonism += 10;
        antagonismText.setText(`ANTAGONISM: ${antagonism}`);
        addLogMessage('*** INSURRECTION: Antagonism +10.');

        // Update Commit Sabotage Button state based on new antagonism
        updateCommitSabotageButton();
    }

    function capitalismCounterEvent() {
        const elements = Object.keys(capitalismElements);
        const target = Phaser.Utils.Array.GetRandom(elements);
        const reinforcement = Phaser.Math.Between(10, 20);
        capitalismElements[target] += reinforcement;
        addLogMessage(`<<< COUNTER-MEASURE: ${target} reinforced by ${reinforcement}.`);
    }

    function performSabotage(scene) {
        const sabotageCost = difficultySettings[difficulty].sabotageCost || 5;
        if (antagonism < sabotageCost) {
            addLogMessage('ERROR: Insufficient Antagonism. Sabotage aborted.');
            return;
        }

        antagonism -= sabotageCost;
        sabotageCount += 1;
        antagonismText.setText(`ANTAGONISM: ${antagonism}`);
        sabotageText.setText(`SABOTAGES: ${sabotageCount}`);

        const elements = Object.keys(capitalismElements);
        const target = Phaser.Utils.Array.GetRandom(elements);

        // Combo logic
        comboCount++;
        comboMultiplier = 1 + (comboCount * 0.2);
        const sabotageDamage = Phaser.Math.Between(15, 30) * comboMultiplier;
        capitalismElements[target] -= Math.floor(sabotageDamage);

        addLogMessage(`Combo x${comboCount}: Sabotage on ${target}, damage: ${Math.floor(sabotageDamage)}`);

        // Update Combo Display
        if (comboText) {
            comboText.setText(`COMBO: x${comboCount}`);
        }

        // Screen shake
        scene.cameras.main.shake(200, 0.01);

        // Flavor text from sabotagePhrases
        if (sabotagePhrases[target]) {
            const flavorText = Phaser.Utils.Array.GetRandom(sabotagePhrases[target]);
            phraseText.setText(flavorText);
        } else {
            phraseText.setText('Sabotage executed!');
        }

        // Reset combo after 5 seconds using Phaser Timer
        if (comboTimeout) {
            comboTimeout.remove(false);
        }

        // **Only set the comboTimeout if not in countdown**
        if (!countdownActive) {
            comboTimeout = scene.time.delayedCall(5000, () => {
                comboCount = 0;
                comboMultiplier = 1.0;
                addLogMessage('Combo ended.');

                // Update Combo Display
                if (comboText) {
                    comboText.setText(`COMBO: x${comboCount}`);
                }
            }, [], scene);
        }

        // Update Commit Sabotage Button state based on new antagonism
        updateCommitSabotageButton();
    }

    function toggleAutoplay() {
        autoplayEnabled = !autoplayEnabled;
        addLogMessage(`Autoplay ${autoplayEnabled ? 'enabled' : 'disabled'}.`);
    }

    function updateHealthBars() {
        for (let element in capitalismElements) {
            if (!healthBars[element]) continue;

            const value = capitalismElements[element];
            healthBars[element].setText(`${element}`);
            healthBars[element].setFill(getColorForValue(value));

            // Handle strikethrough if value <= 0
            if (value <= 0) {
                addStrikeoutLine(healthBars[element]);
            } else {
                removeStrikeoutLine(healthBars[element]);
            }
        }
    }

    function getColorForValue(value) {
        if (value >= 100) {
            return '#00ff00';
        } else if (value >= 75) {
            return '#99cc00';
        } else if (value >= 50) {
            return '#ffcc00';
        } else if (value >= 25) {
            return '#ff8800';
        } else if (value >= 0) {
            return '#ff4400';
        } else {
            return '#ff0000';
        }
    }

    function addStrikeoutLine(textElement) {
        if (!textElement.strikeoutLine) {
            let textBounds = textElement.getBounds();
            textElement.strikeoutLine = textElement.scene.add.graphics();
            textElement.strikeoutLine.lineStyle(2, 0xff0000);
            textElement.strikeoutLine.moveTo(textBounds.x, textBounds.y + textBounds.height / 2);
            textElement.strikeoutLine.lineTo(textBounds.x + textBounds.width, textBounds.y + textBounds.height / 2);
            textElement.strikeoutLine.strokePath();
            uiContainer.add(textElement.strikeoutLine);
        }
    }

    function removeStrikeoutLine(textElement) {
        if (textElement.strikeoutLine) {
            textElement.strikeoutLine.destroy();
            textElement.strikeoutLine = null;
        }
    }

    function checkForCollapse() {
        // Ensure capitalismElements is initialized and not empty
        if (Object.keys(capitalismElements).length === 0) return;

        if (Object.values(capitalismElements).every(value => value <= 0)) {
            addLogMessage('*** CAPITALISM HAS COLLAPSED. ALL POWER TO THE COMMUNES! ***');
            startCountdown.call(this);
        }
    }

    function startCountdown() {
        if (countdownActive) return;
        
        // Clear any existing comboTimeout to prevent combo reset during countdown
        if (comboTimeout) {
            comboTimeout.remove(false);
            comboTimeout = null;
        }
        
        countdownActive = true;
        countdownText.setVisible(true);

        let countdown = 5;
        countdownText.setText(countdown.toString());

        // Create a timed event that ticks every second
        const countdownEvent = this.time.addEvent({
            delay: 1000, // 1 second
            repeat: countdown - 1, // Number of repeats (countdown starts at 5)
            callback: () => {
                countdown--;
                countdownText.setText(countdown.toString());

                if (countdown <= 0) {
                    countdownEvent.remove(false); // Remove the event without destroying the timer
                    resetGameState.call(this);
                }
            },
            callbackScope: this
        });
    }

    function resetGameState() {
        // Clear any existing comboTimeout to prevent unexpected resets
        if (comboTimeout) {
            comboTimeout.remove(false);
            comboTimeout = null;
        }

        countdownText.setText('');
        countdownText.setVisible(false);
        logMessages = [];
        antagonism = 0;
        sabotageCount = 0;

        // Re-randomize capitalism elements within current difficulty’s starting range
        const settings = difficultySettings[difficulty];
        for (let elem in capitalismElements) {
            capitalismElements[elem] = Phaser.Math.Between(...settings.startingValues);
        }

        antagonismText.setText(`ANTAGONISM: ${antagonism}`);
        sabotageText.setText(`SABOTAGES: ${sabotageCount}`);
        phraseText.setText('');
        countdownActive = false;

        addLogMessage("Game state reset. The struggle continues...");

        // **Do NOT reset comboCount and comboMultiplier here**
        // They continue to persist across game resets

        // Update Combo Display
        if (comboText) {
            comboText.setText(`COMBO: x${comboCount}`);
        }

        // Update Commit Sabotage Button state based on new antagonism
        updateCommitSabotageButton();
    }

    function addLogMessage(message) {
        logMessages.push(message);
        if (logMessages.length > maxLogMessages) {
            logMessages.shift();
        }
        if (logText) {
            logText.setText(logMessages.join('\n'));
        }
    }

    // Listen for window resize, then reposition UI instead of re-creating it
    window.addEventListener('resize', () => {
        game.scale.resize(window.innerWidth, window.innerHeight);
        repositionUI(game.scene.scenes[0]);
    });

    function repositionUI(scene) {        
        // Adjust FONT_SCALE based on new canvas size
        updateFontScale(scene.sys.game.canvas.width, scene.sys.game.canvas.height);

        // Adjust font sizes dynamically
        const newFontSize = Math.max(BASE_FONT_SIZE * FONT_SCALE, MIN_FONT_SIZE);
        const newButtonFontSize = Math.max(BUTTON_FONT_SIZE * FONT_SCALE, MIN_FONT_SIZE);

        const padding = 0.025; // 2.5% padding
        const maxWidth = scene.sys.game.canvas.width * 0.95; // 95% of canvas width

        // ASCII Title
        if (asciiTitle) {
            asciiTitle.setFont(`${newFontSize}px Menlo`);
            asciiTitle.setPosition(scene.sys.game.canvas.width * padding, scene.sys.game.canvas.height * 0.01);
        }

        // Reposition Difficulty UI Buttons
        if (difficultyPrompt) {
            difficultyPrompt.setFont(`${newFontSize}px Courier`);
            difficultyPrompt.setPosition(scene.sys.game.canvas.width * padding, asciiTitle.getBounds().bottom + scene.sys.game.canvas.height * 0.02);
        }

        // Reposition Buttons Container
        if (buttonsContainer) {
            // Recalculate buttons' positions based on new canvas size
            buttonsContainer.list.forEach((button, index) => {
                button.setFont(`${newButtonFontSize}px Courier`);
                button.setPosition(0, index * (button.height + scene.sys.game.canvas.height * 0.02)); 
                button.setWordWrap({ width: maxWidth - scene.sys.game.canvas.width * 0.05 });
            });
        }

        // Reposition other UI elements
        if (antagonismText) {
            antagonismText.setFont(`${newFontSize}px Courier`);
            antagonismText.setPosition(scene.sys.game.canvas.width * padding, asciiTitle.getBounds().bottom + scene.sys.game.canvas.height * 0.02 + 20);
        }

        if (sabotageText) {
            sabotageText.setFont(`${newFontSize}px Courier`);
            sabotageText.setPosition(scene.sys.game.canvas.width * padding, antagonismText.getBounds().bottom + scene.sys.game.canvas.height * 0.01);
        }

        // Reposition Health Bars
        if (healthBars) {
            let yOffset = sabotageText.getBounds().bottom + scene.sys.game.canvas.height * 0.02;
            const healthBarSpacing = scene.sys.game.canvas.height * 0.015;
            for (let elem in healthBars) {
                healthBars[elem].setFont(`${newFontSize}px Courier`);
                healthBars[elem].setPosition(scene.sys.game.canvas.width * padding, yOffset);
                healthBars[elem].setWordWrap({ width: maxWidth });
                yOffset += healthBars[elem].height + healthBarSpacing;
            }
        }

        // Reposition Combo Text
        if (comboText) {
            comboText.setFont(`${newFontSize}px Courier`);
            comboText.setPosition(scene.sys.game.canvas.width * padding, sabotageText.getBounds().bottom + scene.sys.game.canvas.height * 0.02);
        }

        // Reposition Log Text
        if (logText) {
            const padding = scene.sys.game.canvas.width * 0.025;
            const logX = scene.sys.game.canvas.width - padding;
            const logY = scene.sys.game.canvas.height * 0.6;

            logText.setFont(`${newFontSize}px Courier`);
            logText.setWordWrapWidth(scene.sys.game.canvas.width * 0.4);
            logText.setPosition(logX, logY);
            logText.setOrigin(1, 0); // Right alignment
        }

        // Reposition Countdown Text
        if (countdownText) {
            countdownText.setFont(`${Math.max(48 * FONT_SCALE, 24)}px Courier`);
            countdownText.setPosition(scene.sys.game.canvas.width / 2, logText.getBounds().top - 100);
        }

        // Reposition Phrase Text
        if (phraseText) {
            phraseText.setFont(`${Math.max(14 * FONT_SCALE, 12)}px Courier`);
            const asciiBounds = asciiTitle.getBounds();
            const asciiRight = asciiBounds.right;
            phraseText.setPosition(asciiRight - scene.sys.game.canvas.width * 0.02, asciiBounds.bottom + scene.sys.game.canvas.height * 0.01);
            phraseText.setWordWrap({ width: Math.min(600, maxWidth - scene.sys.game.canvas.width * 0.05) });
        }
    }

    function createAsciiTitle() {
        const padding = 0.025; // 2.5% padding
        const fontSize = Math.max(BASE_FONT_SIZE * FONT_SCALE, MIN_FONT_SIZE);
        asciiTitle = this.add.text(
            0,
            0,
            `
        ▄█▄    ████▄ █▀▄▀█ █▀▄▀█   ▄      ▄   ▄███▄       ▄█▄    █     ▄█ ▄█▄    █  █▀ ▄███▄   █▄▄▄▄ 
        █▀ ▀▄  █   █ █ █ █ █ █ █    █      █  █▀   ▀      █▀ ▀▄  █     ██ █▀ ▀▄  █▄█   █▀   ▀  █  ▄▀ 
        █   ▀  █   █ █ ▄ █ █ ▄ █ █   █ ██   █ ██▄▄        █   ▀  █     ██ █   ▀  █▀▄   ██▄▄    █▀▀▌  
        █▄  ▄▀ ▀████ █   █ █   █ █   █ █ █  █ █▄   ▄▀     █▄  ▄▀ ███▄  ▐█ █▄  ▄▀ █  █  █▄   ▄▀ █  █  
        ▀███▀           █     █  █▄ ▄█ █  █ █ ▀███▀       ▀███▀      ▀  ▐ ▀███▀    █   ▀███▀     █   
                           ▀     ▀    ▀▀▀  █   ██                                     ▀             ▀    
            `,
            {
                font: `${fontSize}px Menlo`,
                fill: '#ff0000',
                align: 'left'
            }
        );
        asciiTitle.setScale(1, 1);
        uiContainer.add(asciiTitle);
    }

    function createDifficultyUI() {
        const padding = 0.025; // 2.5% padding
        const fontSize = Math.max(BASE_FONT_SIZE * FONT_SCALE, MIN_FONT_SIZE);

        // Position difficulty prompt below ASCII title
        const titleBounds = asciiTitle.getBounds();
        const promptY = titleBounds.bottom + this.sys.game.canvas.height * 0.02;

        difficultyPrompt = this.add.text(
            this.sys.game.canvas.width * padding,
            promptY,
            'Set your difficulty:',
            { font: `${fontSize}px Courier`, fill: '#ffffff' }
        );
        uiContainer.add(difficultyPrompt);

        // Button vertical spacing factor
        const buttonSpacing = 0.035;

        // Anarchy Button
        anarchyButton = this.add.text(
            this.sys.game.canvas.width * padding,
            promptY + this.sys.game.canvas.height * buttonSpacing,
            '[ANARCHY]',
            { font: `${fontSize}px Courier`, fill: '#00ff00' }
        ).setInteractive({ useHandCursor: true });
        uiContainer.add(anarchyButton);

        // Insurrection Button
        insurrectionButton = this.add.text(
            this.sys.game.canvas.width * padding,
            promptY + this.sys.game.canvas.height * buttonSpacing * 2,
            '[INSURRECTION]',
            { font: `${fontSize}px Courier`, fill: '#ffff00' }
        ).setInteractive({ useHandCursor: true });
        uiContainer.add(insurrectionButton);

        // Revolution Button
        revolutionButton = this.add.text(
            this.sys.game.canvas.width * padding,
            promptY + this.sys.game.canvas.height * buttonSpacing * 3,
            '[REVOLUTION]',
            { font: `${fontSize}px Courier`, fill: '#ff0000' }
        ).setInteractive({ useHandCursor: true });
        uiContainer.add(revolutionButton);

        // Button Click Events
        anarchyButton.on('pointerdown', () => setDifficulty('ANARCHY', this));
        insurrectionButton.on('pointerdown', () => setDifficulty('INSURRECTION', this));
        revolutionButton.on('pointerdown', () => setDifficulty('REVOLUTION', this));
    }

    function setDifficulty(selectedDifficulty, scene) {
        difficulty = selectedDifficulty;

        // Reset capitalism elements with difficulty starting values
        const settings = difficultySettings[difficulty];
        capitalismElements = {
            "MODE OF PRODUCTION": Phaser.Math.Between(...settings.startingValues),
            "STATE FORM": Phaser.Math.Between(...settings.startingValues),
            "IDEOLOGICAL APPARATUS": Phaser.Math.Between(...settings.startingValues),
            "SOCIAL ORDER": Phaser.Math.Between(...settings.startingValues),
            "METABOLIC RIFT": Phaser.Math.Between(...settings.startingValues),
            "LOGISTICAL NETWORKS": Phaser.Math.Between(...settings.startingValues),
        };

        antagonism = 0;
        sabotageCount = 0;
        autoplayCooldown = settings.autoplayCooldown;

        // Destroy difficulty UI
        anarchyButton.destroy();
        insurrectionButton.destroy();
        revolutionButton.destroy();
        difficultyPrompt.destroy();

        // Create main game UI
        createGameUI(scene);
        setupGameTimers(scene);
    }

    function createGameUI(scene) {
        const padding = 0.025;
        const fontSize = Math.max(BASE_FONT_SIZE * FONT_SCALE, MIN_FONT_SIZE);
        const buttonFontSize = Math.max(BUTTON_FONT_SIZE * FONT_SCALE, MIN_FONT_SIZE);
        const maxWidth = scene.sys.game.canvas.width * 0.95;

        // Start Y offset below the ASCII title and difficulty UI
        const titleBounds = asciiTitle.getBounds();
        let yOffset = titleBounds.bottom + scene.sys.game.canvas.height * 0.02;

        // Antagonism Text
        antagonismText = scene.add.text(
            scene.sys.game.canvas.width * padding,
            yOffset,
            `ANTAGONISM: ${antagonism}`,
            {
                font: `${fontSize}px Courier`,
                fill: '#ff0000'
            }
        );
        uiContainer.add(antagonismText);
        yOffset += antagonismText.height + scene.sys.game.canvas.height * 0.005;

        // Sabotage Text
        sabotageText = scene.add.text(
            scene.sys.game.canvas.width * padding,
            yOffset,
            `SABOTAGES: ${sabotageCount}`,
            {
                font: `${fontSize}px Courier`,
                fill: '#ff0000'
            }
        );
        uiContainer.add(sabotageText);
        yOffset += sabotageText.height + scene.sys.game.canvas.height * 0.02;

        // Capitalism Element Health Bars
        healthBars = {};
        const healthBarSpacing = scene.sys.game.canvas.height * 0.005;
        for (let elem in capitalismElements) {
            healthBars[elem] = scene.add.text(
                scene.sys.game.canvas.width * padding,
                yOffset,
                `${elem}: ${capitalismElements[elem]}`,
                {
                    font: `${fontSize}px Courier`,
                    fill: '#ffffff',
                    wordWrap: { width: maxWidth }
                }
            );
            uiContainer.add(healthBars[elem]);
            yOffset += healthBars[elem].height + healthBarSpacing;
        }

        // Combo Text
        comboText = scene.add.text(
            scene.sys.game.canvas.width * padding,
            yOffset,
            `COMBO: x${comboCount}`,
            {
                font: `${fontSize}px Courier`,
                fill: '#00ffff'
            }
        );
        uiContainer.add(comboText);
        yOffset += comboText.height + scene.sys.game.canvas.height * 0.01;

        // Log Text - Positioned at Bottom Right
        logText = scene.add.text(
            scene.sys.game.canvas.width * (1 - padding),
            scene.sys.game.canvas.height * 7 / 12,
            '',
            {
                font: `${fontSize}px Courier`,
                fill: '#cccccc',
                wordWrap: { width: maxWidth },
                align: 'right'
            }
        ).setOrigin(1, 0);
        uiContainer.add(logText);

        // Buttons Container
        buttonsContainer = scene.add.container(
            scene.sys.game.canvas.width * padding,
            yOffset
        );
        uiContainer.add(buttonsContainer);

        const buttonSpacingFactor = 0.00;
        const spacing = scene.sys.game.canvas.height * buttonSpacingFactor;

        // Commit Sabotage Button
        commitSabotageButton = scene.add.text(
            0,
            0,
            '[COMMIT SABOTAGE]',
            {
                font: `${buttonFontSize}px Courier`,
                fill: '#00ff00',
                backgroundColor: '#333333',
                padding: { x: 10, y: 5 },
                wordWrap: { width: maxWidth - scene.sys.game.canvas.width * 0.05 }
            }
        ).setInteractive({ useHandCursor: true });
        commitSabotageButton.on('pointerdown', () => {
            performSabotage(scene);
        });
        buttonsContainer.add(commitSabotageButton);

        // Upgrade Button
        const upgradeButton = scene.add.text(
            0,
            commitSabotageButton.height + spacing,
            '[BUY UPGRADE: WILDCAT STRIKES]',
            {
                font: `${buttonFontSize}px Courier`,
                fill: '#ff0000',
                backgroundColor: '#333333',
                padding: { x: 10, y: 5 },
                wordWrap: { width: maxWidth - scene.sys.game.canvas.width * 0.05 }
            }
        ).setInteractive({ useHandCursor: true });
        upgradeButton.on('pointerdown', () => {
            if (antagonism >= 50) {
                antagonism -= 50;
                autoplayCooldown = 500;
                addLogMessage('Upgrade Purchased: Wildcat Strikes! Autoplay cooldown reduced.');
                antagonismText.setText(`ANTAGONISM: ${antagonism}`);
                upgradeButton.destroy();
                updateCommitSabotageButton();
            } else {
                addLogMessage('ERROR: Not enough Antagonism to purchase upgrade.');
            }
        });
        buttonsContainer.add(upgradeButton);

        // Autoplay Button
        const autoplayButton = scene.add.text(
            0,
            commitSabotageButton.height + spacing + upgradeButton.height + spacing,
            '[TOGGLE AUTOPLAY]',
            {
                font: `${buttonFontSize}px Courier`,
                fill: '#ff0000',
                backgroundColor: '#333333',
                padding: { x: 10, y: 5 },
                wordWrap: { width: maxWidth - scene.sys.game.canvas.width * 0.05 }
            }
        ).setInteractive({ useHandCursor: true });
        autoplayButton.on('pointerdown', toggleAutoplay.bind(scene));
        buttonsContainer.add(autoplayButton);

        // Update Commit Sabotage Button state
        updateCommitSabotageButton();

        // Phrase Text - Right-aligned to the ASCII Title
        phraseText = scene.add.text(
            asciiTitle.getBounds().right - scene.sys.game.canvas.width * 0.02,
            asciiTitle.getBounds().bottom + scene.sys.game.canvas.height * 0.01,
            '',
            {
                font: `${Math.max(14 * FONT_SCALE, 12)}px Courier`,
                fill: '#ffcc00',
                wordWrap: { width: Math.min(600, maxWidth - scene.sys.game.canvas.width * 0.05) }
            }
        ).setOrigin(1, 0);
        uiContainer.add(phraseText);

        // Countdown Text - Centered above log
        countdownText = scene.add.text(
            scene.sys.game.canvas.width / 2,
            logText.getBounds().top - 100,
            '',
            {
                font: `${Math.max(48 * FONT_SCALE, 24)}px Courier`,
                fill: '#ff0000',
                align: 'center'
            }
        ).setOrigin(0.5, 0);
        countdownText.setVisible(false);
        uiContainer.add(countdownText);
    }

    function setupGameTimers(scene) {
        // Generate antagonism event every 800ms
        scene.time.addEvent({ delay: 800, callback: generateAntagonism, callbackScope: scene, loop: true });

        // Insurrection event at random intervals between 3-5 seconds
        scene.time.addEvent({
            delay: Phaser.Math.Between(3000, 5000),
            callback: insurrectionEvent,
            callbackScope: scene,
            loop: true
        });

        // Counter-measure event at random intervals between 2-4 seconds
        scene.time.addEvent({
            delay: Phaser.Math.Between(2000, 4000),
            callback: capitalismCounterEvent,
            callbackScope: scene,
            loop: true
        });
    }
}
