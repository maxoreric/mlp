/**
 * Floating Ball Component
 * Quick access translation controls
 */

const FLOATING_BALL_STYLES = `
  :host {
    position: fixed;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  
  .floating-ball {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
    box-shadow: 0 4px 12px rgba(14, 165, 233, 0.4);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s, box-shadow 0.2s;
    user-select: none;
  }
  
  .floating-ball:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 16px rgba(14, 165, 233, 0.5);
  }
  
  .floating-ball:active {
    transform: scale(0.95);
  }
  
  .floating-ball.translating {
    animation: pulse 1.5s infinite;
  }
  
  @keyframes pulse {
    0%, 100% { box-shadow: 0 4px 12px rgba(14, 165, 233, 0.4); }
    50% { box-shadow: 0 4px 20px rgba(14, 165, 233, 0.8); }
  }
  
  .icon {
    width: 24px;
    height: 24px;
    fill: white;
  }
  
  /* Progress ring */
  .progress-ring {
    position: absolute;
    width: 56px;
    height: 56px;
    transform: rotate(-90deg);
  }
  
  .progress-ring circle {
    fill: none;
    stroke: rgba(255, 255, 255, 0.3);
    stroke-width: 3;
  }
  
  .progress-ring .progress {
    stroke: white;
    stroke-dasharray: 157;
    stroke-dashoffset: 157;
    transition: stroke-dashoffset 0.3s;
  }
  
  /* Menu */
  .menu {
    position: absolute;
    bottom: 100%;
    right: 0;
    margin-bottom: 8px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    padding: 8px 0;
    min-width: 160px;
    opacity: 0;
    transform: translateY(10px);
    pointer-events: none;
    transition: opacity 0.2s, transform 0.2s;
  }
  
  .menu.open {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }
  
  .menu-item {
    padding: 10px 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: #334155;
    transition: background 0.15s;
  }
  
  .menu-item:hover {
    background: #f1f5f9;
  }
  
  .menu-item .emoji {
    font-size: 16px;
  }
`

const TRANSLATE_ICON = `
  <svg class="icon" viewBox="0 0 24 24">
    <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
  </svg>
`

export interface FloatingBallCallbacks {
  onTranslate: () => void
  onSettings: () => void
  onToggle: (enabled: boolean) => void
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

    // Create ball
    this.ball = document.createElement('div')
    this.ball.className = 'floating-ball'
    this.ball.innerHTML = TRANSLATE_ICON

    // Create menu
    this.menu = this.createMenu()

    // Create container
    const container = document.createElement('div')
    container.appendChild(this.menu)
    container.appendChild(this.ball)
    this.shadow.appendChild(container)

    // Set initial position
    this.wrapper.style.right = '20px'
    this.wrapper.style.bottom = '100px'

    // Setup event listeners
    this.setupEventListeners()
  }

  private createMenu(): HTMLElement {
    const menu = document.createElement('div')
    menu.className = 'menu'

    menu.innerHTML = `
      <div class="menu-item" data-action="translate">
        <span class="emoji">🌐</span>
        <span>翻译此页面</span>
      </div>
      <div class="menu-item" data-action="restore">
        <span class="emoji">↩️</span>
        <span>恢复原文</span>
      </div>
      <div class="menu-item" data-action="settings">
        <span class="emoji">⚙️</span>
        <span>设置</span>
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

    const x = window.innerWidth - e.clientX + this.dragOffset.x - 48
    const y = window.innerHeight - e.clientY + this.dragOffset.y - 48

    this.wrapper.style.right = `${Math.max(10, Math.min(window.innerWidth - 58, x))}px`
    this.wrapper.style.bottom = `${Math.max(10, Math.min(window.innerHeight - 58, y))}px`
  }

  private onDragEnd(): void {
    setTimeout(() => {
      this.isDragging = false
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
      const offset = 157 * (1 - progress)
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
