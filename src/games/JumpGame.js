import { BaseGame } from './BaseGame.js';
import { soundEngine } from './SoundEngine.js';

export class JumpGame extends BaseGame {
  constructor() {
    super();

    this.char = {
      x: 0,
      y: 0,
      baseY: 0,
      vy: 0,
      jumpForce: -7.6, // Low, snappy realistic jump rope hop
      gravity: 0.82,
      isGrounded: true,
      jumpHeight: 0,
      scaleX: 1,
      scaleY: 1,
      targetScaleX: 1,
      targetScaleY: 1
    };

    this.rope = {
      angle: -Math.PI / 2,
      baseSpeed: 0.078,
      speed: 0.078,
      passedBottom: false,
      isDangerZone: false,
      glowIntensity: 1
    };

    this.combo = 0;
    this.highScore = parseInt(localStorage.getItem('thang_high_score') || '0', 10);
    this.shake = 0;
    this.particles = [];
    this.floatingTexts = [];

    this.bgImg = null;
    this.jumpSprite = null;
    this.assetsLoaded = false;
    this.canRestart = false;

    this.loop = this.loop.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }

  init(canvas, options = {}) {
    super.init(canvas, options);
    this.loadAssets();
    this.setupCanvas();

    this.addListener(window, 'resize', this.handleResize);

    const handleAction = (e) => {
      if (e.target.closest('.ui-modal') || e.target.closest('.ui-interactive')) return;
      if (this.state === 'IDLE' || this.state === 'START') {
        this.start();
      } else if (this.state === 'PLAYING') {
        this.jump();
      } else if (this.state === 'GAMEOVER' && this.canRestart) {
        this.start();
      }
    };

    this.addListener(this.canvas, 'pointerdown', handleAction);

    const handleKeyDown = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        handleAction(e);
      }
    };
    this.addListener(window, 'keydown', handleKeyDown);

    // Initial render
    this.draw();
  }

  loadAssets() {
    this.bgImg = new Image();
    this.bgImg.src = '/assets/hallway-bg.jpg';

    this.jumpSprite = new Image();
    this.jumpSprite.src = '/assets/thang-jump.png';

    let loadedCount = 0;
    const onLoad = () => {
      loadedCount++;
      if (loadedCount >= 2) {
        this.assetsLoaded = true;
        if (this.state !== 'PLAYING') this.draw();
      }
    };

    this.bgImg.onload = onLoad;
    this.jumpSprite.onload = onLoad;
  }

  handleResize() {
    this.setupCanvas();
    if (this.state !== 'PLAYING') this.draw();
  }

  setupCanvas() {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    const parentW = parent ? parent.clientWidth : Math.min(window.innerWidth * 0.92, 420);
    const width = Math.floor(Math.min(parentW || 420, 420));
    const height = Math.floor(Math.min(window.innerHeight * 0.65, 580));

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.ctx.scale(dpr, dpr);
    this.width = width;
    this.height = height;

    this.char.x = this.width / 2;
    this.char.baseY = this.height * 0.60;
    this.char.y = this.char.baseY;
  }

  jump() {
    if (this.char.isGrounded) {
      this.char.vy = this.char.jumpForce;
      this.char.isGrounded = false;
      this.char.targetScaleX = 0.9;
      this.char.targetScaleY = 1.15;
      soundEngine.playJump();
    }
  }

  start() {
    this.state = 'PLAYING';
    this.score = 0;
    this.combo = 0;
    this.canRestart = false;
    this.rope.speed = this.rope.baseSpeed;
    this.rope.angle = -Math.PI / 2;
    this.rope.passedBottom = false;
    this.char.y = this.char.baseY;
    this.char.vy = 0;
    this.char.isGrounded = true;
    this.particles = [];
    this.floatingTexts = [];

    this.updateScore(0);

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.lastTime = performance.now();
    this.animationId = requestAnimationFrame(this.loop);
  }

  gameOver() {
    this.state = 'GAMEOVER';
    this.shake = 16;
    soundEngine.playTrip();

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('thang_high_score', this.highScore);
    }

    this.triggerGameOver(this.score);

    setTimeout(() => {
      this.canRestart = true;
    }, 450);
  }

  getTitle(score) {
    if (score >= 100) return '👑 Huyền Thoại Hành Lang 1m5';
    if (score >= 50) return '⚡ Bậc Thầy Double Under';
    if (score >= 30) return '🔥 Quái Kiệt Nhảy Dây';
    if (score >= 15) return '⭐ Chuyên Gia Bắt Nhịp';
    if (score >= 5) return '👟 Khởi Động Hành Lang';
    return '🌱 Tập Sự Nhảy Dây';
  }

  spawnScoreParticles(x, y) {
    for (let i = 0; i < 10; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 60,
        y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 5,
        vy: -Math.random() * 4 - 2,
        color: ['#39ff14', '#00f0ff', '#facc15', '#ffffff'][Math.floor(Math.random() * 4)],
        size: Math.random() * 5 + 2,
        life: 1,
        decay: 0.035
      });
    }

    this.floatingTexts.push({
      x: x + 40,
      y: y - 20,
      text: '+1',
      life: 1,
      decay: 0.03
    });
  }

  update(dt) {
    if (this.shake > 0) this.shake *= 0.88;
    if (this.shake < 0.2) this.shake = 0;

    this.char.scaleX += (this.char.targetScaleX - this.char.scaleX) * 0.18;
    this.char.scaleY += (this.char.targetScaleY - this.char.scaleY) * 0.18;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 1.2;
      ft.life -= ft.decay;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }

    if (this.state !== 'PLAYING') return;

    // 1. Character Jump Physics
    this.char.y += this.char.vy;
    this.char.vy += this.char.gravity;

    if (this.char.y >= this.char.baseY) {
      this.char.y = this.char.baseY;
      this.char.vy = 0;
      if (!this.char.isGrounded) {
        this.char.isGrounded = true;
        this.char.targetScaleX = 1.15;
        this.char.targetScaleY = 0.85;
        setTimeout(() => {
          this.char.targetScaleX = 1;
          this.char.targetScaleY = 1;
        }, 80);
      }
    }

    this.char.jumpHeight = this.char.baseY - this.char.y;

    // 2. Rope Rotation Physics
    const prevAngle = this.rope.angle;
    this.rope.angle += this.rope.speed;

    if (this.rope.angle > Math.PI) {
      this.rope.angle -= Math.PI * 2;
      this.rope.passedBottom = false;
    }

    if (prevAngle < 0 && this.rope.angle >= 0) {
      soundEngine.playWhoosh(1 + this.score * 0.01);
    }

    // 3. Collision Detection at bottom
    const hitAngle = Math.PI / 2;
    const dangerRange = 0.28;
    const isAtBottom = Math.abs(this.rope.angle - hitAngle) < dangerRange;

    if (isAtBottom && !this.rope.passedBottom) {
      const isCleared = this.char.jumpHeight >= 7;

      if (!isCleared) {
        this.gameOver();
        return;
      } else {
        this.rope.passedBottom = true;
        this.score++;
        this.combo++;
        this.updateScore(this.score);
        soundEngine.playScore();
        this.spawnScoreParticles(this.char.x, this.char.baseY + 30);

        if (this.score % 25 === 0) {
          soundEngine.playCelebration();
        }

        this.rope.speed = Math.min(0.138, this.rope.baseSpeed + Math.floor(this.score / 5) * 0.004);
      }
    }
  }

  draw() {
    if (!this.ctx) return;
    this.ctx.save();

    if (this.shake > 0) {
      const sx = (Math.random() - 0.5) * this.shake;
      const sy = (Math.random() - 0.5) * this.shake;
      this.ctx.translate(sx, sy);
    }

    this.ctx.clearRect(0, 0, this.width, this.height);

    // 1. Background
    this.drawHallwayBackground();

    // 2. Rope behind character
    const isRopeBehind = this.rope.angle > Math.PI / 2 || this.rope.angle < -Math.PI / 2;
    if (isRopeBehind) {
      this.drawRope();
    }

    // 3. Character Shadow & Character
    this.drawShadow();
    this.drawThangCharacter();

    // 4. Rope in front
    if (!isRopeBehind) {
      this.drawRope();
    } else {
      this.drawHandleConnectors();
    }

    // 5. Particles & Popups
    this.drawParticles();
    this.drawFloatingTexts();

    // 6. Overlays
    if (this.state === 'IDLE' || this.state === 'START') {
      this.drawStartOverlay();
    } else if (this.state === 'GAMEOVER') {
      this.drawGameOverOverlay();
    }

    this.ctx.restore();
  }

  drawHallwayBackground() {
    const w = this.width;
    const h = this.height;

    if (this.bgImg && this.bgImg.complete && this.bgImg.naturalWidth > 0) {
      const imgW = this.bgImg.naturalWidth;
      const imgH = this.bgImg.naturalHeight;
      const scale = Math.max(w / imgW, h / imgH);
      const sw = w / scale;
      const sh = h / scale;
      const sx = (imgW - sw) / 2;
      const sy = (imgH - sh) * 0.44;
      this.ctx.drawImage(this.bgImg, sx, sy, sw, sh, 0, 0, w, h);
    } else {
      const grad = this.ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#0b0e1c');
      grad.addColorStop(0.5, '#090c18');
      grad.addColorStop(1, '#070913');
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, w, h);
    }
  }

  drawShadow() {
    const x = this.char.x;
    const y = this.char.baseY + 158;
    const jump = this.char.jumpHeight;

    const scale = Math.max(0.4, 1 - jump / 45);
    const alpha = Math.max(0.25, 0.75 - jump / 35);

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, 68 * scale, 15 * scale, 0, 0, Math.PI * 2);
    this.ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    this.ctx.fill();

    if (jump < 20) {
      this.ctx.beginPath();
      this.ctx.ellipse(x, y + 2, 48 * scale, 8 * scale, 0, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(0, 240, 255, ${0.28 * (1 - jump / 20)})`;
      this.ctx.shadowColor = '#00f0ff';
      this.ctx.shadowBlur = 10;
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  drawThangCharacter() {
    this.ctx.save();
    const cx = this.char.x;
    const cy = this.char.y;

    this.ctx.translate(cx, cy);
    this.ctx.scale(this.char.scaleX, this.char.scaleY);

    const spriteH = 340;
    const aspect = (this.jumpSprite && this.jumpSprite.complete && this.jumpSprite.naturalHeight > 0)
      ? (this.jumpSprite.naturalWidth / this.jumpSprite.naturalHeight)
      : 0.62;
    const spriteW = Math.round(spriteH * aspect);

    if (this.state === 'GAMEOVER') {
      this.ctx.rotate(0.18);
      if (this.jumpSprite && this.jumpSprite.complete && this.jumpSprite.naturalWidth > 0) {
        this.ctx.drawImage(this.jumpSprite, -spriteW / 2, -spriteH / 2 + 15, spriteW, spriteH);
      }
      this.drawDizzyStars(0, -spriteH / 2 - 12);
    } else {
      if (this.jumpSprite && this.jumpSprite.complete && this.jumpSprite.naturalWidth > 0) {
        this.ctx.drawImage(this.jumpSprite, -spriteW / 2, -spriteH / 2, spriteW, spriteH);
      }
    }

    this.ctx.restore();
  }

  drawDizzyStars(cx, cy) {
    this.ctx.save();
    const now = performance.now() * 0.005;
    for (let i = 0; i < 4; i++) {
      const ang = now + (i * Math.PI) / 2;
      const sx = cx + Math.cos(ang) * 35;
      const sy = cy + Math.sin(ang) * 12;
      this.ctx.fillStyle = i % 2 === 0 ? '#ffd60a' : '#ff9e00';
      this.ctx.font = '16px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('💫', sx, sy);
    }
    this.ctx.restore();
  }

  drawRope() {
    const cx = this.char.x;
    const cy = this.char.baseY + 12;
    const angle = this.rope.angle;

    const radiusY = 168;
    const ropeY = cy + Math.sin(angle) * radiusY;
    const ropeZ = Math.cos(angle);

    const scaleX = this.char.scaleX || 1;
    const scaleY = this.char.scaleY || 1;
    const handleDistX = 99.6 * scaleX;
    const handleOffsetY = 28.2 * scaleY;

    const leftHandleX = cx - handleDistX;
    const leftHandleY = this.char.y + handleOffsetY;
    const rightHandleX = cx + handleDistX;
    const rightHandleY = this.char.y + handleOffsetY;

    this.ctx.save();

    const isFront = ropeZ >= 0;
    const lineWidth = isFront ? 4.8 : 2.8;
    const alpha = isFront ? 1.0 : 0.65;

    this.ctx.strokeStyle = `rgba(255, 158, 0, ${alpha})`;
    this.ctx.lineWidth = lineWidth;
    this.ctx.lineCap = 'round';
    this.ctx.shadowColor = '#ff6a00';
    this.ctx.shadowBlur = isFront ? 18 : 6;

    const curveApexY = ropeY;
    const drop = curveApexY - Math.min(leftHandleY, rightHandleY);
    const isOverhead = drop < 0;

    const tanSpread = 68 * (1 + 0.1 * ropeZ);
    const sideSpread = isOverhead ? 26 : 16;
    const dropFactor = isOverhead ? 0.42 : 0.55;

    if (isFront && this.state === 'PLAYING') {
      this.ctx.save();
      this.ctx.strokeStyle = 'rgba(255, 180, 20, 0.28)';
      this.ctx.lineWidth = 1.8;
      this.ctx.beginPath();
      this.ctx.moveTo(leftHandleX, leftHandleY - 6);
      this.ctx.bezierCurveTo(
        leftHandleX - sideSpread, leftHandleY + drop * dropFactor - 6,
        cx - tanSpread, curveApexY - 6,
        cx, curveApexY - 6
      );
      this.ctx.bezierCurveTo(
        cx + tanSpread, curveApexY - 6,
        rightHandleX + sideSpread, rightHandleY + drop * dropFactor - 6,
        rightHandleX, rightHandleY - 6
      );
      this.ctx.stroke();
      this.ctx.restore();
    }

    this.ctx.beginPath();
    this.ctx.moveTo(leftHandleX, leftHandleY);
    this.ctx.bezierCurveTo(
      leftHandleX - sideSpread, leftHandleY + drop * dropFactor,
      cx - tanSpread, curveApexY,
      cx, curveApexY
    );
    this.ctx.bezierCurveTo(
      cx + tanSpread, curveApexY,
      rightHandleX + sideSpread, rightHandleY + drop * dropFactor,
      rightHandleX, rightHandleY
    );
    this.ctx.stroke();

    if (isFront) {
      this.ctx.strokeStyle = '#fff8bd';
      this.ctx.lineWidth = 1.8;
      this.ctx.shadowBlur = 4;
      this.ctx.shadowColor = '#ffd60a';
      this.ctx.stroke();
    }

    this.ctx.fillStyle = isFront ? '#ffd60a' : '#ff9e00';
    this.ctx.shadowColor = '#ff6a00';
    this.ctx.shadowBlur = 8;
    this.ctx.beginPath();
    this.ctx.arc(leftHandleX, leftHandleY, 3, 0, Math.PI * 2);
    this.ctx.arc(rightHandleX, rightHandleY, 3, 0, Math.PI * 2);
    this.ctx.fill();

    if (Math.abs(angle - Math.PI / 2) < 0.22 && this.char.jumpHeight > 2) {
      this.ctx.fillStyle = 'rgba(255, 180, 0, 0.75)';
      this.ctx.shadowColor = '#ff9e00';
      this.ctx.shadowBlur = 18;
      this.ctx.beginPath();
      this.ctx.ellipse(cx, curveApexY, 36, 6, 0, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  drawHandleConnectors() {
    const cx = this.char.x;
    const scaleX = this.char.scaleX || 1;
    const scaleY = this.char.scaleY || 1;
    const handleDistX = 99.6 * scaleX;
    const handleOffsetY = 28.2 * scaleY;

    const leftHandleX = cx - handleDistX;
    const leftHandleY = this.char.y + handleOffsetY;
    const rightHandleX = cx + handleDistX;
    const rightHandleY = this.char.y + handleOffsetY;

    this.ctx.save();
    this.ctx.fillStyle = '#ff9e00';
    this.ctx.shadowColor = '#ff6a00';
    this.ctx.shadowBlur = 8;
    this.ctx.beginPath();
    this.ctx.arc(leftHandleX, leftHandleY, 3, 0, Math.PI * 2);
    this.ctx.arc(rightHandleX, rightHandleY, 3, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  drawParticles() {
    this.ctx.save();
    for (const p of this.particles) {
      this.ctx.fillStyle = p.color;
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur = 8;
      this.ctx.globalAlpha = Math.max(0, p.life);
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  drawFloatingTexts() {
    this.ctx.save();
    for (const ft of this.floatingTexts) {
      this.ctx.font = 'bold 18px sans-serif';
      this.ctx.fillStyle = `rgba(57, 255, 20, ${ft.life})`;
      this.ctx.shadowColor = '#39ff14';
      this.ctx.shadowBlur = 10;
      this.ctx.fillText(ft.text, ft.x, ft.y);
    }
    this.ctx.restore();
  }

  drawStartOverlay() {
    const w = this.width;
    const h = this.height;
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(5, 8, 20, 0.7)';
    this.ctx.fillRect(0, 0, w, h);

    this.ctx.fillStyle = '#00f0ff';
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.shadowBlur = 15;
    this.ctx.font = 'bold 22px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('THẮNG NHẢY DÂY', w / 2, h / 2 - 30);

    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = '#e2e8f0';
    this.ctx.font = '14px sans-serif';
    this.ctx.fillText('Thử thách hành lang 1m5', w / 2, h / 2 - 4);

    this.ctx.fillStyle = '#39ff14';
    this.ctx.font = 'bold 14px sans-serif';
    this.ctx.fillText('Chạm màn hình hoặc bấm Space để nhảy', w / 2, h / 2 + 35);
    this.ctx.restore();
  }

  drawGameOverOverlay() {
    const w = this.width;
    const h = this.height;
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(5, 8, 20, 0.8)';
    this.ctx.fillRect(0, 0, w, h);

    this.ctx.fillStyle = '#f43f5e';
    this.ctx.shadowColor = '#f43f5e';
    this.ctx.shadowBlur = 15;
    this.ctx.font = 'bold 24px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('VẤP DÂY RỒI!', w / 2, h / 2 - 40);

    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 16px sans-serif';
    this.ctx.fillText(`Điểm: ${this.score}  |  Kỷ lục: ${this.highScore}`, w / 2, h / 2 - 10);

    this.ctx.fillStyle = '#facc15';
    this.ctx.font = '13px sans-serif';
    this.ctx.fillText(this.getTitle(this.score), w / 2, h / 2 + 16);

    this.ctx.fillStyle = '#39ff14';
    this.ctx.font = 'bold 13px sans-serif';
    this.ctx.fillText('Chạm màn hình để nhảy tiếp', w / 2, h / 2 + 50);
    this.ctx.restore();
  }

  loop(timestamp) {
    if (this.state !== 'PLAYING' && this.state !== 'GAMEOVER') return;
    const dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    this.update(dt);
    this.draw();

    this.animationId = requestAnimationFrame(this.loop);
  }
}
