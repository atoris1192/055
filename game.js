document.addEventListener('DOMContentLoaded', () => {
    const startScreen = document.getElementById('start-screen');
    const startButton = document.getElementById('start-button');
    const gameContainer = document.getElementById('game-container');
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');

    const timerDisplay = document.getElementById('timer');
    const hpBar = document.getElementById('hp-bar');
    const levelUpModal = document.getElementById('level-up-modal');
    const upgradeOptionsContainer = document.getElementById('upgrade-options');
    const gameOverModal = document.getElementById('game-over-modal');
    const finalTimeDisplay = document.getElementById('final-time');
    const retryButton = document.getElementById('retry-button');

    let gameLoopId;
    let gameState = 'start'; // 'start', 'playing', 'paused', 'gameOver'

    // Game Variables
    let player, enemies, expGems, projectiles;
    let camera;
    let gameTime, level, exp, score;
    let touch = { x: null, y: null, active: false };

    const gameArea = { width: 2000, height: 2000 };
    const gameDuration = 1 * 60 * 1000; // 1 minute

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function initGame() {
        resizeCanvas();

        player = {
            x: gameArea.width / 2,
            y: gameArea.height / 2,
            radius: 15,
            speed: 3,
            hp: 100,
            maxHp: 100,
            color: 'blue',
            weapons: {
                orbitingOrb: { level: 1, count: 2, radius: 50, angle: 0, speed: 0.05, damage: 10 },
                homingMissile: { level: 1, cooldown: 2000, lastFired: 0, damage: 20 }
            }
        };

        enemies = [];
        expGems = [];
        projectiles = [];
        gameTime = 0;
        level = 1;
        exp = 0;
        score = 0;

        camera = {
            x: player.x - canvas.width / 2,
            y: player.y - canvas.height / 2
        };

        gameState = 'playing';
        levelUpModal.style.display = 'none';
        gameOverModal.style.display = 'none';
        gameContainer.style.display = 'block';
        startScreen.style.display = 'none';

        gameLoopId = requestAnimationFrame(gameLoop);
    }

    function gameLoop(timestamp) {
        if (gameState !== 'playing') {
            cancelAnimationFrame(gameLoopId);
            return;
        }

        const deltaTime = timestamp - (lastTimestamp || timestamp);
        lastTimestamp = timestamp;
        gameTime += deltaTime;

        update(deltaTime);
        draw();

        if (gameTime >= gameDuration) {
            winGame();
        } else {
            gameLoopId = requestAnimationFrame(gameLoop);
        }
    }
    let lastTimestamp = 0;


    function update(deltaTime) {
        // Player movement
        if (touch.active) {
            const dx = touch.x - canvas.width / 2;
            const dy = touch.y - canvas.height / 2;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) {
                player.x += (dx / dist) * player.speed;
                player.y += (dy / dist) * player.speed;
            }
        }
        player.x = Math.max(player.radius, Math.min(gameArea.width - player.radius, player.x));
        player.y = Math.max(player.radius, Math.min(gameArea.height - player.radius, player.y));

        // Camera follow
        camera.x = player.x - canvas.width / 2;
        camera.y = player.y - canvas.height / 2;

        // Enemy spawning
        if (Math.random() < 0.02) {
            spawnEnemy();
        }

        // Update enemies
        enemies.forEach((enemy, index) => {
            const dx = player.x - enemy.x;
            const dy = player.y - enemy.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            enemy.x += (dx / dist) * enemy.speed;
            enemy.y += (dy / dist) * enemy.speed;

            // Player collision
            if (dist < player.radius + enemy.radius) {
                player.hp -= 10;
                enemies.splice(index, 1);
                if (player.hp <= 0) {
                    gameOver();
                }
            }
        });

        // Update weapons
        updateWeapons(deltaTime);
        
        // Update projectiles
        projectiles.forEach((p, pIndex) => {
            p.update();
            if (p.isOffscreen()) {
                projectiles.splice(pIndex, 1);
            } else {
                 enemies.forEach((enemy, eIndex) => {
                    if (p.checkCollision(enemy)) {
                        enemy.hp -= p.damage;
                        if(enemy.hp <= 0) {
                            spawnExpGem(enemy.x, enemy.y);
                            enemies.splice(eIndex, 1);
                            score += 100; // Add score
                        }
                        projectiles.splice(pIndex, 1);
                    }
                });
            }
        });


        // Update EXP gems
        expGems.forEach((gem, index) => {
            const dx = player.x - gem.x;
            const dy = player.y - gem.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 100) { // Pickup range
                exp += gem.value;
                expGems.splice(index, 1);
                checkLevelUp();
            }
        });
    }
    
    function updateWeapons(deltaTime) {
        // Orbiting Orb
        const orb = player.weapons.orbitingOrb;
        orb.angle += orb.speed;
        for (let i = 0; i < orb.count; i++) {
            const angle = orb.angle + (i * (2 * Math.PI / orb.count));
            const orbX = player.x + Math.cos(angle) * orb.radius;
            const orbY = player.y + Math.sin(angle) * orb.radius;
            
            enemies.forEach((enemy, eIndex) => {
                const dx = orbX - enemy.x;
                const dy = orbY - enemy.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 10 + enemy.radius) { // Orb radius is 10
                    enemy.hp -= orb.damage;
                     if(enemy.hp <= 0) {
                        spawnExpGem(enemy.x, enemy.y);
                        enemies.splice(eIndex, 1);
                        score += 100; // Add score
                    }
                }
            });
        }

        // Homing Missile
        const missile = player.weapons.homingMissile;
        missile.lastFired += deltaTime;
        if (missile.lastFired > missile.cooldown) {
            missile.lastFired = 0;
            fireHomingMissile();
        }
    }

    function fireHomingMissile() {
        let closestEnemy = null;
        let minDistance = Infinity;
        enemies.forEach(enemy => {
            const dx = player.x - enemy.x;
            const dy = player.y - enemy.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDistance) {
                minDistance = dist;
                closestEnemy = enemy;
            }
        });

        if (closestEnemy) {
            projectiles.push(new HomingMissile(player.x, player.y, closestEnemy, player.weapons.homingMissile.damage));
        }
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(-camera.x, -camera.y);

        // Draw game area border for debugging
        ctx.strokeStyle = 'gray';
        ctx.strokeRect(0, 0, gameArea.width, gameArea.height);

        // Draw player
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw weapons
        drawWeapons();

        // Draw enemies
        enemies.forEach(enemy => {
            ctx.fillStyle = enemy.color;
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
            ctx.fill();
        });
        
        // Draw projectiles
        projectiles.forEach(p => p.draw(ctx));

        // Draw EXP gems
        expGems.forEach(gem => {
            ctx.fillStyle = 'yellow';
            ctx.beginPath();
            ctx.arc(gem.x, gem.y, 5, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.restore();
        
        // Draw UI
        drawUI();
    }
    
    function drawWeapons() {
        // Orbiting Orb
        const orb = player.weapons.orbitingOrb;
        for (let i = 0; i < orb.count; i++) {
            const angle = orb.angle + (i * (2 * Math.PI / orb.count));
            const orbX = player.x + Math.cos(angle) * orb.radius;
            const orbY = player.y + Math.sin(angle) * orb.radius;
            ctx.fillStyle = 'orange';
            ctx.beginPath();
            ctx.arc(orbX, orbY, 10, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawUI() {
        // Timer
        const minutes = Math.floor(gameTime / 60000);
        const seconds = Math.floor((gameTime % 60000) / 1000);
        timerDisplay.textContent = `Time: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        // Score
        document.getElementById('score').textContent = `Score: ${score}`;

        // HP Bar
        hpBar.style.width = `${(player.hp / player.maxHp) * 100}%`;
        hpBar.style.backgroundColor = player.hp / player.maxHp > 0.5 ? '#00ff00' : player.hp / player.maxHp > 0.2 ? '#ffff00' : '#ff0000';
    }

    function spawnEnemy() {
        const side = Math.floor(Math.random() * 4);
        let x, y;
        switch (side) {
            case 0: // top
                x = Math.random() * gameArea.width;
                y = -20;
                break;
            case 1: // right
                x = gameArea.width + 20;
                y = Math.random() * gameArea.height;
                break;
            case 2: // bottom
                x = Math.random() * gameArea.width;
                y = gameArea.height + 20;
                break;
            case 3: // left
                x = -20;
                y = Math.random() * gameArea.height;
                break;
        }
        enemies.push({
            x, y,
            radius: 10,
            speed: 1 + Math.random() * 0.5,
            hp: 30,
            maxHp: 30,
            color: 'red'
        });
    }

    function spawnExpGem(x, y) {
        expGems.push({ x, y, value: 10 });
    }

    function checkLevelUp() {
        const requiredExp = level * 50;
        if (exp >= requiredExp) {
            exp -= requiredExp;
            level++;
            showLevelUpModal();
        }
    }

    function showLevelUpModal() {
        gameState = 'paused';
        upgradeOptionsContainer.innerHTML = ''; // Clear previous options

        const upgrades = getUpgradeOptions();
        upgrades.forEach(upgrade => {
            const button = document.createElement('button');
            button.textContent = upgrade.description;
            button.onclick = () => {
                upgrade.apply();
                levelUpModal.style.display = 'none';
                gameState = 'playing';
                gameLoopId = requestAnimationFrame(gameLoop);
            };
            upgradeOptionsContainer.appendChild(button);
        });

        levelUpModal.style.display = 'block';
    }

    function getUpgradeOptions() {
        // Simple upgrade logic for now
        return [
            { description: 'オーブの数を増やす', apply: () => player.weapons.orbitingOrb.count++ },
            { description: 'ミサイルのクールダウン短縮', apply: () => player.weapons.homingMissile.cooldown *= 0.9 },
            { description: 'HPを30回復', apply: () => player.hp = Math.min(player.maxHp, player.hp + 30) }
        ];
    }

    function gameOver() {
        gameState = 'gameOver';
        const minutes = Math.floor(gameTime / 60000);
        const seconds = Math.floor((gameTime % 60000) / 1000);
        finalTimeDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        document.getElementById('final-score').textContent = score;
        gameOverModal.style.display = 'block';
    }
    
    function winGame() {
        gameState = 'gameOver'; // Or a 'win' state
        gameOverModal.innerHTML = `<h2>勝利！</h2><p>5分間生き延びた！</p><button id="retry-button">もう一度挑戦</button>`;
        document.getElementById('retry-button').onclick = () => {
            gameOverModal.style.display = 'none';
            initGame();
        };
        gameOverModal.style.display = 'block';
    }

    // Event Listeners
    window.addEventListener('resize', resizeCanvas);
    startButton.addEventListener('click', initGame);
    retryButton.addEventListener('click', () => {
        gameOverModal.style.display = 'none';
        initGame();
    });

    function handleTouchStart(e) {
        e.preventDefault();
        const t = e.touches[0];
        touch.x = t.clientX;
        touch.y = t.clientY;
        touch.active = true;
    }

    function handleTouchMove(e) {
        e.preventDefault();
        if (touch.active) {
            const t = e.touches[0];
            touch.x = t.clientX;
            touch.y = t.clientY;
        }
    }

    function handleTouchEnd(e) {
        e.preventDefault();
        touch.active = false;
    }

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('mousedown', (e) => {
        touch.x = e.clientX;
        touch.y = e.clientY;
        touch.active = true;
    });
    canvas.addEventListener('mousemove', (e) => {
        if(touch.active) {
            touch.x = e.clientX;
            touch.y = e.clientY;
        }
    });
     canvas.addEventListener('mouseup', (e) => {
        touch.active = false;
    });
     canvas.addEventListener('mouseleave', (e) => {
        touch.active = false;
    });
    
    class HomingMissile {
        constructor(x, y, target, damage) {
            this.x = x;
            this.y = y;
            this.target = target;
            this.damage = damage;
            this.speed = 5;
            this.radius = 5;
            this.color = 'cyan';
        }

        update() {
            if (this.target && this.target.hp > 0) {
                const dx = this.target.x - this.x;
                const dy = this.target.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                this.x += (dx / dist) * this.speed;
                this.y += (dy / dist) * this.speed;
            } else {
                // Target is gone, just fly straight
                this.y -= this.speed; 
            }
        }

        draw(ctx) {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        isOffscreen() {
            return this.x < 0 || this.x > gameArea.width || this.y < 0 || this.y > gameArea.height;
        }
        
        checkCollision(enemy) {
            const dx = this.x - enemy.x;
            const dy = this.y - enemy.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            return dist < this.radius + enemy.radius;
        }
    }
});