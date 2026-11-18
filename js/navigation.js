/* ==========================================================================
   МОДУЛЬ НАВИГАЦИИ, ШКАЛЫ ПРОГРЕССА И РЕЖИМОВ ОТОБРАЖЕНИЯ (navigation.js)
   Управляет переключением между Уровнями 1–6, разделами сайта,
   полноэкранным режимом, режимами электронной доски и экранной клавиатурой.
   ========================================================================== */

window.NavigationManager = (function () {
  let currentMainSection = 'lesson'; // 'lesson' | 'thinking' | 'trainer' | 'quiz' | 'summary'
  let currentLevel = 1; // 1..6
  const completedLevels = new Set();
  let activeInputEl = null;

  const LEVEL_META = [
    { level: 1, label: 'Уровень 1', title: 'Вспоминаем изученное' },
    { level: 2, label: 'Уровень 2', title: 'Два прямоугольника' },
    { level: 3, label: 'Уровень 3', title: 'Прямоугольник + треугольник' },
    { level: 4, label: 'Уровень 4', title: 'Три и более частей' },
    { level: 5, label: 'Уровень 5', title: 'Разбираем сами (2 способа)' },
    { level: 6, label: 'Уровень 6', title: 'Сложные задачи' }
  ];

  let onSectionChangeCallback = null;
  let onLevelChangeCallback = null;

  function renderProgressScale(containerEl) {
    if (!containerEl) return;
    containerEl.innerHTML = '';

    LEVEL_META.forEach((item, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'level-step-btn';
      if (currentMainSection === 'lesson' && item.level === currentLevel) {
        btn.classList.add('active');
      }
      if (completedLevels.has(item.level)) {
        btn.classList.add('completed');
      }

      btn.innerHTML = `
        <span class="level-num-badge">${completedLevels.has(item.level) && item.level !== currentLevel ? '✓' : item.level}</span>
        <span class="level-step-info">
          <span class="level-step-label">${item.label}</span>
          <span class="level-step-title">${item.title}</span>
        </span>
      `;

      btn.addEventListener('click', () => {
        if (window.SpeechController) window.SpeechController.stop();
        currentMainSection = 'lesson';
        currentLevel = item.level;
        updateNavigationUI();
        if (typeof onLevelChangeCallback === 'function') {
          onLevelChangeCallback(currentLevel);
        }
      });

      containerEl.appendChild(btn);

      if (idx < LEVEL_META.length - 1) {
        const arrow = document.createElement('span');
        arrow.className = 'level-arrow';
        arrow.textContent = '→';
        containerEl.appendChild(arrow);
      }
    });
  }

  function updateNavigationUI() {
    // 1. Вкладки режимов в шапке
    document.querySelectorAll('.mode-tab-btn').forEach((btn) => {
      const sec = btn.getAttribute('data-section');
      btn.classList.toggle('active', sec === currentMainSection);
    });

    // 2. Шкала уровней 1 -> 6
    const trackEl = document.getElementById('levelsTrackContainer');
    if (trackEl) {
      renderProgressScale(trackEl);
    }

    // 3. Показываем/скрываем полосу прогресса уровней
    const progressBarEl = document.getElementById('levelProgressBar');
    if (progressBarEl) {
      progressBarEl.style.display = currentMainSection === 'lesson' ? 'flex' : 'none';
    }
  }

  function setMainSection(sectionName) {
    if (window.SpeechController) window.SpeechController.stop();
    currentMainSection = sectionName;
    updateNavigationUI();
    if (typeof onSectionChangeCallback === 'function') {
      onSectionChangeCallback(currentMainSection);
    }
  }

  function setLevel(levelNumber) {
    if (window.SpeechController) window.SpeechController.stop();
    const clamped = Math.max(1, Math.min(6, levelNumber));
    currentMainSection = 'lesson';
    currentLevel = clamped;
    updateNavigationUI();
    if (typeof onLevelChangeCallback === 'function') {
      onLevelChangeCallback(currentLevel);
    }
  }

  function markLevelCompleted(levelNumber) {
    completedLevels.add(levelNumber);
    updateNavigationUI();
  }

  /**
   * Переключение режима отображения:
   * 'board' (Режим электронной доски), 'desktop' (Обычный компьютерный), 'mobile' (Мобильный)
   */
  function setDisplayMode(mode) {
    document.body.classList.remove('mode-board', 'mode-desktop', 'mode-mobile');
    if (mode === 'board') {
      document.body.classList.add('mode-board');
    } else if (mode === 'mobile') {
      document.body.classList.add('mode-mobile');
    } else {
      document.body.classList.add('mode-desktop');
    }
  }

  /**
   * Полноэкранный режим для электронной доски
   */
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }

  /**
   * Переключение упрощённого режима анимаций (для слабых ПК/досок)
   */
  function toggleReducedMotion() {
    const isReduced = document.body.classList.toggle('reduced-motion');
    const btn = document.getElementById('reducedMotionBtn');
    if (btn) {
      btn.classList.toggle('active', isReduced);
      btn.textContent = isReduced ? '⚡ Анимации: упрощ.' : '✨ Анимации: плавные';
    }
    return isReduced;
  }

  /**
   * Создаёт экранную цифровую клавиатуру для ввода чисел пальцем на электронной доске
   */
  function createBoardNumpad(onEnterCallback) {
    const pad = document.createElement('div');
    pad.className = 'board-numpad';

    const label = document.createElement('span');
    label.style.fontWeight = '700';
    label.style.fontSize = 'var(--fs-xs)';
    label.style.color = 'var(--text-secondary)';
    label.style.marginRight = '6px';
    label.textContent = 'Клавиатура доски:';
    pad.appendChild(label);

    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].forEach((digit) => {
      const k = document.createElement('button');
      k.type = 'button';
      k.className = 'numpad-key';
      k.textContent = digit;
      k.addEventListener('click', () => {
        if (!activeInputEl) {
          const firstInp = document.querySelector('.math-input');
          if (firstInp) activeInputEl = firstInp;
        }
        if (activeInputEl) {
          if (activeInputEl.value.length < 4) {
            activeInputEl.value += digit;
            activeInputEl.dispatchEvent(new Event('input', { bubbles: true }));
          }
          if (window.innerWidth > 860) {
            activeInputEl.focus();
          }
        }
      });
      pad.appendChild(k);
    });

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'numpad-key key-clear';
    backBtn.textContent = '⌫ Стереть';
    backBtn.addEventListener('click', () => {
      if (activeInputEl) {
        activeInputEl.value = activeInputEl.value.slice(0, -1);
        activeInputEl.dispatchEvent(new Event('input', { bubbles: true }));
        if (window.innerWidth > 860) {
          activeInputEl.focus();
        }
      }
    });
    pad.appendChild(backBtn);

    if (typeof onEnterCallback === 'function') {
      const okBtn = document.createElement('button');
      okBtn.type = 'button';
      okBtn.className = 'btn btn-primary';
      okBtn.style.minHeight = '54px';
      okBtn.style.padding = '8px 18px';
      okBtn.textContent = '✓ Проверить';
      okBtn.addEventListener('click', onEnterCallback);
      pad.appendChild(okBtn);
    }

    return pad;
  }

  function registerMathInput(inputEl) {
    if (!inputEl) return;
    inputEl.addEventListener('focus', () => {
      activeInputEl = inputEl;
    });
    inputEl.addEventListener('click', () => {
      activeInputEl = inputEl;
    });
    if (!activeInputEl) {
      activeInputEl = inputEl;
    }
  }

  function resetActiveInput() {
    activeInputEl = null;
  }

  function autoDetectDeviceMode() {
    const sel = document.getElementById('displayModeSelect');
    if (window.innerWidth <= 860) {
      setDisplayMode('mobile');
      if (sel) sel.value = 'mobile';
    } else if (document.body.classList.contains('mode-mobile') && window.innerWidth > 960) {
      setDisplayMode('board');
      if (sel) sel.value = 'board';
    }
  }

  return {
    init(options = {}) {
      onSectionChangeCallback = options.onSectionChange || null;
      onLevelChangeCallback = options.onLevelChange || null;
      autoDetectDeviceMode();
      window.addEventListener('resize', autoDetectDeviceMode);
      updateNavigationUI();
    },
    setMainSection,
    setLevel,
    getCurrentSection: () => currentMainSection,
    getCurrentLevel: () => currentLevel,
    markLevelCompleted,
    setDisplayMode,
    toggleFullscreen,
    toggleReducedMotion,
    createBoardNumpad,
    registerMathInput,
    resetActiveInput,
    LEVEL_META
  };
})();
