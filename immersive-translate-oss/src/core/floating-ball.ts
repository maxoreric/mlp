/**
 * Floating Ball Component
 * Quick access translation controls
 */

const FLOATING_BALL_STYLES = `
  :host {
    position: fixed;
    z-index: 2147483647;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  
  .floating-ball {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    /* Glassmorphism base if image fails or transparent parts */
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(8px);
    box-shadow: 0 8px 32px rgba(14, 165, 233, 0.3), inset 0 0 0 1px rgba(255, 255, 255, 0.2);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    user-select: none;
    overflow: hidden;
  }

  .floating-ball img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
  }
  
  .floating-ball:hover {
    transform: scale(1.1) translateY(-2px);
    box-shadow: 0 12px 40px rgba(14, 165, 233, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.4);
  }
  
  .floating-ball:active {
    transform: scale(0.95);
  }
  
  .floating-ball.translating {
    animation: bounce 1s infinite;
  }
  
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }
  
  /* Progress ring */
  .progress-ring {
    position: absolute;
    width: 64px;
    height: 64px;
    transform: rotate(-90deg);
    pointer-events: none;
  }
  
  .progress-ring circle {
    fill: none;
    stroke: url(#gradient);
    stroke-width: 3;
    stroke-linecap: round;
    filter: drop-shadow(0 0 4px rgba(14, 165, 233, 0.5));
  }
  
  .progress-ring .progress {
    stroke-dasharray: 188; /* 2 * PI * 30 */
    stroke-dashoffset: 188;
    transition: stroke-dashoffset 0.3s ease-out;
  }
  
  /* Menu */
  .menu {
    position: absolute;
    bottom: 100%;
    right: 0;
    margin-bottom: 12px;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 16px;
    box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.2);
    padding: 8px;
    min-width: 180px;
    opacity: 0;
    transform: translateY(20px) scale(0.95);
    pointer-events: none;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    transform-origin: bottom right;
  }
  
  .menu.open {
    opacity: 1;
    transform: translateY(0) scale(1);
    pointer-events: auto;
  }
  
  .menu-item {
    padding: 10px 12px;
    margin-bottom: 2px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 14px;
    font-weight: 500;
    color: #1e293b;
    transition: all 0.15s;
    background: transparent;
  }
  
  .menu-item:hover {
    background: rgba(14, 165, 233, 0.1);
    color: #0284c7;
  }

  .menu-item:active {
    background: rgba(14, 165, 233, 0.2);
  }
  
  .menu-item .emoji {
    font-size: 18px;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
  }
`

export interface FloatingBallCallbacks {
  onTranslate: () => void
  onSettings: () => void
  onToggle: (enabled: boolean) => void
  onPositionChange?: (x: number, y: number) => void
  initialPosition?: { x: number, y: number }
}

export class FloatingBall {
  private wrapper: HTMLElement
  private shadow: ShadowRoot
  private ball: HTMLElement
  private menu: HTMLElement
  private progressCircle: SVGCircleElement | null = null
  private isMenuOpen = false

  private isDragging = false
  private dragOffset = { x: 0, y: 0 }

  constructor(private callbacks: FloatingBallCallbacks) {
    // Create wrapper
    this.wrapper = document.createElement('immersive-translate-ball')
    this.shadow = this.wrapper.attachShadow({ mode: 'open' })

    // Add styles
    const style = document.createElement('style')
    style.textContent = FLOATING_BALL_STYLES
    this.shadow.appendChild(style)

    // ... rest of init code will be handled by existing code or subsequent edits if needed

    // Logic continues below... I'm just replacing up to the style injection to be safe or I can use target content better.
    // Actually, I can just replace the interface and constructor signature.
    // But I entered constructor body in ReplacementContent. 
    // Let's stick to replacing the interface and class start.
    // Wait, I need to use `callbacks.initialPosition` in the constructor.
    // I will do that in a separate edit or include it here if I include the initialization logic.


    // Create SVG Gradient for progress
    const svgDefs = document.createElement('div')
    svgDefs.innerHTML = `
      <svg width="0" height="0" style="position: absolute;">
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#38bdf8" />
            <stop offset="100%" stop-color="#0284c7" />
          </linearGradient>
        </defs>
      </svg>
    `
    this.shadow.appendChild(svgDefs)

    // Create ball
    this.ball = document.createElement('div')
    this.ball.className = 'floating-ball'

    // Use generated image
    const img = document.createElement('img')
    img.src = chrome.runtime.getURL('floating-ball.png')
    img.onerror = () => {
      // Fallback if image fails
      img.style.display = 'none';
      this.ball.innerHTML = `<svg viewBox="0 0 24 24" fill="white" width="28" height="28" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2))"><path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>`
    }
    this.ball.appendChild(img)

    // Create progress ring
    const progressSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    progressSvg.classList.add('progress-ring')
    progressSvg.setAttribute('viewBox', '0 0 64 64')
    progressSvg.innerHTML = `
      <circle class="progress" cx="32" cy="32" r="30"></circle>
    `
    this.progressCircle = progressSvg.querySelector('circle')

    // Create menu
    this.menu = this.createMenu()

    // Create container
    const container = document.createElement('div')
    container.style.position = 'relative' // Ensure relative positioning for menu
    container.appendChild(this.menu)
    container.appendChild(progressSvg)
    container.appendChild(this.ball) // Ball last to be on top
    this.shadow.appendChild(container)

    // Set initial position
    if (this.callbacks.initialPosition && this.callbacks.initialPosition.x >= 0 && this.callbacks.initialPosition.y >= 0) {
      this.wrapper.style.right = `${this.callbacks.initialPosition.x}px`
      this.wrapper.style.bottom = `${this.callbacks.initialPosition.y}px`
    } else {
      this.wrapper.style.right = '40px'
      this.wrapper.style.bottom = '100px'
    }

    // Setup event listeners
    this.setupEventListeners()
  }

  private createMenu(): HTMLElement {
    const menu = document.createElement('div')
    menu.className = 'menu'

    menu.innerHTML = `
      <div class="menu-item" data-action="translate">
        <span class="emoji">✨</span>
        <span>立即翻译</span>
      </div>
      <div class="menu-item" data-action="restore">
        <span class="emoji">🔄</span>
        <span>恢复原文</span>
      </div>
      <div class="menu-item" data-action="settings">
        <span class="emoji">⚙️</span>
        <span>插件设置</span>
      </div>
    `

    return menu
  }

  private setupEventListeners(): void {
    // Click to toggle menu or translate
    this.ball.addEventListener('click', (e) => {
      if (this.isDragging) return

      if (e.shiftKey) {
        // Shift+click: direct translate
        this.callbacks.onTranslate()
      } else {
        this.toggleMenu()
      }
    })

    // Double click to translate
    this.ball.addEventListener('dblclick', () => {
      this.callbacks.onTranslate()
    })

    // Menu item clicks
    this.menu.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      const item = target.closest('.menu-item') as HTMLElement
      if (!item) return

      const action = item.dataset.action
      this.closeMenu()

      switch (action) {
        case 'translate':
          this.callbacks.onTranslate()
          break
        case 'restore':
          this.callbacks.onToggle(false)
          break
        case 'settings':
          this.callbacks.onSettings()
          break
      }
    })

    // Drag functionality
    this.ball.addEventListener('mousedown', this.onDragStart.bind(this))
    document.addEventListener('mousemove', this.onDrag.bind(this))
    document.addEventListener('mouseup', this.onDragEnd.bind(this))

    // Close menu on outside click
    document.addEventListener('click', (e) => {
      if (!this.wrapper.contains(e.target as Node)) {
        this.closeMenu()
      }
    })
  }

  private onDragStart(e: MouseEvent): void {
    if (e.button !== 0) return

    this.isDragging = false
    this.dragOffset = {
      x: e.clientX - this.wrapper.getBoundingClientRect().left,
      y: e.clientY - this.wrapper.getBoundingClientRect().top,
    }

    // Start drag after short delay to distinguish from click
    const startX = e.clientX
    const startY = e.clientY

    const checkDrag = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX
      const dy = moveEvent.clientY - startY
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        this.isDragging = true
      }
    }

    document.addEventListener('mousemove', checkDrag, { once: true })
  }

  private onDrag(e: MouseEvent): void {
    if (!this.isDragging) return

    const x = window.innerWidth - e.clientX + this.dragOffset.x - 56
    const y = window.innerHeight - e.clientY + this.dragOffset.y - 56

    this.wrapper.style.right = `${Math.max(20, Math.min(window.innerWidth - 76, x))}px`
    this.wrapper.style.bottom = `${Math.max(20, Math.min(window.innerHeight - 76, y))}px`
  }

  private onDragEnd(): void {
    setTimeout(() => {
      this.isDragging = false
      if (this.callbacks.onPositionChange) {
        const rect = this.wrapper.getBoundingClientRect()
        // Save position relative to bottom-right as per our CSS logic (right/bottom)
        const right = window.innerWidth - rect.right
        const bottom = window.innerHeight - rect.bottom
        this.callbacks.onPositionChange(right, bottom)
      }
    }, 10)
  }

  private toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen
    this.menu.classList.toggle('open', this.isMenuOpen)
  }

  private closeMenu(): void {
    this.isMenuOpen = false
    this.menu.classList.remove('open')
  }

  setProgress(progress: number): void {
    if (this.progressCircle) {
      // 2 * PI * 30 = ~188
      const offset = 188 * (1 - progress)
      this.progressCircle.style.strokeDashoffset = String(offset)
    }
  }

  setTranslating(translating: boolean): void {
    this.ball.classList.toggle('translating', translating)
  }

  mount(): void {
    document.body.appendChild(this.wrapper)
  }

  unmount(): void {
    this.wrapper.remove()
  }
}
