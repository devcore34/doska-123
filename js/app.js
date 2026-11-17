/* ==========================================================================
   ГЛАВНЫЙ МОДУЛЬ ИНТЕРАКТИВНОГО УРОКА МАТЕМАТИКИ 5 КЛАССА (app.js)
   Тема: «Нахождение площади фигур, состоящих из прямоугольников и треугольников»
   Координирует Уровни 1–6, Раздел «Учимся думать», Тренажёр, Викторину,
   Итоги урока, панель учителя и голосовое сопровождение.
   ========================================================================== */

(function () {
  const Geo = window.GeometryEngine;
  const Timeline = window.AnimationTimeline;
  const Speech = window.SpeechController;
  const Nav = window.NavigationManager;
  const Exercises = window.ExercisesModule;
  const Quiz = window.QuizModule;

  // Глобальное состояние текущего экрана урока
  const appState = {
    level1Subtab: 'rect', // 'rect' | 'tri'
    level4ExampleIdx: 0, // 0..3
    level4QuizPassed: { 0: false, 1: false, 2: false, 3: false },
    level5TaskIdx: 0, // 0..2
    level5Way: 1, // 1 | 2
    level5CutMode: false,
    level5CutUnlocked: false,
    level6TaskIdx: 0, // 0..5
    level6Solved: new Set(),

    // Раздел 7 «Учимся думать самостоятельно»
    thinkingIdx: 0,
    thinkingStage: 1, // 1: выбор разбиения, 2: выбор формул, 3: площади частей, 4: общая площадь
    thinkingFormulasChosen: {},

    // Раздел 8 «Тренажёр (20 задач)»
    trainerTier: 'all', // 'all' | 'easy' | 'simple' | 'medium' | 'hard'
    trainerProblemId: 1,
    trainerSolved: new Set(),

    // Раздел 9 «Викторина (10 вопросов)»
    quizIndex: 0,
    quizAnswers: {}, // { questionId: selectedOptionIndex }
    quizFinished: false
  };

  let activeSceneController = null;
  let currentHintText = '';

  /* ========================================================================
     ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
     ======================================================================== */

  document.addEventListener('DOMContentLoaded', () => {
    Nav.init({
      onSectionChange: (section) => renderActiveSection(section),
      onLevelChange: (level) => renderLessonLevel(level)
    });

    bindHeaderAndDockControls();
    renderLessonLevel(1);
  });

  function bindHeaderAndDockControls() {
    // Переключение главных разделов в шапке
    document.querySelectorAll('.mode-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sec = btn.getAttribute('data-section');
        Nav.setMainSection(sec);
      });
    });

    // Переключатель режима отображения (Доска / Компьютер / Мобильный)
    const displaySelect = document.getElementById('displayModeSelect');
    if (displaySelect) {
      displaySelect.addEventListener('change', (e) => {
        Nav.setDisplayMode(e.target.value);
      });
    }

    // Упрощённые анимации
    const reducedBtn = document.getElementById('reducedMotionBtn');
    if (reducedBtn) {
      reducedBtn.addEventListener('click', () => {
        Nav.toggleReducedMotion();
      });
    }

    // Полный экран (в шапке и в нижней панели учителя)
    const fsHeaderBtn = document.getElementById('fullscreenHeaderBtn');
    const fsDockBtn = document.getElementById('dockFullscreenBtn');
    if (fsHeaderBtn) fsHeaderBtn.addEventListener('click', () => Nav.toggleFullscreen());
    if (fsDockBtn) fsDockBtn.addEventListener('click', () => Nav.toggleFullscreen());

    // Кнопки пошагового режима учителя (Раздел 10)
    const prevBtn = document.getElementById('dockPrevStepBtn');
    const nextBtn = document.getElementById('dockNextStepBtn');
    const playBtn = document.getElementById('dockPlayAnimBtn');
    const pauseBtn = document.getElementById('dockPauseAnimBtn');
    const repeatBtn = document.getElementById('dockRepeatBtn');
    const separateBtn = document.getElementById('dockSeparateToggleBtn');
    const hintBtn = document.getElementById('dockHintBtn');
    const solutionBtn = document.getElementById('dockSolutionBtn');

    if (separateBtn) {
      separateBtn.addEventListener('click', () => {
        if (!activeSceneController) return;
        Timeline.pause();
        const isNowSep = activeSceneController.toggleSeparate();
        separateBtn.textContent = isNowSep ? '↩ Собрать обратно' : '↔ Разнести в стороны';
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        Speech.stop();
        Timeline.prevStep();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        Speech.stop();
        Timeline.nextStep();
      });
    }
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        const st = Timeline.getStatus();
        if (st === 'paused') {
          Timeline.resume();
        } else {
          Timeline.play();
        }
      });
    }
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        Timeline.pause();
      });
    }
    if (repeatBtn) {
      repeatBtn.addEventListener('click', () => {
        Speech.stop();
        Timeline.repeat();
      });
    }
    if (hintBtn) {
      hintBtn.addEventListener('click', () => {
        showTeacherModalToast(
          '💡 Методическая подсказка',
          currentHintText ||
            'Обратите внимание учеников на вершины внутренних углов: именно из них удобнее всего провести вертикальную или горизонтальную линию разделения.'
        );
      });
    }
    if (solutionBtn) {
      solutionBtn.addEventListener('click', () => {
        Speech.stop();
        if (Nav.getCurrentSection() === 'lesson') {
          Timeline.showFullSolution();
        } else {
          const solTrigger = document.getElementById('contextualShowSolutionBtn');
          if (solTrigger) solTrigger.click();
        }
      });
    }

    // Кнопки голосового сопровождения (Раздел 11)
    const speakBtn = document.getElementById('dockSpeakBtn');
    const speechPauseBtn = document.getElementById('dockSpeechPauseBtn');
    const speechResumeBtn = document.getElementById('dockSpeechResumeBtn');
    const speechStopBtn = document.getElementById('dockSpeechStopBtn');

    if (speakBtn) {
      speakBtn.addEventListener('click', () => {
        const text = Speech.getStepText();
        Speech.speak(text);
      });
    }
    if (speechPauseBtn) {
      speechPauseBtn.addEventListener('click', () => Speech.pause());
    }
    if (speechResumeBtn) {
      speechResumeBtn.addEventListener('click', () => Speech.resume());
    }
    if (speechStopBtn) {
      speechStopBtn.addEventListener('click', () => Speech.stop());
    }

    Speech.onStateChange((voiceState) => {
      if (!speakBtn) return;
      speakBtn.classList.toggle('dock-voice-active', voiceState === 'speaking');
      if (speechPauseBtn) speechPauseBtn.disabled = voiceState !== 'speaking';
      if (speechResumeBtn) speechResumeBtn.disabled = voiceState !== 'paused';
      if (speechStopBtn) speechStopBtn.disabled = voiceState === 'idle';
    });
  }

  /**
   * Всплывающее сообщение подсказки для электронной доски
   */
  function showTeacherModalToast(title, message) {
    let box = document.getElementById('teacherHintToast');
    if (!box) {
      box = document.createElement('div');
      box.id = 'teacherHintToast';
      box.style.cssText = `
        position: fixed;
        bottom: 88px;
        right: 28px;
        max-width: 520px;
        background: #FFFFFF;
        border: 3px solid var(--primary);
        border-radius: 18px;
        padding: 18px 22px;
        box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
        z-index: 200;
      `;
      document.body.appendChild(box);
    }
    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px;">
        <strong style="font-size:var(--fs-sm);color:var(--primary);">${title}</strong>
        <button type="button" id="closeHintToastBtn" style="border:none;background:var(--bg-subtle);width:34px;height:34px;border-radius:8px;font-weight:800;cursor:pointer;">✕</button>
      </div>
      <div style="font-size:var(--fs-sm);color:var(--text-primary);line-height:1.45;">${message}</div>
    `;
    box.style.display = 'block';
    document.getElementById('closeHintToastBtn').onclick = () => {
      box.style.display = 'none';
    };
  }

  /**
   * Обновляет состояние кнопок нижней панели учителя при смене шага
   */
  function syncDockWithTimeline(stepIndex, stepObj, totalSteps) {
    const prevBtn = document.getElementById('dockPrevStepBtn');
    const nextBtn = document.getElementById('dockNextStepBtn');
    const playBtn = document.getElementById('dockPlayAnimBtn');
    const pauseBtn = document.getElementById('dockPauseAnimBtn');

    if (prevBtn) prevBtn.disabled = stepIndex <= 0;
    if (nextBtn) nextBtn.disabled = stepIndex >= totalSteps - 1;

    const st = Timeline.getStatus();
    if (playBtn) {
      playBtn.textContent = st === 'paused' ? '▶ Продолжить' : '▶ Запустить анимацию';
    }
    if (pauseBtn) {
      pauseBtn.disabled = st !== 'playing';
    }

    const separateBtn = document.getElementById('dockSeparateToggleBtn');
    if (separateBtn && activeSceneController) {
      separateBtn.textContent = activeSceneController.isSeparated()
        ? '↩ Собрать обратно'
        : '↔ Разнести в стороны';
    }

    if (stepObj && stepObj.speech) {
      Speech.setStepText(stepObj.speech);
    }
  }

  /* ========================================================================
     МАРШРУТИЗАТОР РАЗДЕЛОВ САЙТА
     ======================================================================== */

  function renderActiveSection(section) {
    Nav.resetActiveInput();
    const root = document.getElementById('workspaceRoot');
    if (!root) return;

    if (section === 'lesson') {
      renderLessonLevel(Nav.getCurrentLevel());
    } else if (section === 'thinking') {
      renderThinkingSection(root);
    } else if (section === 'trainer') {
      renderTrainerSection(root);
    } else if (section === 'quiz') {
      renderQuizSection(root);
    } else if (section === 'summary') {
      renderSummarySection(root);
    }
  }

  function renderLessonLevel(level) {
    Nav.resetActiveInput();
    const root = document.getElementById('workspaceRoot');
    if (!root) return;

    if (level === 1) renderLevel1(root);
    else if (level === 2) renderLevel2(root);
    else if (level === 3) renderLevel3(root);
    else if (level === 4) renderLevel4(root);
    else if (level === 5) renderLevel5(root);
    else if (level === 6) renderLevel6(root);
  }

  /* ========================================================================
     ВСПОМОГАТЕЛЬНЫЙ РЕНДЕР СТАНДАРТНОЙ ДОСКИ УРОКА + ПОШАГОВОЙ ПАНЕЛИ
     ======================================================================== */

  /**
   * Добавляет в правую панель:
   * 1) Блок «📋 Условие задачи (Дано / Найти)» сбоку от чертежа.
   * 2) Маленькие цветные фигурки в нижнем индексе возле каждого символа площади «S»,
   *    чтобы ученик сразу понимал, площадь какой именно фигуры сейчас вычисляется.
   * 3) Кнопку «➕ Показать следующий шаг решения», которая по очереди открывает
   *    шаги математического решения один за другим и подсвечивает соответствующую часть на чертеже.
   */
  function enhanceMathBoardWithConditionAndStepper(figure, customNote = '') {
    if (!figure || !figure.parts) return;

    // 1. Вставляем блок «📋 Условие задачи (Дано / Найти)» в правую боковую панель
    const rightPanel = document.querySelector('.explanation-panel');
    const mathBoard = document.querySelector('.math-board');
    if (rightPanel && mathBoard && !document.getElementById('sideConditionCard')) {
      const condWrapper = document.createElement('div');
      condWrapper.id = 'sideConditionCard';
      condWrapper.innerHTML = Geo.renderConditionBoxHTML(figure, customNote);
      rightPanel.insertBefore(condWrapper, mathBoard);
    }

    // 2. Обновляем формулу в баннере и строки вычислений, добавляя маленькую фигурку под букву S
    const formulaBannerExpr = document.getElementById('stepFormulaExpr');
    if (formulaBannerExpr && figure.parts.length > 1) {
      const totalSym = Geo.renderAreaSymbol(figure.outerContour, 'total', '');
      const partsSyms = figure.parts
        .map((p, i) => Geo.renderAreaSymbol(p.points, p.type, i + 1))
        .join(' + ');
      formulaBannerExpr.innerHTML = `${totalSym} = ${partsSyms}`;
    } else if (formulaBannerExpr && figure.parts.length === 1) {
      const p0 = figure.parts[0];
      const sym0 = Geo.renderAreaSymbol(p0.points, p0.type, '');
      const isTri = p0.type && p0.type.startsWith('tri');
      formulaBannerExpr.innerHTML = `${sym0} = ${isTri ? '(a × h) : 2' : 'a × b'}`;
    }

    const calcContainer = document.getElementById('calcStepsContainer');
    if (!calcContainer) return;

    const calcLines = Array.from(calcContainer.querySelectorAll('.calc-line'));
    if (calcLines.length === 0) return;

    // Заменяем обычные S₁, S₂, S на символ S с маленькой фигуркой внизу!
    calcLines.forEach((lineEl, idx) => {
      const mathSpan = lineEl.querySelector('.calc-math');
      if (!mathSpan) return;

      if (lineEl.classList.contains('total-answer')) {
        mathSpan.innerHTML = Geo.renderTotalCalcWithIcons(figure);
      } else if (figure.parts[idx]) {
        mathSpan.innerHTML = Geo.renderPartCalcWithIcon(figure.parts[idx], idx);
      } else if (figure.parts.length === 1 && figure.parts[0]) {
        const p0 = figure.parts[0];
        const sym0 = Geo.renderAreaSymbol(p0.points, p0.type, '');
        mathSpan.innerHTML = mathSpan.innerHTML.replace(/^S[пр₁₂]?\s*=/, `${sym0} =`);
      }
    });

    // 3. Добавляем кнопку поочерёдного открытия шагов решения («➕ Показать следующий шаг решения»)
    if (!document.getElementById('progressiveCalcStepBar')) {
      let revealedCount = calcLines.filter((el) => el.classList.contains('visible')).length;

      const stepBar = document.createElement('div');
      stepBar.id = 'progressiveCalcStepBar';
      stepBar.className = 'next-calc-step-bar';

      const revealBtn = document.createElement('button');
      revealBtn.type = 'button';
      revealBtn.className = 'btn-reveal-step';

      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'subtab-btn';
      resetBtn.style.minHeight = '50px';
      resetBtn.textContent = '↺ Скрыть шаги';
      resetBtn.title = 'Скрыть вычисления и начать показ по шагам заново';

      function updateRevealBtnLabel() {
        if (revealedCount >= calcLines.length) {
          revealBtn.classList.add('all-revealed');
          revealBtn.innerHTML = `✓ Все шаги решения открыты (${calcLines.length} из ${calcLines.length})`;
        } else {
          revealBtn.classList.remove('all-revealed');
          revealBtn.innerHTML = `➕ Показать шаг решения ${revealedCount + 1} из ${calcLines.length}`;
        }
      }

      revealBtn.addEventListener('click', () => {
        if (window.AnimationTimeline) window.AnimationTimeline.pause();

        if (revealedCount >= calcLines.length) {
          // Если все уже открыты, начинаем по очереди с 1-го шага
          calcLines.forEach((el) => el.classList.remove('visible', 'active-focus'));
          revealedCount = 0;
        }

        const targetLine = calcLines[revealedCount];
        if (targetLine) {
          calcLines.forEach((el) => el.classList.remove('active-focus'));
          targetLine.classList.add('visible', 'active-focus');

          // Синхронно подсвечиваем или разделяем соответствующую часть на чертеже!
          if (activeSceneController) {
            if (revealedCount < figure.parts.length && figure.parts.length > 1) {
              activeSceneController.drawSplitLines();
              activeSceneController.separateParts(true);
              activeSceneController.highlightPart(figure.parts[revealedCount].id);
            } else if (targetLine.classList.contains('total-answer') && figure.parts.length > 1) {
              activeSceneController.reassembleParts(true);
            }
          }
        }

        revealedCount++;
        updateRevealBtnLabel();
      });

      resetBtn.addEventListener('click', () => {
        if (window.AnimationTimeline) window.AnimationTimeline.pause();
        calcLines.forEach((el) => el.classList.remove('visible', 'active-focus'));
        revealedCount = 0;
        if (activeSceneController) {
          activeSceneController.resetToInitial();
        }
        updateRevealBtnLabel();
      });

      updateRevealBtnLabel();
      stepBar.appendChild(revealBtn);
      stepBar.appendChild(resetBtn);
      mathBoard.insertBefore(stepBar, calcContainer);
    }
  }

  function bindTimelineToLessonDOM(steps) {
    Timeline.loadSteps(steps, {
      onStepChange: (idx, stepObj, total) => {
        // 1. Обновляем индикатор шага и точки
        const pillEl = document.getElementById('stepCounterPill');
        if (pillEl) {
          pillEl.textContent = `Шаг ${idx + 1} из ${total}`;
        }

        const dotsBox = document.getElementById('stepDotsContainer');
        if (dotsBox) {
          dotsBox.innerHTML = '';
          for (let i = 0; i < total; i++) {
            const d = document.createElement('button');
            d.type = 'button';
            d.className = `step-dot ${i === idx ? 'active' : i < idx ? 'done' : ''}`;
            d.title = `Перейти к шагу ${i + 1}`;
            d.addEventListener('click', () => {
              Speech.stop();
              Timeline.goToStep(i, true);
            });
            dotsBox.appendChild(d);
          }
        }

        // 2. Текст объяснения текущего шага
        const titleEl = document.getElementById('stepHeadingText');
        const bodyEl = document.getElementById('stepExplanationText');
        const formulaEl = document.getElementById('stepFormulaExpr');

        if (titleEl && stepObj.title) titleEl.textContent = stepObj.title;
        if (bodyEl && stepObj.text) bodyEl.innerHTML = stepObj.text;
        if (formulaEl && stepObj.formula) formulaEl.textContent = stepObj.formula;

        // 3. Последовательное появление строк вычислений (Анимация №4)
        const calcLines = document.querySelectorAll('#calcStepsContainer .calc-line');
        calcLines.forEach((lineEl, lineIdx) => {
          const revealAt = Number(lineEl.getAttribute('data-reveal-step') || 0);
          const focusAt = Number(lineEl.getAttribute('data-focus-step') || -1);
          lineEl.classList.toggle('visible', idx >= revealAt);
          lineEl.classList.toggle('active-focus', idx === focusAt);
        });

        syncDockWithTimeline(idx, stepObj, total);
      },
      onStatusChange: (st, idx, total) => {
        syncDockWithTimeline(idx, Timeline.getCurrentStep(), total);
      }
    });
  }

  /* ========================================================================
     УРОВЕНЬ 1. ВСПОМИНАЕМ ИЗУЧЕННОЕ (ПРЯМОУГОЛЬНИК И ТРЕУГОЛЬНИК)
     ======================================================================== */

  function renderLevel1(root) {
    const isRect = appState.level1Subtab === 'rect';
    currentHintText = isRect
      ? 'Покажите детям, что в одном ряду помещается 6 квадратных сантиметров, а всего таких рядов 4. Поэтому 6 умножаем на 4.'
      : 'Обратите внимание класса: диагональ делит прямоугольник 8 × 4 см на два равных треугольника. Значит, площадь одного треугольника равна половине площади прямоугольника: (8 × 4) : 2 = 16 см².';

    root.innerHTML = `
      <div class="board-layout">
        <!-- Левая колонка: Геометрический холст -->
        <div class="card-panel geometry-stage-card">
          <div class="stage-header">
            <span class="stage-badge">📐 Уровень 1 • Базовые фигуры</span>
            <div class="stage-subtabs">
              <button type="button" class="subtab-btn ${isRect ? 'active' : ''}" id="l1TabRect">
                1. Площадь прямоугольника (6 × 4)
              </button>
              <button type="button" class="subtab-btn ${!isRect ? 'active' : ''}" id="l1TabTri">
                2. Площадь треугольника (8 × 4)
              </button>
            </div>
          </div>

          <div class="svg-canvas-wrapper">
            <svg id="mainLessonSvg" class="geometry-svg" aria-label="Геометрический чертёж"></svg>
          </div>

          <div class="geometry-legend">
            <span class="legend-item"><span class="legend-swatch swatch-rect"></span> Прямоугольник</span>
            <span class="legend-item"><span class="legend-swatch swatch-tri"></span> Треугольник</span>
            <span class="legend-item"><span class="legend-swatch swatch-split"></span> Линия разделения</span>
            <span class="legend-item"><span class="legend-swatch swatch-height"></span> Высота (h ⊥ a)</span>
          </div>
        </div>

        <!-- Правая колонка: Пошаговое объяснение и вычисления -->
        <div class="card-panel explanation-panel">
          <div>
            <div class="step-indicator-row">
              <span class="step-pill" id="stepCounterPill">Шаг 1</span>
              <div class="step-dots" id="stepDotsContainer"></div>
            </div>

            <h2 class="lesson-title" id="stepHeadingText" style="margin-top:14px;"></h2>
            <div class="pedagogical-callout" id="stepExplanationText" style="margin-top:12px;"></div>
          </div>

          <div class="math-board">
            <div class="formula-banner">
              <span class="formula-label">Главная формула</span>
              <span class="formula-expression" id="stepFormulaExpr">${isRect ? 'S = a × b' : 'S = (a × h) : 2'}</span>
            </div>

            <div class="calc-steps-list" id="calcStepsContainer">
              ${
                isRect
                  ? `
                <div class="calc-line part-rect1" data-reveal-step="1" data-focus-step="1">
                  <span>1 ряд клеток (длина a):</span>
                  <span class="calc-math">6 клеток (6 см)</span>
                </div>
                <div class="calc-line part-rect1" data-reveal-step="2" data-focus-step="2">
                  <span>Количество рядов (ширина b):</span>
                  <span class="calc-math">4 ряда по 6 клеток</span>
                </div>
                <div class="calc-line total-answer" data-reveal-step="3" data-focus-step="3">
                  <span>Пошаговое решение:</span>
                  <span class="calc-math">S = 6 × 4 = 24 см²</span>
                </div>
              `
                  : `
                <div class="calc-line part-rect2" data-reveal-step="0" data-focus-step="0">
                  <span>Площадь всего прямоугольника:</span>
                  <span class="calc-math">Sпр = 8 × 4 = 32 см²</span>
                </div>
                <div class="calc-line part-tri1" data-reveal-step="2" data-focus-step="2">
                  <span>Треугольник — половина прямоугольника:</span>
                  <span class="calc-math">S = (a × h) : 2</span>
                </div>
                <div class="calc-line total-answer" data-reveal-step="3" data-focus-step="3">
                  <span>Ответ:</span>
                  <span class="calc-math">S = (8 × 4) : 2 = 16 см²</span>
                </div>
              `
              }
            </div>
          </div>

          <div class="action-row">
            <button type="button" class="btn btn-primary" id="inlinePlayAnimBtn">
              ▶ Показать анимацию
            </button>
            <button type="button" class="btn btn-secondary" id="inlineNextStepBtn">
              Следующий шаг →
            </button>
            ${
              isRect
                ? `<button type="button" class="btn btn-accent" id="goToTriSubtabBtn">К площади треугольника →</button>`
                : `<button type="button" class="btn btn-success" id="goToLevel2Btn">Перейти к Уровню 2 →</button>`
            }
          </div>
        </div>
      </div>

      <!-- Мини-проверка Уровня 1 (3 простых задания с автоматической проверкой) -->
      <section class="mini-check-section">
        <div class="mini-check-header">
          <div>
            <h3 style="font-size:var(--fs-md);font-weight:800;">✅ Мини-проверка Уровня 1: проверим себя!</h3>
            <p style="font-size:var(--fs-xs);color:var(--text-secondary);">
              Вычисли площади трёх простых фигур. Можно вводить ответ с клавиатуры или нажимать цифры на экранной панели доски.
            </p>
          </div>
        </div>

        <div class="mini-check-grid" id="level1MiniCheckGrid"></div>
        <div id="level1NumpadSlot"></div>
      </section>
    `;

    // Привязка переключения вкладок Прямоугольник / Треугольник
    document.getElementById('l1TabRect').onclick = () => {
      Speech.stop();
      appState.level1Subtab = 'rect';
      renderLevel1(root);
    };
    document.getElementById('l1TabTri').onclick = () => {
      Speech.stop();
      appState.level1Subtab = 'tri';
      renderLevel1(root);
    };

    const goToTriBtn = document.getElementById('goToTriSubtabBtn');
    if (goToTriBtn) {
      goToTriBtn.onclick = () => {
        Speech.stop();
        appState.level1Subtab = 'tri';
        renderLevel1(root);
      };
    }

    const goToL2Btn = document.getElementById('goToLevel2Btn');
    if (goToL2Btn) {
      goToL2Btn.onclick = () => {
        Nav.markLevelCompleted(1);
        Nav.setLevel(2);
      };
    }

    document.getElementById('inlinePlayAnimBtn').onclick = () => Timeline.play();
    document.getElementById('inlineNextStepBtn').onclick = () => Timeline.nextStep();

    // Инициализация SVG-сцены и шагов
    const svgEl = document.getElementById('mainLessonSvg');
    if (isRect) {
      activeSceneController = Geo.renderScene(svgEl, Geo.FIGURES.L1_RECT, {
        showHeightsImmediately: true
      });

      const rectSteps = [
        {
          title: 'Что такое площадь фигуры?',
          text: '<strong>Площадь показывает, сколько места занимает фигура на плоскости.</strong> Перед нами прямоугольник с длиной <strong>a = 6 см</strong> и шириной <strong>b = 4 см</strong>.',
          formula: 'S = a × b',
          speech: 'Площадь показывает, сколько места занимает фигура на плоскости. Перед нами прямоугольник с длиной 6 сантиметров и шириной 4 сантиметра.',
          durationMs: 2200,
          execute: () => {
            activeSceneController.resetToInitial();
            activeSceneController.colorParts('p1');
          }
        },
        {
          title: 'Шаг 1. Заполняем первый ряд квадратными клетками',
          text: 'Начнём заполнять прямоугольник квадратными клетками со стороной 1 см. В <strong>первый ряд</strong> вдоль длины помещается ровно <strong>6 клеток</strong>.',
          formula: '1 ряд = 6 клеток (1 см²)',
          speech: 'Заполним первый ряд квадратными клетками. В один ряд помещается ровно 6 клеток.',
          durationMs: 2200,
          execute: () => {
            activeSceneController.fillUnitRow(0);
          }
        },
        {
          title: 'Шаг 2. Заполняем остальные ряды',
          text: 'Таких рядов по 6 клеток по ширине помещается ровно <strong>4 ряда</strong>. Теперь видно, почему длину умножают на ширину!',
          formula: '4 ряда по 6 клеток = 6 × 4',
          speech: 'Постепенно заполняем второй, третий и четвёртый ряды. Всего получается 4 ряда по 6 клеток.',
          durationMs: 2400,
          execute: (instant) => {
            if (instant) {
              activeSceneController.fillAllUnitCells();
            } else {
              activeSceneController.fillUnitRow(1);
              setTimeout(() => activeSceneController.fillUnitRow(2), 320);
              setTimeout(() => activeSceneController.fillUnitRow(3), 640);
            }
          }
        },
        {
          title: 'Шаг 3. Вычисляем площадь по формуле S = a × b',
          text: 'Чтобы найти площадь прямоугольника, нужно <strong>длину умножить на ширину</strong>: <strong>6 × 4 = 24 клетки</strong>, то есть <strong>24 см²</strong>!',
          formula: 'S = 6 × 4 = 24 см²',
          speech: 'Чтобы найти площадь прямоугольника, нужно длину умножить на ширину. Шесть умножить на четыре равно двадцать четыре квадратных сантиметра.',
          durationMs: 2200,
          execute: () => {
            activeSceneController.fillAllUnitCells();
            activeSceneController.partControllers.p1.badgeEl.classList.add('visible');
          }
        }
      ];

      bindTimelineToLessonDOM(rectSteps);
      enhanceMathBoardWithConditionAndStepper(Geo.FIGURES.L1_RECT);
    } else {
      activeSceneController = Geo.renderScene(svgEl, Geo.FIGURES.L1_TRI, {
        showHeightsImmediately: false
      });

      const triSteps = [
        {
          title: 'Сначала построим прямоугольник 8 см × 4 см',
          text: 'Посмотрим на прямоугольник со сторонами <strong>8 см</strong> и <strong>4 см</strong>. Его площадь легко найти: <strong>8 × 4 = 32 см²</strong>.',
          formula: 'S прямоугольника = 8 × 4 = 32 см²',
          speech: 'Сначала посмотрим на прямоугольник со сторонами 8 сантиметров и 4 сантиметра. Его площадь равна 32 квадратным сантиметрам.',
          durationMs: 2200,
          execute: () => {
            activeSceneController.resetToInitial();
          }
        },
        {
          title: 'Проводим диагональ от вершины к вершине',
          text: 'Проведём линию (диагональ) из одной вершины прямоугольника к противоположной. Она делит прямоугольник на <strong>два равных треугольника</strong>!',
          formula: 'Прямоугольник = 2 равных треугольника',
          speech: 'Проведём диагональ из одной вершины к противоположной. Прямоугольник разделяется на два равных треугольника.',
          durationMs: 2200,
          execute: () => {
            activeSceneController.drawSplitLines(0);
            activeSceneController.colorParts();
          }
        },
        {
          title: 'Основание и высота треугольника',
          text: '<strong>Два одинаковых треугольника вместе образуют прямоугольник. Поэтому площадь одного треугольника в два раза меньше площади этого прямоугольника!</strong> Обрати внимание: высота <strong>h = 4 см</strong> перпендикулярна основанию <strong>a = 8 см</strong> (образует прямой угол).',
          formula: 'S = (a × h) : 2',
          speech: 'Два одинаковых треугольника вместе образуют прямоугольник. Поэтому площадь одного треугольника в два раза меньше площади этого прямоугольника. Чтобы найти площадь треугольника, нужно основание умножить на высоту и разделить на два.',
          durationMs: 2600,
          execute: () => {
            activeSceneController.separateParts(true);
            activeSceneController.highlightPart('p1');
          }
        },
        {
          title: 'Вычисляем площадь треугольника',
          text: 'Подставляем основание <strong>a = 8 см</strong> и высоту <strong>h = 4 см</strong> в формулу: <strong>S = (8 × 4) : 2 = 32 : 2 = 16 см²</strong>. Ответ: <strong>16 см²</strong>.',
          formula: 'S = (8 × 4) : 2 = 16 см²',
          speech: 'Вычисляем: восемь умножить на четыре и разделить на два равно шестнадцать квадратных сантиметров.',
          durationMs: 2200,
          execute: () => {
            activeSceneController.highlightPart('p1');
          }
        }
      ];

      bindTimelineToLessonDOM(triSteps);
      enhanceMathBoardWithConditionAndStepper(Geo.FIGURES.L1_TRI);
    }

    // Отрисовка 3 заданий мини-проверки Уровня 1 (строго по ТЗ: 5×3, 7×2, треугольник 6×4)
    const miniTasks = [
      {
        id: 'l1_m1',
        title: 'Задание 1. Прямоугольник 5 × 3 см',
        figure: Geo.makeRectFigure(5, 3),
        expected: 15,
        unit: 'см²',
        hint: 'Умножь длину 5 см на ширину 3 см: 5 × 3 = 15 см².'
      },
      {
        id: 'l1_m2',
        title: 'Задание 2. Прямоугольник 7 × 2 см',
        figure: Geo.makeRectFigure(7, 2),
        expected: 14,
        unit: 'см²',
        hint: 'Умножь длину 7 см на ширину 2 см: 7 × 2 = 14 см².'
      },
      {
        id: 'l1_m3',
        title: 'Задание 3. Треугольник (a = 6 см, h = 4 см)',
        figure: Geo.makeRightTriFigure(6, 4),
        expected: 12,
        wrongNoDiv2: 24,
        unit: 'см²',
        hint: 'Используй формулу S = (a × h) : 2 = (6 × 4) : 2 = 12 см².'
      }
    ];

    renderMiniCheckCards(
      document.getElementById('level1MiniCheckGrid'),
      document.getElementById('level1NumpadSlot'),
      miniTasks,
      1
    );
  }

  /**
   * Универсальная отрисовка карточек мини-проверки для Уровней 1, 2, 3
   */
  function renderMiniCheckCards(gridEl, numpadSlotEl, tasks, levelNumber) {
    if (!gridEl) return;
    gridEl.innerHTML = '';

    const checkFunctions = [];

    tasks.forEach((task) => {
      const card = document.createElement('div');
      card.className = 'mini-task-card';

      card.innerHTML = `
        <div style="font-weight:800;font-size:var(--fs-sm);color:var(--text-primary);">${task.title}</div>
        <div class="mini-task-svg-box">
          <svg class="geometry-svg" id="svg_${task.id}"></svg>
        </div>
        ${
          task.partsExpected
            ? `
          <div class="mini-input-group" style="font-size:var(--fs-xs);font-weight:700;">
            <span>S₁ =</span>
            <input type="text" inputmode="numeric" class="math-input" id="inp_s1_${task.id}" placeholder="?" style="width:70px;height:44px;" />
            <span>S₂ =</span>
            <input type="text" inputmode="numeric" class="math-input" id="inp_s2_${task.id}" placeholder="?" style="width:70px;height:44px;" />
          </div>
        `
            : ''
        }
        <div class="mini-input-group">
          <span style="font-weight:800;font-size:var(--fs-sm);">S =</span>
          <input type="text" inputmode="numeric" class="math-input" id="inp_total_${task.id}" placeholder="Ответ" />
          <span style="font-weight:800;font-size:var(--fs-sm);">см²</span>
          <button type="button" class="btn btn-primary" id="btn_chk_${task.id}" style="min-height:48px;padding:8px 16px;">
            Проверить
          </button>
        </div>
        <div id="fb_${task.id}"></div>
      `;

      gridEl.appendChild(card);

      // Рендерим мини-SVG
      const miniSvg = card.querySelector(`#svg_${task.id}`);
      const miniScene = Geo.renderScene(miniSvg, task.figure, {
        viewW: 420,
        viewH: 250,
        padding: 46,
        showGrid: false,
        showHeightsImmediately: true
      });
      miniScene.colorParts();
      if (task.figure.splitLines && task.figure.splitLines.length > 0) {
        miniScene.drawSplitLines();
      }

      const totalInp = card.querySelector(`#inp_total_${task.id}`);
      const s1Inp = card.querySelector(`#inp_s1_${task.id}`);
      const s2Inp = card.querySelector(`#inp_s2_${task.id}`);
      if (s1Inp) Nav.registerMathInput(s1Inp);
      if (s2Inp) Nav.registerMathInput(s2Inp);
      Nav.registerMathInput(totalInp);

      const doCheck = () => {
        const val = parseInt(totalInp.value.trim(), 10);
        const fbEl = card.querySelector(`#fb_${task.id}`);
        if (Number.isNaN(val)) {
          fbEl.innerHTML = `<div class="feedback-banner warning">Введи число в поле ответа.</div>`;
          return;
        }

        if (task.partsExpected && s1Inp && s2Inp) {
          const v1 = parseInt(s1Inp.value.trim(), 10);
          const v2 = parseInt(s2Inp.value.trim(), 10);
          if (v1 === task.partsExpected[0] && v2 === task.partsExpected[1] && val !== task.expected) {
            fbEl.innerHTML = `<div class="feedback-banner error">Ты правильно нашёл площади частей (${v1} и ${v2}), но проверь их сложение!</div>`;
            return;
          }
        }

        if (val === task.expected) {
          card.classList.add('solved');
          fbEl.innerHTML = `<div class="feedback-banner success">✓ Верно! S = ${task.expected} см².</div>`;
          Nav.markLevelCompleted(levelNumber);
        } else if (task.wrongNoDiv2 && val === task.wrongNoDiv2) {
          fbEl.innerHTML = `<div class="feedback-banner error">Не забудь разделить произведение основания и высоты на 2!</div>`;
        } else {
          fbEl.innerHTML = `<div class="feedback-banner error">Проверь вычисление. Подсказка: ${task.hint}</div>`;
        }
      };

      card.querySelector(`#btn_chk_${task.id}`).onclick = doCheck;
      totalInp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doCheck();
      });
      checkFunctions.push(doCheck);
    });

    if (numpadSlotEl) {
      numpadSlotEl.innerHTML = '';
      numpadSlotEl.appendChild(
        Nav.createBoardNumpad(() => {
          checkFunctions.forEach((fn) => fn());
        })
      );
    }
  }

  /* ========================================================================
     УРОВЕНЬ 2. ЗНАКОМИМСЯ СО СЛОЖНЫМИ ФИГУРАМИ (L-ОБРАЗНАЯ ФИГУРА 8×3 И 4×2)
     ======================================================================== */

  function renderLevel2(root) {
    currentHintText =
      'На этом этапе важно показать ученикам: сложная фигура — это просто соединённые вместе знакомые прямоугольники. Мы проводим линию разделения, находим S₁ = 8 × 3 = 24 см² и S₂ = 4 × 2 = 8 см², а затем складываем их: 24 + 8 = 32 см².';

    root.innerHTML = `
      <div class="board-layout">
        <!-- Левая колонка: Геометрический холст -->
        <div class="card-panel geometry-stage-card">
          <div class="stage-header">
            <span class="stage-badge">🧩 Уровень 2 • Сложение площадей частей</span>
            <div class="stage-subtabs">
              <button type="button" class="subtab-btn" id="l2IntroJoinBtn">
                🔗 Показать, как соединяются 2 прямоугольника
              </button>
              <button type="button" class="subtab-btn active" id="l2SplitAnimBtn">
                ✂ Пошаговое разделение (Шаги 1–10)
              </button>
            </div>
          </div>

          <div class="svg-canvas-wrapper">
            <svg id="mainLessonSvg" class="geometry-svg" aria-label="L-образная фигура из двух прямоугольников"></svg>
          </div>

          <div class="geometry-legend">
            <span class="legend-item"><span class="legend-swatch swatch-rect"></span> Прямоугольник 1 (8 × 3 см)</span>
            <span class="legend-item"><span class="legend-swatch swatch-rect2"></span> Прямоугольник 2 (4 × 2 см)</span>
            <span class="legend-item"><span class="legend-swatch swatch-split"></span> Линия разделения</span>
          </div>
        </div>

        <!-- Правая колонка: 10 шагов объяснения -->
        <div class="card-panel explanation-panel">
          <div>
            <div class="step-indicator-row">
              <span class="step-pill" id="stepCounterPill">Шаг 1 из 10</span>
              <div class="step-dots" id="stepDotsContainer"></div>
            </div>

            <h2 class="lesson-title" id="stepHeadingText" style="margin-top:14px;"></h2>
            <div class="pedagogical-callout" id="stepExplanationText" style="margin-top:12px;"></div>
          </div>

          <div class="math-board">
            <div class="formula-banner">
              <span class="formula-label">Правило сложной фигуры</span>
              <span class="formula-expression" id="stepFormulaExpr">S = S₁ + S₂</span>
            </div>

            <div class="calc-steps-list" id="calcStepsContainer">
              <div class="calc-line part-rect1" data-reveal-step="6" data-focus-step="6">
                <span>1) Первая часть (8 × 3 см):</span>
                <span class="calc-math">S₁ = 8 × 3 = 24 см²</span>
              </div>
              <div class="calc-line part-rect2" data-reveal-step="7" data-focus-step="7">
                <span>2) Вторая часть (4 × 2 см):</span>
                <span class="calc-math">S₂ = 4 × 2 = 8 см²</span>
              </div>
              <div class="calc-line total-answer" data-reveal-step="9" data-focus-step="9">
                <span>3) Складываем площади:</span>
                <span class="calc-math">S = 24 + 8 = 32 см²</span>
              </div>
            </div>
          </div>

          <div class="action-row">
            <button type="button" class="btn btn-accent" id="l2RunSplitBtn">
              ✂ Разделить фигуру (Анимация)
            </button>
            <button type="button" class="btn btn-secondary" id="l2NextStepBtn">
              Следующий шаг →
            </button>
            <button type="button" class="btn btn-success" id="goToLevel3Btn">
              Перейти к Уровню 3 →
            </button>
          </div>
        </div>
      </div>

      <!-- Мини-проверка Уровня 2 (3 похожие задачи) -->
      <section class="mini-check-section">
        <div class="mini-check-header">
          <div>
            <h3 style="font-size:var(--fs-md);font-weight:800;">✅ Мини-проверка Уровня 2: найди площади двух частей и сложи их!</h3>
            <p style="font-size:var(--fs-xs);color:var(--text-secondary);">
              Введи площади двух прямоугольников S₁ и S₂, а затем общую площадь S.
            </p>
          </div>
        </div>

        <div class="mini-check-grid" id="level2MiniCheckGrid"></div>
        <div id="level2NumpadSlot"></div>
      </section>
    `;

    const svgEl = document.getElementById('mainLessonSvg');
    activeSceneController = Geo.renderScene(svgEl, Geo.FIGURES.L2_MAIN, {
      onPartClick: (part) => {
        activeSceneController.highlightPart(part.id);
      }
    });

    // Точные 10 шагов анимации по Разделу 5 (Уровень 2)
    const l2Steps = [
      {
        title: 'Шаг 1. Исходная сложная L-образная фигура',
        text: '«Иногда фигура состоит из нескольких частей. Чтобы найти её площадь, можно найти площадь каждой части отдельно, а затем сложить результаты». Посмотри на эту L-образную фигуру.',
        formula: 'S = S₁ + S₂',
        speech: 'Иногда фигура состоит из нескольких частей. Чтобы найти её площадь, можно найти площадь каждой части отдельно, а затем сложить результаты.',
        durationMs: 2200,
        execute: () => {
          activeSceneController.resetToInitial();
        }
      },
      {
        title: 'Шаг 2. Проводим линию разделения',
        text: 'Из внутреннего уголка фигуры плавно проведём горизонтальную <strong>линию разделения</strong>.',
        formula: 'Разделяем контур на 2 части',
        speech: 'Проведём горизонтальную линию разделения.',
        durationMs: 1800,
        execute: () => {
          activeSceneController.showKeyVertices(true);
          activeSceneController.drawSplitLines(0);
        }
      },
      {
        title: 'Шаг 3. Выделяем первую часть',
        text: 'Верхняя часть подсвечивается голубым цветом. Это знакомый нам <strong>первый прямоугольник</strong>!',
        formula: 'Часть 1 — прямоугольник',
        speech: 'Верхняя часть подсвечивается отдельным цветом. Это первый прямоугольник.',
        durationMs: 1700,
        execute: () => {
          activeSceneController.colorParts('p1');
        }
      },
      {
        title: 'Шаг 4. Выделяем вторую часть',
        text: 'Нижняя часть подсвечивается сиренево-синим оттенком. Это <strong>второй прямоугольник</strong>.',
        formula: 'Часть 2 — прямоугольник',
        speech: 'Нижняя часть подсвечивается другим цветом. Это второй прямоугольник.',
        durationMs: 1700,
        execute: () => {
          activeSceneController.colorParts('p2');
        }
      },
      {
        title: 'Шаг 5. Части плавно отделяются друг от друга',
        text: 'Раздвинем части совсем немного: теперь отлично видно, что наша сложная фигура состоит из <strong>двух отдельных прямоугольников</strong>, которые не перекрывают друг друга.',
        formula: '2 отдельных прямоугольника',
        speech: 'Части плавно отделяются друг от друга, демонстрируя, что это два отдельных прямоугольника.',
        durationMs: 2000,
        execute: () => {
          activeSceneController.separateParts(false);
        }
      },
      {
        title: 'Шаг 6. Определяем размеры каждой части',
        text: 'У первого прямоугольника стороны равны <strong>8 см и 3 см</strong>. У второго прямоугольника стороны равны <strong>4 см и 2 см</strong>.',
        formula: 'a₁ = 8, b₁ = 3  |  a₂ = 4, b₂ = 2',
        speech: 'Возле каждой части появляются её размеры: 8 на 3 сантиметра и 4 на 2 сантиметра.',
        durationMs: 2000,
        execute: () => {
          activeSceneController.separateParts(true);
        }
      },
      {
        title: 'Шаг 7. Вычисляем площадь первой части (S₁)',
        text: 'Находим площадь первого прямоугольника: умножаем длину 8 см на ширину 3 см. Получаем <strong>S₁ = 8 × 3 = 24 см²</strong>.',
        formula: 'S₁ = 8 × 3 = 24 см²',
        speech: 'Рассчитываем площадь первой части: восемь умножить на три равно двадцать четыре квадратных сантиметра.',
        durationMs: 2200,
        execute: () => {
          activeSceneController.highlightPart('p1');
        }
      },
      {
        title: 'Шаг 8. Вычисляем площадь второй части (S₂)',
        text: 'Находим площадь второго прямоугольника: умножаем 4 см на 2 см. Получаем <strong>S₂ = 4 × 2 = 8 см²</strong>.',
        formula: 'S₂ = 4 × 2 = 8 см²',
        speech: 'Рассчитываем площадь второй части: четыре умножить на два равно восемь квадратных сантиметров.',
        durationMs: 2200,
        execute: () => {
          activeSceneController.highlightPart('p2');
        }
      },
      {
        title: 'Шаг 9. Собираем фигуру обратно',
        text: 'Обе части плавно возвращаются на исходное место и снова образуют единую L-образную фигуру.',
        formula: 'Объединяем части вместе',
        speech: 'Части визуально возвращаются на исходное место.',
        durationMs: 1800,
        execute: () => {
          activeSceneController.reassembleParts(true);
        }
      },
      {
        title: 'Шаг 10. Складываем площади и получаем ответ!',
        text: 'Складываем площади двух частей: <strong>S = 24 + 8 = 32 см²</strong>. Ответ: <strong>32 см²</strong>!',
        formula: 'S = 24 + 8 = 32 см²',
        speech: 'Складываем площади двух частей: двадцать четыре плюс восемь равно тридцать два квадратных сантиметра.',
        durationMs: 2200,
        execute: () => {
          activeSceneController.reassembleParts(true);
          activeSceneController.showKeyVertices(false);
        }
      }
    ];

    bindTimelineToLessonDOM(l2Steps);
    enhanceMathBoardWithConditionAndStepper(Geo.FIGURES.L2_MAIN);

    // Кнопка «Показать, как соединяются 2 прямоугольника» (вводная анимация Уровня 2)
    document.getElementById('l2IntroJoinBtn').onclick = () => {
      Speech.stop();
      Timeline.pause();
      activeSceneController.colorParts();
      activeSceneController.separateParts(true);
      const heading = document.getElementById('stepHeadingText');
      const body = document.getElementById('stepExplanationText');
      if (heading) heading.textContent = 'Смотри: два отдельных прямоугольника соединяются в одну фигуру!';
      if (body) {
        body.innerHTML =
          'Сначала перед нами два простых прямоугольника: <strong>8 × 3 см</strong> и <strong>4 × 2 см</strong>. Сейчас они плавно соединятся по общей стороне в одну сложную фигуру!';
      }
      Speech.speak('Два отдельных прямоугольника плавно соединяются и образуют одну сложную фигуру.');
      setTimeout(() => {
        activeSceneController.reassembleParts(true);
      }, 950);
    };

    document.getElementById('l2SplitAnimBtn').onclick = () => {
      Timeline.play();
    };
    document.getElementById('l2RunSplitBtn').onclick = () => {
      Timeline.play();
    };
    document.getElementById('l2NextStepBtn').onclick = () => {
      Timeline.nextStep();
    };
    document.getElementById('goToLevel3Btn').onclick = () => {
      Nav.markLevelCompleted(2);
      Nav.setLevel(3);
    };

    // 3 задачи мини-проверки Уровня 2
    const l2MiniTasks = [
      {
        id: 'l2_m1',
        title: 'Задача 1. Прямоугольники 5 × 3 см и 3 × 2 см',
        figure: Geo.makeLShapeFigure(5, 3, 3, 2),
        partsExpected: [15, 6],
        expected: 21,
        hint: 'S₁ = 5 × 3 = 15 см², S₂ = 3 × 2 = 6 см². Сумма: 15 + 6 = 21 см².'
      },
      {
        id: 'l2_m2',
        title: 'Задача 2. Прямоугольники 6 × 3 см и 4 × 2 см',
        figure: Geo.makeLShapeFigure(6, 3, 4, 2),
        partsExpected: [18, 8],
        expected: 26,
        hint: 'S₁ = 6 × 3 = 18 см², S₂ = 4 × 2 = 8 см². Сумма: 18 + 8 = 26 см².'
      },
      {
        id: 'l2_m3',
        title: 'Задача 3. Прямоугольники 7 × 2 см и 3 × 3 см',
        figure: Geo.makeLShapeFigure(7, 2, 3, 3),
        partsExpected: [14, 9],
        expected: 23,
        hint: 'S₁ = 7 × 2 = 14 см², S₂ = 3 × 3 = 9 см². Сумма: 14 + 9 = 23 см².'
      }
    ];

    renderMiniCheckCards(
      document.getElementById('level2MiniCheckGrid'),
      document.getElementById('level2NumpadSlot'),
      l2MiniTasks,
      2
    );
  }

  /* ========================================================================
     УРОВЕНЬ 3. ФИГУРА ИЗ ПРЯМОУГОЛЬНИКА И ТРЕУГОЛЬНИКА
     Прямоугольник 6 × 4 = 24 см², Треугольник a = 4, h = 6 -> 12 см², S = 36 см²
     ======================================================================== */

  function renderLevel3(root) {
    currentHintText =
      'Попросите ученика подойти к электронной доске и нажать пальцем сначала на прямоугольник, а затем на треугольник. При нажатии на треугольник подсвечиваются его основание (4 см), высота (6 см), прямой угол и формула S = (a × h) : 2.';

    root.innerHTML = `
      <div class="board-layout">
        <!-- Левая колонка: Интерактивный чертёж -->
        <div class="card-panel geometry-stage-card">
          <div class="stage-header">
            <span class="stage-badge">📐 Уровень 3 • Прямоугольник + Треугольник</span>
            <button type="button" class="btn btn-accent" id="showHowWeSplitBtn" style="min-height:46px;padding:8px 18px;">
              ✨ Показать, как мы разделили фигуру
            </button>
          </div>

          <div class="svg-canvas-wrapper">
            <svg id="mainLessonSvg" class="geometry-svg" aria-label="Фигура из прямоугольника и треугольника"></svg>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-top:12px;">
            <div class="geometry-legend" style="margin-top:0;flex:1;">
              <span class="legend-item"><span class="legend-swatch swatch-rect"></span> Прямоугольник (6 × 4 см)</span>
              <span class="legend-item"><span class="legend-swatch swatch-tri"></span> Треугольник (a = 4 см, h = 6 см)</span>
              <span class="legend-item">👆 <strong>Нажми на любую часть фигуры на экране!</strong></span>
            </div>
          </div>
        </div>

        <!-- Правая колонка: Пошаговое объяснение -->
        <div class="card-panel explanation-panel">
          <div>
            <div class="step-indicator-row">
              <span class="step-pill" id="stepCounterPill">Шаг 1 из 5</span>
              <div class="step-dots" id="stepDotsContainer"></div>
            </div>

            <h2 class="lesson-title" id="stepHeadingText" style="margin-top:14px;"></h2>
            <div class="pedagogical-callout" id="stepExplanationText" style="margin-top:12px;"></div>
          </div>

          <div class="math-board">
            <div class="formula-banner">
              <span class="formula-label" id="l3ActiveFormulaLabel">Формула текущего шага</span>
              <span class="formula-expression" id="stepFormulaExpr">S = S₁ + S₂</span>
            </div>

            <div class="calc-steps-list" id="calcStepsContainer">
              <div class="calc-line part-rect1" id="l3CalcRect" data-reveal-step="2" data-focus-step="2">
                <span>Прямоугольник (6 × 4 см):</span>
                <span class="calc-math">S₁ = 6 × 4 = 24 см²</span>
              </div>
              <div class="calc-line part-tri1" id="l3CalcTri" data-reveal-step="3" data-focus-step="3">
                <span>Треугольник (a = 4 см, h = 6 см):</span>
                <span class="calc-math">S₂ = (4 × 6) : 2 = 12 см²</span>
              </div>
              <div class="calc-line total-answer" id="l3CalcTotal" data-reveal-step="4" data-focus-step="4">
                <span>Общая площадь фигуры:</span>
                <span class="calc-math">S = 24 + 12 = 36 см²</span>
              </div>
            </div>
          </div>

          <div class="action-row">
            <button type="button" class="btn btn-primary" id="l3HighlightRectBtn">
              🟦 Выделить прямоугольник
            </button>
            <button type="button" class="btn btn-secondary" id="l3HighlightTriBtn">
              🟩 Выделить треугольник
            </button>
            <button type="button" class="btn btn-success" id="goToLevel4Btn">
              Перейти к Уровню 4 →
            </button>
          </div>
        </div>
      </div>

      <!-- Мини-проверка Уровня 3 -->
      <section class="mini-check-section">
        <div class="mini-check-header">
          <div>
            <h3 style="font-size:var(--fs-md);font-weight:800;">✅ Мини-проверка Уровня 3: прямоугольник + треугольник</h3>
            <p style="font-size:var(--fs-xs);color:var(--text-secondary);">
              Вычисли площадь прямоугольника S₁, площадь треугольника S₂ и сложи их!
            </p>
          </div>
        </div>
        <div class="mini-check-grid" id="level3MiniCheckGrid"></div>
        <div id="level3NumpadSlot"></div>
      </section>
    `;

    const svgEl = document.getElementById('mainLessonSvg');

    // Интерактивный обработчик клика по частям фигуры на Уровне 3
    function handleL3PartClick(part) {
      Timeline.pause();
      activeSceneController.drawSplitLines(0);
      activeSceneController.separateParts(true);
      activeSceneController.highlightPart(part.id);

      const titleEl = document.getElementById('stepHeadingText');
      const bodyEl = document.getElementById('stepExplanationText');
      const formLabel = document.getElementById('l3ActiveFormulaLabel');
      const formExpr = document.getElementById('stepFormulaExpr');

      if (part.id === 'p1') {
        if (titleEl) titleEl.textContent = 'Выбран прямоугольник (6 см × 4 см)';
        if (bodyEl) {
          bodyEl.innerHTML =
            'Левая часть фигуры — это <strong>прямоугольник</strong> с длиной <strong>6 см</strong> и шириной <strong>4 см</strong>. Чтобы найти его площадь, умножаем длину на ширину: <strong>S₁ = 6 × 4 = 24 см²</strong>.';
        }
        if (formLabel) formLabel.textContent = 'Формула площади прямоугольника';
        if (formExpr) formExpr.textContent = 'S₁ = a × b = 6 × 4 = 24 см²';
        document.getElementById('l3CalcRect').classList.add('visible', 'active-focus');
        document.getElementById('l3CalcTri').classList.remove('active-focus');
        Speech.speak('Выделен прямоугольник со сторонами 6 и 4 сантиметра. Его площадь равна 24 квадратным сантиметрам.');
      } else {
        if (titleEl) titleEl.textContent = 'Выбран треугольник (основание 4 см, высота 6 см)';
        if (bodyEl) {
          bodyEl.innerHTML =
            'Правая часть — это <strong>прямоугольный треугольник</strong>. Его основание равно <strong>4 см</strong>, а перпендикулярная высота равна <strong>6 см</strong> (отмечен прямой угол). По формуле треугольника: <strong>S₂ = (4 × 6) : 2 = 12 см²</strong>.';
        }
        if (formLabel) formLabel.textContent = 'Формула площади треугольника';
        if (formExpr) formExpr.textContent = 'S₂ = (a × h) : 2 = (4 × 6) : 2 = 12 см²';
        document.getElementById('l3CalcTri').classList.add('visible', 'active-focus');
        document.getElementById('l3CalcRect').classList.remove('active-focus');
        Speech.speak('Выделен треугольник с основанием 4 сантиметра и высотой 6 сантиметров. По формуле основание умножаем на высоту и делим на два: получается 12 квадратных сантиметров.');
      }
    }

    activeSceneController = Geo.renderScene(svgEl, Geo.FIGURES.L3_MAIN, {
      onPartClick: handleL3PartClick
    });

    const l3Steps = [
      {
        title: 'Шаг 1. Знакомимся с новой составной фигурой',
        text: '«Теперь наша задача немного усложняется. Но принцип остаётся таким же. Мы разделяем фигуру на знакомые части и находим площадь каждой». Посмотри на фигуру с наклонной правой стороной.',
        formula: 'S = S₁ + S₂',
        speech: 'Теперь наша задача немного усложняется. Но принцип остаётся таким же. Мы разделяем фигуру на знакомые части и находим площадь каждой.',
        durationMs: 2200,
        execute: () => {
          activeSceneController.resetToInitial();
        }
      },
      {
        title: 'Шаг 2. Проводим линию разделения',
        text: 'Проведём вертикальную линию разделения сверху вниз. Она делит нашу сложную фигуру на <strong>прямоугольник</strong> слева и <strong>треугольник</strong> справа!',
        formula: 'Прямоугольник + Треугольник',
        speech: 'Проведём вертикальную линию разделения. Фигура разделилась на прямоугольник и треугольник.',
        durationMs: 2000,
        execute: () => {
          activeSceneController.showKeyVertices(true);
          activeSceneController.drawSplitLines(0);
          activeSceneController.colorParts();
          activeSceneController.separateParts(true);
        }
      },
      {
        title: 'Шаг 3. Находим площадь прямоугольника (S₁)',
        text: 'Подсветим прямоугольник. Его длина равна <strong>6 см</strong>, а ширина — <strong>4 см</strong>. Вычисляем площадь: <strong>S₁ = 6 × 4 = 24 см²</strong>.',
        formula: 'S₁ = a × b = 6 × 4 = 24 см²',
        speech: 'Подсветим прямоугольник. Его длина 6 сантиметров, ширина 4 сантиметра. Площадь первой части равна 24 квадратным сантиметрам.',
        durationMs: 2300,
        execute: () => {
          activeSceneController.separateParts(true);
          activeSceneController.highlightPart('p1');
        }
      },
      {
        title: 'Шаг 4. Находим площадь треугольника (S₂)',
        text: 'Подсветим треугольник. Его основание равно <strong>4 см</strong>, а высота (перпендикулярная основанию под прямым углом) равна <strong>6 см</strong>. Вычисляем: <strong>S₂ = (4 × 6) : 2 = 12 см²</strong>.',
        formula: 'S₂ = (a × h) : 2 = (4 × 6) : 2 = 12 см²',
        speech: 'Подсветим треугольник. Его основание 4 сантиметра, а высота 6 сантиметров. Четыре умножить на шесть и разделить на два равно двенадцать квадратных сантиметров.',
        durationMs: 2500,
        execute: () => {
          activeSceneController.separateParts(true);
          activeSceneController.highlightPart('p2');
        }
      },
      {
        title: 'Шаг 5. Объединяем результаты',
        text: 'Собираем части обратно и складываем их площади: <strong>S = 24 + 12 = 36 см²</strong>. Ответ: <strong>36 см²</strong>!',
        formula: 'S = 24 + 12 = 36 см²',
        speech: 'Объединяем результаты: двадцать четыре плюс двенадцать равно тридцать шесть квадратных сантиметров.',
        durationMs: 2200,
        execute: () => {
          activeSceneController.reassembleParts(true);
          activeSceneController.showKeyVertices(false);
        }
      }
    ];

    bindTimelineToLessonDOM(l3Steps);
    enhanceMathBoardWithConditionAndStepper(Geo.FIGURES.L3_MAIN);

    document.getElementById('showHowWeSplitBtn').onclick = () => {
      Speech.stop();
      Timeline.repeat();
    };
    document.getElementById('l3HighlightRectBtn').onclick = () => {
      handleL3PartClick(Geo.FIGURES.L3_MAIN.parts[0]);
    };
    document.getElementById('l3HighlightTriBtn').onclick = () => {
      handleL3PartClick(Geo.FIGURES.L3_MAIN.parts[1]);
    };
    document.getElementById('goToLevel4Btn').onclick = () => {
      Nav.markLevelCompleted(3);
      Nav.setLevel(4);
    };

    // Мини-проверка Уровня 3 (3 задачи)
    const l3MiniTasks = [
      {
        id: 'l3_m1',
        title: 'Задача 1. Прямоугольник 5 × 4 см и треугольник (a = 2 см, h = 4 см)',
        figure: Geo.makeRectPlusTriRight(5, 4, 2),
        partsExpected: [20, 4],
        expected: 24,
        wrongNoDiv2: 28,
        hint: 'S₁ = 5 × 4 = 20 см², S₂ = (2 × 4) : 2 = 4 см². Сумма: 20 + 4 = 24 см².'
      },
      {
        id: 'l3_m2',
        title: 'Задача 2. Домик: стены 6 × 3 см и крыша (a = 6 см, h = 2 см)',
        figure: Geo.makeHouseFigure(6, 3, 2),
        partsExpected: [18, 6],
        expected: 24,
        wrongNoDiv2: 30,
        hint: 'S₁ = 6 × 3 = 18 см², S₂ = (6 × 2) : 2 = 6 см². Сумма: 18 + 6 = 24 см².'
      },
      {
        id: 'l3_m3',
        title: 'Задача 3. Прямоугольник 4 × 4 см и треугольник (a = 4 см, h = 4 см)',
        figure: Geo.makeRectPlusTriRight(4, 4, 4),
        partsExpected: [16, 8],
        expected: 24,
        wrongNoDiv2: 32,
        hint: 'S₁ = 4 × 4 = 16 см², S₂ = (4 × 4) : 2 = 8 см². Сумма: 16 + 8 = 24 см².'
      }
    ];

    renderMiniCheckCards(
      document.getElementById('level3MiniCheckGrid'),
      document.getElementById('level3NumpadSlot'),
      l3MiniTasks,
      3
    );
  }

  /* ========================================================================
     УРОВЕНЬ 4. ФИГУРЫ ИЗ ТРЁХ И БОЛЕЕ ЧАСТЕЙ (С ВОПРОСОМ ВЫБОРА И 11 ШАГАМИ)
     ======================================================================== */

  const LEVEL4_EXAMPLES = [
    {
      key: 'L4_EX1',
      tabTitle: '1. Два пр-ка и треугольник (42 см²)',
      figure: Geo.FIGURES.L4_EX1,
      question: 'На какие знакомые фигуры можно разделить эту фигуру?',
      options: [
        {
          text: 'На два прямоугольника (6 × 4 см и 3 × 4 см) и один треугольник (основание 4 см, высота 3 см)',
          correct: true
        },
        {
          text: 'На три одинаковых прямоугольника по 6 × 4 см',
          correct: false,
          explanation: 'Посмотри на правую часть фигуры: у неё наклонная сторона, значит это прямоугольный треугольник, а не прямоугольник.'
        },
        {
          text: 'На один прямоугольник и три треугольника',
          correct: false,
          explanation: 'Слева вверху и слева внизу все углы прямые — это два прямоугольника (3 × 4 см и 6 × 4 см), а справа — один треугольник.'
        }
      ],
      totalArea: 42,
      sumFormula: 'S = 24 + 12 + 6 = 42 см²'
    },
    {
      key: 'L4_EX2',
      tabTitle: '2. Прямоугольник и 2 треугольника (36 см²)',
      figure: Geo.FIGURES.L4_EX2,
      question: 'На какие знакомые фигуры можно разделить эту симметричную фигуру?',
      options: [
        {
          text: 'На один центральный прямоугольник (6 × 4 см) и два боковых прямоугольных треугольника (по 3 × 4 см)',
          correct: true
        },
        {
          text: 'На три прямоугольника',
          correct: false,
          explanation: 'Слева и справа стороны наклонные — если провести вертикальные линии, по бокам получатся два прямоугольных треугольника.'
        },
        {
          text: 'На два больших квадрата',
          correct: false,
          explanation: 'Из-за наклонных боковых сторон фигура делится на прямоугольник посередине и два треугольника по краям.'
        }
      ],
      totalArea: 36,
      sumFormula: 'S = 24 + 6 + 6 = 36 см²'
    },
    {
      key: 'L4_EX3',
      tabTitle: '3. Три прямоугольника (35 см²)',
      figure: Geo.FIGURES.L4_EX3,
      question: 'На какие простые фигуры делится этот ступенчатый пьедестал?',
      options: [
        {
          text: 'На три прямоугольника: левый (3 × 3 см), центральный (4 × 5 см) и правый (3 × 2 см)',
          correct: true
        },
        {
          text: 'На два треугольника и один прямоугольник',
          correct: false,
          explanation: 'У этой ступенчатой фигуры все стороны горизонтальные и вертикальные (все углы прямые), поэтому треугольников здесь нет.'
        },
        {
          text: 'На один прямоугольник 10 × 5 см',
          correct: false,
          explanation: 'Верхние ступени ниже центральной части, поэтому фигуру нужно разделить вертикальными линиями на три разных прямоугольника.'
        }
      ],
      totalArea: 35,
      sumFormula: 'S = 9 + 20 + 6 = 35 см²'
    },
    {
      key: 'L4_EX4',
      tabTitle: '4. Два пр-ка и 2 треугольника (32 см²)',
      figure: Geo.FIGURES.L4_EX4,
      question: 'Из каких четырёх знакомых фигур состоит этот кораблик?',
      options: [
        {
          text: 'Из двух прямоугольников (6 × 3 см и 4 × 2 см) и двух треугольников по краям (по 2 × 3 см)',
          correct: true
        },
        {
          text: 'Из четырёх прямоугольников',
          correct: false,
          explanation: 'Нос и корма кораблика имеют наклонные борта — это два прямоугольных треугольника.'
        },
        {
          text: 'Из четырёх треугольников',
          correct: false,
          explanation: 'Центральная палуба (6 × 3 см) и верхняя рубка (4 × 2 см) имеют прямые углы — это два прямоугольника.'
        }
      ],
      totalArea: 32,
      sumFormula: 'S = 18 + 8 + 3 + 3 = 32 см²'
    }
  ];

  function renderLevel4(root) {
    const exIdx = appState.level4ExampleIdx;
    const ex = LEVEL4_EXAMPLES[exIdx];
    const isUnlocked = !!appState.level4QuizPassed[exIdx];

    currentHintText =
      'На Уровне 4 мы сначала не показываем готовые линии разделения! Пусть ученики сами посмотрят на фигуру и выберут один из трёх вариантов разбиения. После правильного ответа запустится 11-шаговая визуализация.';

    root.innerHTML = `
      <div class="board-layout">
        <!-- Левая колонка: Геометрическая сцена -->
        <div class="card-panel geometry-stage-card">
          <div class="stage-header">
            <span class="stage-badge">🏛 Уровень 4 • Фигуры из 3 и более частей</span>
            <div class="stage-subtabs">
              ${LEVEL4_EXAMPLES.map(
                (item, i) => `
                <button type="button" class="subtab-btn ${i === exIdx ? 'active' : ''}" data-l4-idx="${i}">
                  ${item.tabTitle}
                </button>
              `
              ).join('')}
            </div>
          </div>

          <div class="svg-canvas-wrapper">
            <svg id="mainLessonSvg" class="geometry-svg" aria-label="${ex.figure.title}"></svg>
          </div>

          <div class="geometry-legend">
            <span class="legend-item"><span class="legend-swatch swatch-rect"></span> Прямоугольник 1</span>
            <span class="legend-item"><span class="legend-swatch swatch-rect2"></span> Прямоугольник 2</span>
            <span class="legend-item"><span class="legend-swatch swatch-tri"></span> Треугольники</span>
            <span class="legend-item"><span class="legend-swatch swatch-split"></span> Линии разделения</span>
          </div>
        </div>

        <!-- Правая колонка: Сначала вопрос ученику, затем 11-шаговая визуализация -->
        <div class="card-panel explanation-panel">
          ${
            !isUnlocked
              ? `
            <div>
              <span class="step-pill">Вопрос классу перед разделением</span>
              <h2 class="lesson-title" style="margin-top:14px;">${ex.question}</h2>
              <div class="pedagogical-callout" style="margin-top:12px;">
                Посмотри внимательно на контур и размеры фигуры. Не спеши — сначала определи, какие знакомые фигуры спрятаны внутри!
              </div>

              <div class="options-list" id="l4OptionsBox" style="margin-top:18px;">
                ${ex.options
                  .map(
                    (opt, oIdx) => `
                  <button type="button" class="option-choice-btn" data-opt-idx="${oIdx}">
                    <span class="level-num-badge" style="background:var(--bg-subtle);">${oIdx + 1}</span>
                    <span>${opt.text}</span>
                  </button>
                `
                  )
                  .join('')}
              </div>

              <div id="l4QuestionFeedback" style="margin-top:14px;"></div>
            </div>

            <div class="action-row" style="margin-top:16px;">
              <button type="button" class="btn btn-secondary" id="l4SkipToAnimBtn">
                Показать правильное разбиение сразу →
              </button>
            </div>
          `
              : `
            <div>
              <div class="step-indicator-row">
                <span class="step-pill" id="stepCounterPill">Шаг 1 из 11</span>
                <div class="step-dots" id="stepDotsContainer"></div>
              </div>

              <h2 class="lesson-title" id="stepHeadingText" style="margin-top:14px;"></h2>
              <div class="pedagogical-callout" id="stepExplanationText" style="margin-top:12px;"></div>
            </div>

            <div class="math-board">
              <div class="formula-banner">
                <span class="formula-label">Сложение всех частей</span>
                <span class="formula-expression" id="stepFormulaExpr">S = S₁ + S₂ + S₃</span>
              </div>

              <div class="calc-steps-list" id="calcStepsContainer">
                ${ex.figure.parts
                  .map(
                    (p, pIdx) => `
                  <div class="calc-line part-${p.type}" data-reveal-step="${7 + (pIdx > 1 ? 1 : 0)}" data-focus-step="${7 + (pIdx > 1 ? 1 : 0)}">
                    <span>${p.name}:</span>
                    <span class="calc-math">${p.calcText}</span>
                  </div>
                `
                  )
                  .join('')}
                <div class="calc-line total-answer" data-reveal-step="10" data-focus-step="10">
                  <span>Итоговая площадь:</span>
                  <span class="calc-math">${ex.sumFormula}</span>
                </div>
              </div>
            </div>

            <div class="action-row">
              <button type="button" class="btn btn-accent" id="l4Replay11StepsBtn">
                ▶ Запустить 11 шагов анимации
              </button>
              <button type="button" class="btn btn-secondary" id="l4NextStepInlineBtn">
                Следующий шаг →
              </button>
              <button type="button" class="btn btn-success" id="goToLevel5Btn">
                Перейти к Уровню 5 →
              </button>
            </div>
          `
          }
        </div>
      </div>
    `;

    // Переключение между 4 примерами Уровня 4
    root.querySelectorAll('[data-l4-idx]').forEach((btn) => {
      btn.onclick = () => {
        Speech.stop();
        appState.level4ExampleIdx = Number(btn.getAttribute('data-l4-idx'));
        renderLevel4(root);
      };
    });

    const svgEl = document.getElementById('mainLessonSvg');
    activeSceneController = Geo.renderScene(svgEl, ex.figure, {
      onPartClick: (part) => {
        if (appState.level4QuizPassed[exIdx]) {
          activeSceneController.highlightPart(part.id);
        }
      }
    });

    if (!isUnlocked) {
      activeSceneController.resetToInitial();
      Speech.setStepText(ex.question);

      root.querySelectorAll('[data-opt-idx]').forEach((optBtn) => {
        optBtn.onclick = () => {
          const idx = Number(optBtn.getAttribute('data-opt-idx'));
          const chosen = ex.options[idx];
          const fbBox = document.getElementById('l4QuestionFeedback');

          if (chosen.correct) {
            optBtn.classList.add('correct');
            fbBox.innerHTML = `<div class="feedback-banner success">✓ Правильно! Сейчас мы увидим пошаговое разделение этой фигуры.</div>`;
            Speech.speak('Правильно! Запускаем пошаговую визуализацию разделения фигуры.');
            setTimeout(() => {
              appState.level4QuizPassed[exIdx] = true;
              if (Nav.getCurrentSection() === 'lesson' && Nav.getCurrentLevel() === 4) {
                renderLevel4(root);
                Timeline.play();
              }
            }, 900);
          } else {
            optBtn.classList.add('wrong');
            fbBox.innerHTML = `<div class="feedback-banner error">${chosen.explanation}</div>`;
            Speech.speak(chosen.explanation);
          }
        };
      });

      const skipBtn = document.getElementById('l4SkipToAnimBtn');
      if (skipBtn) {
        skipBtn.onclick = () => {
          appState.level4QuizPassed[exIdx] = true;
          renderLevel4(root);
          Timeline.play();
        };
      }
      return;
    }

    // 11 шагов пошаговой визуализации по Разделу 5 (Уровень 4)
    const parts = ex.figure.parts;
    const steps11 = [
      {
        title: '1. Исходная сложная фигура на экране',
        text: 'Перед нами целая сложная фигура. Все её внешние размеры известны.',
        formula: 'S = ?',
        speech: 'Перед нами исходная сложная фигура на экране.',
        durationMs: 1600,
        execute: () => activeSceneController.resetToInitial()
      },
      {
        title: '2. Важные вершины слегка выделяются',
        text: 'Обрати внимание на подсвеченные вершины: именно из этих уголков мы проведём линии разделения.',
        formula: 'Находим ключевые вершины',
        speech: 'Важные вершины фигуры выделяются.',
        durationMs: 1600,
        execute: () => activeSceneController.showKeyVertices(true)
      },
      {
        title: '3. Намечаем первую линию разделения',
        text: 'Первая линия разделения плавно проводится от начальной точки до конечной.',
        formula: 'Линия разделения №1',
        speech: 'Первая линия будущего разделения прорисовывается от начальной точки до конечной.',
        durationMs: 1700,
        execute: () => activeSceneController.drawSplitLines(0)
      },
      {
        title: '4. Проводим остальные линии разделения',
        text: 'Проводим следующую линию разделения, чтобы каждая часть стала простым прямоугольником или треугольником.',
        formula: 'Все линии проведены',
        speech: 'Каждая линия разделения полностью прорисована.',
        durationMs: 1700,
        execute: () => activeSceneController.drawSplitLines(null)
      },
      {
        title: '5. Отдельные части получают свои цвета',
        text: 'Каждая образовавшаяся простая фигура окрашивается в свой цвет: прямоугольники и треугольники сразу легко различить!',
        formula: 'Цветовое выделение частей',
        speech: 'Отдельные части получают свои цвета.',
        durationMs: 1700,
        execute: () => activeSceneController.colorParts(null)
      },
      {
        title: '6. Части немного отделяются друг от друга',
        text: 'Части плавно раздвигаются: мы наглядно видим все простые фигуры, из которых состоял сложный контур.',
        formula: `Фигура разделена на ${parts.length} части`,
        speech: 'Части немного отделяются друг от друга.',
        durationMs: 1900,
        execute: () => activeSceneController.separateParts(false)
      },
      {
        title: '7. Около каждой части появляются размеры',
        text: 'Возле каждой части подписываются её размеры (длина и ширина для прямоугольников, основание и высота для треугольников).',
        formula: 'Проверяем размеры частей',
        speech: 'Около каждой части появляются её размеры.',
        durationMs: 1900,
        execute: () => activeSceneController.separateParts(true)
      },
      {
        title: '8. Вычисляем площади первых частей',
        text: `Находим площади первых частей по формулам: <strong>${parts[0].calcText}</strong> и <strong>${parts[1].calcText}</strong>.`,
        formula: `${parts[0].calcText}`,
        speech: `Вычисляем площадь первой и второй части: ${parts[0].calcText}, ${parts[1].calcText}.`,
        durationMs: 2200,
        execute: () => activeSceneController.highlightPart(parts[0].id)
      },
      {
        title: '9. Вычисляем оставшиеся части и готовим сложение',
        text: `Вычисляем площадь следующей части: <strong>${parts[parts.length - 1].calcText}</strong>. Теперь все части посчитаны!`,
        formula: `${parts[parts.length - 1].calcText}`,
        speech: `Вычисляем площадь следующей части: ${parts[parts.length - 1].calcText}.`,
        durationMs: 2200,
        execute: () => activeSceneController.highlightPart(parts[parts.length - 1].id)
      },
      {
        title: '10. Части собираются обратно в исходную фигуру',
        text: 'Все простые части плавно возвращаются на свои места, образуя исходную фигуру.',
        formula: 'Сборка исходной фигуры',
        speech: 'Части собираются обратно в исходную фигуру.',
        durationMs: 1800,
        execute: () => {
          activeSceneController.reassembleParts(true);
          activeSceneController.showKeyVertices(false);
        }
      },
      {
        title: '11. Складываем результаты и получаем общий ответ!',
        text: `Складываем площади всех частей: <strong>${ex.sumFormula}</strong>. Ответ: <strong>${ex.totalArea} см²</strong>!`,
        formula: ex.sumFormula,
        speech: `Появляется общий ответ: ${ex.sumFormula}.`,
        durationMs: 2200,
        execute: () => {
          activeSceneController.reassembleParts(true);
          Nav.markLevelCompleted(4);
        }
      }
    ];

    bindTimelineToLessonDOM(steps11);
    enhanceMathBoardWithConditionAndStepper(ex.figure);

    document.getElementById('l4Replay11StepsBtn').onclick = () => Timeline.repeat();
    document.getElementById('l4NextStepInlineBtn').onclick = () => Timeline.nextStep();
    document.getElementById('goToLevel5Btn').onclick = () => {
      Nav.markLevelCompleted(4);
      Nav.setLevel(5);
    };
  }

  /* ========================================================================
     УРОВЕНЬ 5. УЧИМСЯ САМОСТОЯТЕЛЬНО РАЗБИРАТЬ СЛОЖНЫЕ ФИГУРЫ
     Интерактивное проведение линии разделения на доске + ДВА СПОСОБА РЕШЕНИЯ
     ======================================================================== */

  const LEVEL5_TASKS = [
    {
      title: '1. Фигура с наклонной стороной (52 см²)',
      subtitle: 'Два разных набора фигур — одна и та же площадь!',
      way1Label: 'Способ №1: два прямоугольника и треугольник',
      way2Label: 'Способ №2: один прямоугольник и два треугольника',
      way1Fig: Geo.FIGURES.L5_SLANT_WAY1,
      way2Fig: Geo.FIGURES.L5_SLANT_WAY2,
      way1Math: 'S = 36 + 8 + 8 = 52 см²',
      way2Math: 'S = 36 + 12 + 4 = 52 см²',
      totalArea: 52
    },
    {
      title: '2. Фигура в форме домика (44 см²)',
      subtitle: 'Разделяем крышу и стены двумя способами',
      way1Label: 'Способ №1: прямоугольник (8×4) + треугольник крыши (8×3)',
      way2Label: 'Способ №2: прямоугольник (8×4) + 2 треугольника крыши (по 4×3)',
      way1Fig: Geo.FIGURES.L5_HOUSE_WAY1,
      way2Fig: Geo.FIGURES.L5_HOUSE_WAY2,
      way1Math: 'S = 32 + 12 = 44 см²',
      way2Math: 'S = 32 + 6 + 6 = 44 см²',
      totalArea: 44
    },
    {
      title: '3. Ступенчатая фигура (39 см²)',
      subtitle: 'Горизонтальный разрез против вертикального разреза',
      way1Label: 'Способ №1: горизонтальный разрез (4×3 и 9×3)',
      way2Label: 'Способ №2: вертикальный разрез (4×6 и 5×3)',
      way1Fig: Geo.FIGURES.L5_STEP_WAY1,
      way2Fig: Geo.FIGURES.L5_STEP_WAY2,
      way1Math: 'S = 12 + 27 = 39 см²',
      way2Math: 'S = 24 + 15 = 39 см²',
      totalArea: 39
    }
  ];

  function renderLevel5(root) {
    const tIdx = appState.level5TaskIdx;
    const task = LEVEL5_TASKS[tIdx];
    const currentFig = appState.level5Way === 1 ? task.way1Fig : task.way2Fig;

    currentHintText =
      'Нажмите кнопку «Предложить способ разделения», чтобы на чертеже появились интерактивные линии с ножницами ✂. Ученик может коснуться линии на электронной доске, а затем сравнить Способ №1 и Способ №2 и убедиться, что общая площадь одинакова!';

    root.innerHTML = `
      <div class="board-layout">
        <!-- Левая колонка: Интерактивный холст с выбором линии разреза -->
        <div class="card-panel geometry-stage-card">
          <div class="stage-header">
            <span class="stage-badge">✂ Уровень 5 • Два способа разделения</span>
            <div class="stage-subtabs">
              ${LEVEL5_TASKS.map(
                (t, i) => `
                <button type="button" class="subtab-btn ${i === tIdx ? 'active' : ''}" data-l5-task="${i}">
                  ${t.title}
                </button>
              `
              ).join('')}
            </div>
          </div>

          <div class="svg-canvas-wrapper">
            <svg id="mainLessonSvg" class="geometry-svg" aria-label="${currentFig.title}"></svg>
          </div>

          <div class="action-row" style="margin-top:12px;justify-content:space-between;">
            <button type="button" class="btn btn-accent" id="proposeSplitBtn">
              ✂ Предложить способ разделения
            </button>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button type="button" class="subtab-btn ${appState.level5Way === 1 && appState.level5CutUnlocked ? 'active' : ''}" id="l5Way1Btn">
                ${task.way1Label}
              </button>
              <button type="button" class="subtab-btn ${appState.level5Way === 2 && appState.level5CutUnlocked ? 'active' : ''}" id="l5Way2Btn">
                ${task.way2Label}
              </button>
            </div>
          </div>
        </div>

        <!-- Правая колонка: Сравнение двух способов и самостоятельное вычисление -->
        <div class="card-panel explanation-panel">
          <div>
            <div class="step-indicator-row">
              <span class="step-pill" id="stepCounterPill">Самостоятельный разбор</span>
              <div class="step-dots" id="stepDotsContainer"></div>
            </div>

            <h2 class="lesson-title" id="stepHeadingText" style="margin-top:12px;">${task.title}</h2>
            <div class="pedagogical-callout" id="stepExplanationText" style="margin-top:10px;">
              ${
                !appState.level5CutUnlocked
                  ? 'Сначала перед тобой только исходная фигура с размерами. Подумай, где лучше провести линию разделения, и нажми кнопку <strong>«Предложить способ разделения»</strong>!'
                  : `Отлично! Мы разделили фигуру (<strong>Способ №${appState.level5Way}</strong>). Переключайся между <strong>Способом №1</strong> и <strong>Способом №2</strong>, чтобы увидеть: части получаются разные, а общая площадь — <strong>одна и та же (${task.totalArea} см²)</strong>!`
              }
            </div>
            <div id="l5CutFeedback" style="margin-top:10px;"></div>
          </div>

          <div class="math-board">
            <div class="formula-banner">
              <span class="formula-label">Сравнение двух способов</span>
              <span class="formula-expression" id="stepFormulaExpr">
                ${appState.level5CutUnlocked ? (appState.level5Way === 1 ? task.way1Math : task.way2Math) : 'S = ?'}
              </span>
            </div>

            <div class="calc-steps-list" id="calcStepsContainer">
              ${currentFig.parts
                .map(
                  (p) => `
                <div class="calc-line part-${p.type} ${appState.level5CutUnlocked ? 'visible' : ''}" data-reveal-step="1">
                  <span>${p.name}:</span>
                  <span class="calc-math">${p.calcText}</span>
                </div>
              `
                )
                .join('')}
              <div class="calc-line total-answer ${appState.level5CutUnlocked ? 'visible' : ''}" data-reveal-step="2">
                <span>Общая площадь (одинакова при обоих способах!):</span>
                <span class="calc-math">${appState.level5Way === 1 ? task.way1Math : task.way2Math}</span>
              </div>
            </div>
          </div>

          <!-- Поле самостоятельного ввода ответа учеником -->
          <div style="background:var(--bg-subtle);padding:14px 18px;border-radius:var(--radius-md);border:2px solid var(--border-color);">
            <div style="font-weight:800;font-size:var(--fs-xs);margin-bottom:8px;">
              Проверь себя: чему равна общая площадь этой фигуры?
            </div>
            <div class="mini-input-group">
              <span style="font-weight:800;">S =</span>
              <input type="text" inputmode="numeric" class="math-input" id="l5UserAnswerInp" placeholder="?" />
              <span style="font-weight:800;">см²</span>
              <button type="button" class="btn btn-primary" id="l5CheckAnswerBtn" style="min-height:48px;padding:8px 18px;">
                Проверить
              </button>
              <button type="button" class="btn btn-success" id="goToLevel6Btn" style="min-height:48px;padding:8px 18px;">
                К Уровню 6 →
              </button>
            </div>
            <div id="l5AnswerFeedback" style="margin-top:8px;"></div>
          </div>
        </div>
      </div>
    `;

    // Переключение между фигурами Уровня 5
    root.querySelectorAll('[data-l5-task]').forEach((btn) => {
      btn.onclick = () => {
        Speech.stop();
        appState.level5TaskIdx = Number(btn.getAttribute('data-l5-task'));
        appState.level5Way = 1;
        appState.level5CutMode = false;
        appState.level5CutUnlocked = false;
        renderLevel5(root);
      };
    });

    const svgEl = document.getElementById('mainLessonSvg');
    activeSceneController = Geo.renderScene(svgEl, currentFig, {
      enableInteractiveCuts: appState.level5CutMode && !appState.level5CutUnlocked,
      onPartClick: (part) => {
        if (appState.level5CutUnlocked) {
          activeSceneController.highlightPart(part.id);
        }
      },
      onCutSelect: (cut, groupEl) => {
        const fbEl = document.getElementById('l5CutFeedback');
        if (cut.valid) {
          groupEl.classList.add('selected-valid');
          if (cut.way) appState.level5Way = cut.way;
          appState.level5CutUnlocked = true;
          appState.level5CutMode = false;
          Speech.speak(cut.feedback);
          renderLevel5(root);
          const newFb = document.getElementById('l5CutFeedback');
          if (newFb) {
            newFb.innerHTML = `<div class="feedback-banner success">✓ ${cut.feedback}</div>`;
          }
        } else {
          groupEl.classList.add('selected-invalid');
          if (fbEl) {
            fbEl.innerHTML = `<div class="feedback-banner warning">⚠ ${cut.feedback}</div>`;
          }
          Speech.speak(cut.feedback);
        }
      }
    });

    // Шаги для панели учителя на Уровне 5
    const l5Steps = [
      {
        title: `${task.title} — Исходный чертёж`,
        text: 'Посмотри на фигуру без линий разделения. Нажми «Предложить способ разделения», чтобы выбрать линию разреза на доске.',
        formula: 'S = ?',
        speech: 'Перед нами сложная фигура с известными размерами. Подумай, как разделить её на простые фигуры.',
        durationMs: 2000,
        execute: () => {
          if (!appState.level5CutUnlocked) {
            activeSceneController.resetToInitial();
          }
        }
      },
      {
        title: `${task.title} — Разделение на части (Способ №${appState.level5Way})`,
        text: `Проводим линии разделения и плавно отделяем части друг от друга: ${currentFig.parts.map((p) => p.name).join(', ')}.`,
        formula: appState.level5Way === 1 ? task.way1Math : task.way2Math,
        speech: `Разделяем фигуру способом номер ${appState.level5Way}. Получаем: ${appState.level5Way === 1 ? task.way1Math : task.way2Math}.`,
        durationMs: 2200,
        execute: () => {
          activeSceneController.drawSplitLines();
          activeSceneController.separateParts(true);
        }
      },
      {
        title: `${task.title} — Сборка и проверка двух способов`,
        text: `Оба способа дают один и тот же результат: <strong>${task.way1Math}</strong> и <strong>${task.way2Math}</strong>!`,
        formula: `Способ 1 = Способ 2 = ${task.totalArea} см²`,
        speech: `При обоих способах получается одна и та же общая площадь: ${task.totalArea} квадратных сантиметров.`,
        durationMs: 2200,
        execute: () => {
          activeSceneController.reassembleParts(true);
        }
      }
    ];

    bindTimelineToLessonDOM(l5Steps);
    enhanceMathBoardWithConditionAndStepper(currentFig, `Способ разделения №${appState.level5Way}`);
    if (appState.level5CutUnlocked) {
      Timeline.goToStep(1, true);
    }

    // Кнопка «Предложить способ разделения»
    document.getElementById('proposeSplitBtn').onclick = () => {
      appState.level5CutMode = true;
      appState.level5CutUnlocked = false;
      renderLevel5(root);
      activeSceneController.showKeyVertices(true);
      const fbEl = document.getElementById('l5CutFeedback');
      if (fbEl) {
        fbEl.innerHTML = `<div class="feedback-banner warning">👆 Коснись пунктирной линии со значком ножниц ✂ на чертеже слева, чтобы провести разрез!</div>`;
      }
      Speech.speak('Выбери на чертеже линию со значком ножниц, по которой нужно разделить фигуру.');
    };

    document.getElementById('l5Way1Btn').onclick = () => {
      Speech.stop();
      appState.level5Way = 1;
      appState.level5CutUnlocked = true;
      appState.level5CutMode = false;
      renderLevel5(root);
    };

    document.getElementById('l5Way2Btn').onclick = () => {
      Speech.stop();
      appState.level5Way = 2;
      appState.level5CutUnlocked = true;
      appState.level5CutMode = false;
      renderLevel5(root);
    };

    const ansInp = document.getElementById('l5UserAnswerInp');
    Nav.registerMathInput(ansInp);
    document.getElementById('l5CheckAnswerBtn').onclick = () => {
      const v = parseInt(ansInp.value.trim(), 10);
      const fb = document.getElementById('l5AnswerFeedback');
      if (v === task.totalArea) {
        fb.innerHTML = `<div class="feedback-banner success">✓ Правильно! Независимо от способа разделения площадь равна ${task.totalArea} см²!</div>`;
        Nav.markLevelCompleted(5);
      } else {
        fb.innerHTML = `<div class="feedback-banner error">Проверь сложение площадей частей. Нажми «Способ №1» или «Способ №2», чтобы увидеть подсказку!</div>`;
      }
    };

    document.getElementById('goToLevel6Btn').onclick = () => {
      Nav.markLevelCompleted(5);
      Nav.setLevel(6);
    };
  }

  /* ========================================================================
     УРОВЕНЬ 6. СЛОЖНЫЕ ЗАДАНИЯ И САМОСТОЯТЕЛЬНАЯ РАБОТА (6 ЗАДАЧ)
     ======================================================================== */

  const LEVEL6_TASKS = [
    {
      id: 'l6_1',
      shortTitle: 'Задача 1. Дом с пристройкой',
      figure: Geo.FIGURES.L6_TASK1,
      description: 'Найди общую площадь фасада дома с треугольной крышей и прямоугольной пристройкой.',
      expectedArea: 45,
      wrongNoDiv2: 54,
      hint: 'Раздели фигуру на 3 части: стены дома (6 × 4 = 24 см²), треугольная крыша ((6 × 3) : 2 = 9 см²) и пристройка (4 × 3 = 12 см²).'
    },
    {
      id: 'l6_2',
      shortTitle: 'Задача 2. Трапециевидная насыпь',
      figure: Geo.FIGURES.L6_TASK2,
      description: 'Насыпь состоит из центрального прямоугольника (5 × 4 см) и двух разных прямоугольных треугольников по краям (основания 2 см и 4 см, высота 4 см). Найди её площадь.',
      expectedArea: 32,
      wrongNoDiv2: 44,
      hint: 'Центральный прямоугольник: 5 × 4 = 20 см². Левый треугольник: (2 × 4) : 2 = 4 см². Правый треугольник: (4 × 4) : 2 = 8 см².'
    },
    {
      id: 'l6_3',
      shortTitle: 'Задача 3. Трёхступенчатая лестница',
      figure: Geo.FIGURES.L6_TASK3,
      description: 'Найди площадь боковой стенки лестницы из трёх ступеней (ширина каждой ступени 3 см, высоты 6 см, 4 см и 2 см).',
      expectedArea: 36,
      wrongNoDiv2: null,
      hint: 'Раздели фигуру вертикальными линиями на три прямоугольника: 3 × 6 = 18 см², 3 × 4 = 12 см² и 3 × 2 = 6 см².'
    },
    {
      id: 'l6_4',
      shortTitle: 'Задача 4. Указатель «Стрела»',
      figure: Geo.FIGURES.L6_TASK4,
      description: 'Дорожный указатель состоит из прямоугольника 6 × 4 см и треугольного наконечника (выступы сверху и снизу по 2 см, высота наконечника 4 см). Найди площадь стрелы.',
      expectedArea: 40,
      wrongNoDiv2: 56,
      hint: 'Прямоугольник: 6 × 4 = 24 см². Основание треугольника равно 2 + 4 + 2 = 8 см, а высота 4 см, значит S₂ = (8 × 4) : 2 = 16 см².'
    },
    {
      id: 'l6_5',
      shortTitle: 'Задача 5. Парковый участок',
      figure: Geo.FIGURES.L6_TASK5,
      description: 'Верхняя сторона участка равна 9 см, нижняя — 5 см, левая — 6 см, правая верхняя — 3 см. Найди площадь всего участка.',
      expectedArea: 48,
      wrongNoDiv2: 54,
      hint: 'Раздели участок на левый прямоугольник (5 × 6 = 30 см²), правый верхний прямоугольник (4 × 3 = 12 см²) и нижний треугольник ((4 × 3) : 2 = 6 см²).'
    },
    {
      id: 'l6_6',
      shortTitle: 'Задача 6. Замок Геометрии ★',
      figure: Geo.FIGURES.L6_TASK6,
      description: 'Финальная супер-задача урока! Замок состоит из центрального зала (6 × 4 см), двух башен (по 3 × 5 см) и двух остроконечных треугольных крыш (основание 3 см, высота 2 см). Найди общую площадь замка!',
      expectedArea: 60,
      wrongNoDiv2: 66,
      hint: 'Центральный зал: 24 см². Две башни: 15 + 15 = 30 см². Две треугольные крыши: 3 + 3 = 6 см². Сложи все 5 частей!'
    }
  ];

  function renderLevel6(root) {
    const idx = appState.level6TaskIdx;
    const task = LEVEL6_TASKS[idx];
    currentHintText = task.hint;

    root.innerHTML = `
      <div class="board-layout">
        <!-- Левая колонка: Чертёж сложной задачи -->
        <div class="card-panel geometry-stage-card">
          <div class="stage-header">
            <span class="stage-badge">🏆 Уровень 6 • Самостоятельная работа (${idx + 1} из ${LEVEL6_TASKS.length})</span>
            <div class="stage-subtabs">
              ${LEVEL6_TASKS.map(
                (t, i) => `
                <button type="button" class="subtab-btn ${i === idx ? 'active' : ''}" data-l6-idx="${i}">
                  ${i + 1}${appState.level6Solved.has(i) ? ' ✓' : ''}
                </button>
              `
              ).join('')}
            </div>
          </div>

          <div class="svg-canvas-wrapper">
            <svg id="mainLessonSvg" class="geometry-svg" aria-label="${task.shortTitle}"></svg>
          </div>

          <div class="action-row" style="margin-top:12px;justify-content:space-between;">
            <button type="button" class="btn btn-secondary" id="l6ShowSplitLinesBtn">
              ✂ Показать линии разделения на чертеже
            </button>
            <button type="button" class="btn btn-accent" id="l6AnimateSolutionBtn">
              ✨ Открыть пошаговое решение
            </button>
          </div>
        </div>

        <!-- Правая колонка: Условие, ввод вычислений и проверка -->
        <div class="card-panel explanation-panel">
          <div>
            <div class="step-indicator-row">
              <span class="step-pill" id="stepCounterPill">Задача ${idx + 1} из ${LEVEL6_TASKS.length}</span>
              <div class="step-dots" id="stepDotsContainer"></div>
            </div>

            <h2 class="lesson-title" id="stepHeadingText" style="margin-top:12px;">${task.shortTitle}</h2>
            <div class="pedagogical-callout" id="stepExplanationText" style="margin-top:10px;">
              ${task.description}
            </div>
          </div>

          <!-- Поля для промежуточных вычислений частей и итогового ответа -->
          <div class="math-board">
            <div style="font-weight:800;font-size:var(--fs-xs);color:var(--text-secondary);">
              1. Можешь записать площади отдельных частей (по желанию) и итоговый ответ:
            </div>

            <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
              ${task.figure.parts
                .map(
                  (p, pIdx) => `
                <div style="display:flex;align-items:center;gap:6px;background:#FFF;padding:6px 10px;border-radius:10px;border:1px solid var(--border-color);">
                  <span style="font-weight:700;font-size:var(--fs-xs);">S${pIdx + 1} =</span>
                  <input type="text" inputmode="numeric" class="math-input l6-part-inp" data-part-idx="${pIdx}" placeholder="?" style="width:68px;height:42px;font-size:var(--fs-sm);" />
                </div>
              `
                )
                .join('')}
            </div>

            <div class="mini-input-group" style="margin-top:6px;">
              <span style="font-weight:800;font-size:var(--fs-md);">Итоговая площадь S =</span>
              <input type="text" inputmode="numeric" class="math-input" id="l6TotalInput" placeholder="Ответ" />
              <span style="font-weight:800;font-size:var(--fs-md);">см²</span>
              <button type="button" class="btn btn-primary" id="l6VerifyBtn">
                ✓ Проверить результат
              </button>
            </div>

            <div id="l6FeedbackBanner"></div>

            <!-- Скрытое пошаговое решение, открывается по кнопке или при анимации -->
            <div class="calc-steps-list" id="calcStepsContainer">
              ${task.figure.parts
                .map(
                  (p) => `
                <div class="calc-line part-${p.type}" data-reveal-step="2">
                  <span>${p.name}:</span>
                  <span class="calc-math">${p.calcText}</span>
                </div>
              `
                )
                .join('')}
              <div class="calc-line total-answer" data-reveal-step="3">
                <span>Складываем все части:</span>
                <span class="calc-math">S = ${task.figure.parts.map((p) => p.area).join(' + ')} = ${task.expectedArea} см²</span>
              </div>
            </div>
          </div>

          <div id="l6NumpadSlot"></div>

          <div class="action-row" style="justify-content:space-between;">
            <button type="button" class="btn btn-secondary" id="l6PrevTaskBtn" ${idx === 0 ? 'disabled' : ''}>
              ← Предыдущая задача
            </button>
            ${
              idx < LEVEL6_TASKS.length - 1
                ? `<button type="button" class="btn btn-primary" id="l6NextTaskBtn">Следующая задача →</button>`
                : `<button type="button" class="btn btn-success" id="goToThinkingSectionBtn">Перейти в раздел «Учимся думать» →</button>`
            }
          </div>
        </div>
      </div>
    `;

    root.querySelectorAll('[data-l6-idx]').forEach((btn) => {
      btn.onclick = () => {
        Speech.stop();
        appState.level6TaskIdx = Number(btn.getAttribute('data-l6-idx'));
        renderLevel6(root);
      };
    });

    const svgEl = document.getElementById('mainLessonSvg');
    activeSceneController = Geo.renderScene(svgEl, task.figure, {
      onPartClick: (part) => {
        activeSceneController.highlightPart(part.id);
      }
    });

    const l6Steps = [
      {
        title: task.shortTitle,
        text: task.description,
        formula: 'S = S₁ + S₂ + ...',
        speech: `${task.shortTitle}. ${task.description}`,
        durationMs: 2000,
        execute: () => activeSceneController.resetToInitial()
      },
      {
        title: `${task.shortTitle} — Способ разделения`,
        text: `Проведём линии разделения: фигура распадается на ${task.figure.parts.length} ${task.figure.parts.length >= 5 ? 'простых частей' : 'простые части'}.`,
        formula: 'Разделяем на простые части',
        speech: `Проведём линии разделения. Фигура разделяется на ${task.figure.parts.length} ${task.figure.parts.length >= 5 ? 'простых частей' : 'простые части'}.`,
        durationMs: 2000,
        execute: () => {
          activeSceneController.drawSplitLines();
          activeSceneController.colorParts();
        }
      },
      {
        title: `${task.shortTitle} — Вычисление площадей частей`,
        text: task.figure.parts.map((p) => `<strong>${p.calcText}</strong>`).join('; '),
        formula: 'Находим площадь каждой части',
        speech: task.figure.parts.map((p) => p.calcText).join('. '),
        durationMs: 2200,
        execute: () => {
          activeSceneController.separateParts(true);
        }
      },
      {
        title: `${task.shortTitle} — Итоговый ответ: ${task.expectedArea} см²`,
        text: `Складываем площади всех частей: <strong>S = ${task.figure.parts.map((p) => p.area).join(' + ')} = ${task.expectedArea} см²</strong>!`,
        formula: `S = ${task.expectedArea} см²`,
        speech: `Складываем площади всех частей и получаем ответ: ${task.expectedArea} квадратных сантиметров.`,
        durationMs: 2200,
        execute: () => {
          activeSceneController.reassembleParts(true);
        }
      }
    ];

    bindTimelineToLessonDOM(l6Steps);
    enhanceMathBoardWithConditionAndStepper(task.figure, task.description);

    // Также добавим маленькие фигурки возле полей ввода S1, S2, ... на Уровне 6
    root.querySelectorAll('.l6-part-inp').forEach((inp, pIdx) => {
      const p = task.figure.parts[pIdx];
      if (p && inp.previousElementSibling) {
        inp.previousElementSibling.innerHTML = `${Geo.renderAreaSymbol(p.points, p.type, pIdx + 1)} =`;
      }
    });

    document.getElementById('l6ShowSplitLinesBtn').onclick = () => {
      Timeline.goToStep(1, true);
    };
    document.getElementById('l6AnimateSolutionBtn').onclick = () => {
      Timeline.play();
    };

    const totalInp = document.getElementById('l6TotalInput');
    root.querySelectorAll('.l6-part-inp').forEach((inp) => Nav.registerMathInput(inp));
    Nav.registerMathInput(totalInp);

    const checkL6 = () => {
      const enteredTotal = parseInt(totalInp.value.trim(), 10);
      const enteredParts = Array.from(root.querySelectorAll('.l6-part-inp')).map((inp) =>
        parseInt(inp.value.trim(), 10)
      );
      const fbEl = document.getElementById('l6FeedbackBanner');

      if (Number.isNaN(enteredTotal)) {
        fbEl.innerHTML = `<div class="feedback-banner warning">Введи итоговую площадь S в поле ответа.</div>`;
        return;
      }

      const diag = Exercises.diagnoseError(
        {
          answer: task.expectedArea,
          partAreas: task.figure.parts.map((p) => p.area),
          wrongNoDiv2: task.wrongNoDiv2,
          figure: task.figure
        },
        enteredParts,
        enteredTotal
      );

      if (diag.ok) {
        appState.level6Solved.add(idx);
        Nav.markLevelCompleted(6);
        fbEl.innerHTML = `<div class="feedback-banner success">✓ ${diag.message}</div>`;
        Timeline.goToStep(3, true);
        Speech.speak(diag.message);
      } else {
        fbEl.innerHTML = `<div class="feedback-banner error">⚠ ${diag.message}</div>`;
        Speech.speak(diag.message);
      }
    };

    document.getElementById('l6VerifyBtn').onclick = checkL6;
    document.getElementById('l6NumpadSlot').appendChild(Nav.createBoardNumpad(checkL6));

    const prevBtn = document.getElementById('l6PrevTaskBtn');
    if (prevBtn) {
      prevBtn.onclick = () => {
        appState.level6TaskIdx = Math.max(0, idx - 1);
        renderLevel6(root);
      };
    }
    const nextBtn = document.getElementById('l6NextTaskBtn');
    if (nextBtn) {
      nextBtn.onclick = () => {
        appState.level6TaskIdx = Math.min(LEVEL6_TASKS.length - 1, idx + 1);
        renderLevel6(root);
      };
    }
    const goThinkBtn = document.getElementById('goToThinkingSectionBtn');
    if (goThinkBtn) {
      goThinkBtn.onclick = () => Nav.setMainSection('thinking');
    }
  }

  /* ========================================================================
     РАЗДЕЛ 7. «УЧИМСЯ ДУМАТЬ САМОСТОЯТЕЛЬНО» (ПОШАГОВЫЙ ДИАЛОГ С УЧЕНИКОМ)
     1. Определение частей -> 2. Выбор формулы -> 3. Площадь каждой части -> 4. Общая площадь
     ======================================================================== */

  function renderThinkingSection(root) {
    const tasks = Exercises.THINKING_TASKS;
    const tIdx = appState.thinkingIdx;
    const task = tasks[tIdx];
    const stage = appState.thinkingStage;

    currentHintText =
      'В разделе «Учимся думать самостоятельно» ученик проходит все 4 мыслительных шага: 1) определяет состав фигуры, 2) выбирает формулу для каждой части, 3) вычисляет площадь каждой части, 4) находит сумму.';

    root.innerHTML = `
      <div class="board-layout">
        <!-- Левая колонка: Чертёж -->
        <div class="card-panel geometry-stage-card">
          <div class="stage-header">
            <span class="stage-badge">🧠 Учимся думать самостоятельно (${tIdx + 1} из ${tasks.length})</span>
            <div class="stage-subtabs">
              ${tasks
                .map(
                  (t, i) => `
                <button type="button" class="subtab-btn ${i === tIdx ? 'active' : ''}" data-think-idx="${i}">
                  Задание ${i + 1}
                </button>
              `
                )
                .join('')}
            </div>
          </div>

          <div class="svg-canvas-wrapper">
            <svg id="thinkingSvg" class="geometry-svg" aria-label="${task.title}"></svg>
          </div>

          <!-- Индикатор 4 этапов размышления -->
          <div class="geometry-legend" style="justify-content:space-around;">
            <span style="color:${stage >= 1 ? 'var(--primary)' : 'var(--text-muted)'};font-weight:800;">
              ${stage > 1 ? '✓' : '①'} 1. Части фигуры
            </span>
            <span>→</span>
            <span style="color:${stage >= 2 ? 'var(--primary)' : 'var(--text-muted)'};font-weight:800;">
              ${stage > 2 ? '✓' : '②'} 2. Выбор формулы
            </span>
            <span>→</span>
            <span style="color:${stage >= 3 ? 'var(--primary)' : 'var(--text-muted)'};font-weight:800;">
              ${stage > 3 ? '✓' : '③'} 3. Площади частей
            </span>
            <span>→</span>
            <span style="color:${stage >= 4 ? 'var(--success)' : 'var(--text-muted)'};font-weight:800;">
              ④ 4. Общая площадь
            </span>
          </div>
        </div>

        <!-- Правая колонка: Интерактивный диалог по текущему этапу -->
        <div class="card-panel explanation-panel" id="thinkingRightPanel"></div>
      </div>
    `;

    root.querySelectorAll('[data-think-idx]').forEach((btn) => {
      btn.onclick = () => {
        Speech.stop();
        appState.thinkingIdx = Number(btn.getAttribute('data-think-idx'));
        appState.thinkingStage = 1;
        appState.thinkingFormulasChosen = {};
        renderThinkingSection(root);
      };
    });

    const svgEl = document.getElementById('thinkingSvg');
    const scene = Geo.renderScene(svgEl, task.figure, {
      showHeightsImmediately: stage >= 2
    });
    activeSceneController = scene;

    if (stage === 1) {
      scene.resetToInitial();
    } else if (stage === 2 || stage === 3) {
      scene.drawSplitLines();
      scene.colorParts();
      scene.separateParts(true);
    } else {
      scene.drawSplitLines();
      scene.colorParts();
      scene.reassembleParts(true);
    }

    const rightPanel = document.getElementById('thinkingRightPanel');

    // ЭТАП 1: На какие фигуры можно разделить?
    if (stage === 1) {
      Speech.setStepText(task.splitQuestion);
      rightPanel.innerHTML = `
        <div>
          <span class="step-pill">Шаг 1 из 4 • Определяем части фигуры</span>
          <h2 class="lesson-title" style="margin-top:12px;">${task.splitQuestion}</h2>
          <div class="pedagogical-callout" style="margin-top:10px;">
            Внимательно изучи форму фигуры слева и выбери правильный способ её разделения:
          </div>

          <div class="options-list" style="margin-top:16px;">
            ${task.splitOptions
              .map(
                (opt, i) => `
              <button type="button" class="option-choice-btn" data-think-opt="${i}">
                <span class="level-num-badge" style="background:var(--bg-subtle);">${i + 1}</span>
                <span>${opt.text}</span>
              </button>
            `
              )
              .join('')}
          </div>
          <div id="thinkStage1Fb" style="margin-top:14px;"></div>
        </div>
      `;

      rightPanel.querySelectorAll('[data-think-opt]').forEach((btn) => {
        btn.onclick = () => {
          const opt = task.splitOptions[Number(btn.getAttribute('data-think-opt'))];
          const fb = document.getElementById('thinkStage1Fb');
          if (opt.correct) {
            btn.classList.add('correct');
            fb.innerHTML = `<div class="feedback-banner success">✓ Верно! Смотри, как фигура разделяется на части!</div>`;
            scene.drawSplitLines();
            scene.colorParts();
            scene.separateParts(true);
            Speech.speak('Верно! Переходим к выбору формул для каждой части.');
            setTimeout(() => {
              appState.thinkingStage = 2;
              renderThinkingSection(root);
            }, 1100);
          } else {
            btn.classList.add('wrong');
            fb.innerHTML = `<div class="feedback-banner error">${opt.reason}</div>`;
            Speech.speak(opt.reason);
          }
        };
      });
    }

    // ЭТАП 2: Выбор формулы для каждой части (S = a × b или S = (a × h) : 2)
    else if (stage === 2) {
      Speech.setStepText('Какую формулу нужно использовать для каждой части?');
      rightPanel.innerHTML = `
        <div>
          <span class="step-pill">Шаг 2 из 4 • Выбор формулы для каждой части</span>
          <h2 class="lesson-title" style="margin-top:12px;">Какую формулу нужно использовать для каждой части?</h2>
          <div class="pedagogical-callout" style="margin-top:10px;">
            Для каждой части выбери подходящую формулу площади:
          </div>

          <div style="display:flex;flex-direction:column;gap:14px;margin-top:16px;">
            ${task.partsMeta
              .map(
                (pm, idx) => `
              <div style="background:var(--bg-subtle);padding:14px 16px;border-radius:var(--radius-md);border:2px solid var(--border-color);">
                <div style="font-weight:800;font-size:var(--fs-sm);margin-bottom:10px;">${pm.title}</div>
                <div style="display:flex;gap:10px;flex-wrap:wrap;">
                  <button type="button" class="btn ${appState.thinkingFormulasChosen[idx] === 'rect' ? 'btn-primary' : 'btn-secondary'}" data-part-f="${idx}" data-f-type="rect" style="min-height:48px;">
                    S = a × b (Прямоугольник)
                  </button>
                  <button type="button" class="btn ${appState.thinkingFormulasChosen[idx] === 'tri' ? 'btn-primary' : 'btn-secondary'}" data-part-f="${idx}" data-f-type="tri" style="min-height:48px;">
                    S = (a × h) : 2 (Треугольник)
                  </button>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
          <div id="thinkStage2Fb" style="margin-top:14px;"></div>
        </div>
      `;

      rightPanel.querySelectorAll('[data-part-f]').forEach((btn) => {
        btn.onclick = () => {
          const pIdx = Number(btn.getAttribute('data-part-f'));
          const fType = btn.getAttribute('data-f-type');
          const pm = task.partsMeta[pIdx];
          const fb = document.getElementById('thinkStage2Fb');

          scene.highlightPart(pm.partId);

          if (fType === pm.correctFormula) {
            appState.thinkingFormulasChosen[pIdx] = fType;
            renderThinkingSection(root);
            // Проверяем, выбраны ли все формулы правильно
            const allPicked = task.partsMeta.every(
              (item, i) => appState.thinkingFormulasChosen[i] === item.correctFormula
            );
            if (allPicked) {
              Speech.speak('Все формулы выбраны правильно! Теперь вычислим площадь каждой части.');
              setTimeout(() => {
                appState.thinkingStage = 3;
                renderThinkingSection(root);
              }, 700);
            }
          } else {
            fb.innerHTML = `<div class="feedback-banner error">Посмотри внимательно на форму части «${pm.title}». Для прямоугольника нужна формула S = a × b, а для треугольника — S = (a × h) : 2!</div>`;
          }
        };
      });
    }

    // ЭТАП 3: Вычисление площади каждой части
    else if (stage === 3) {
      Speech.setStepText('Теперь вычисли площадь каждой части отдельно.');
      rightPanel.innerHTML = `
        <div>
          <span class="step-pill">Шаг 3 из 4 • Вычисляем площадь каждой части</span>
          <h2 class="lesson-title" style="margin-top:12px;">Найди площадь каждой части отдельно</h2>
          <div style="display:flex;flex-direction:column;gap:12px;margin-top:14px;">
            ${task.partsMeta
              .map(
                (pm, i) => `
              <div style="background:var(--bg-subtle);padding:14px 16px;border-radius:var(--radius-md);border:2px solid var(--border-color);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
                <div>
                  <div style="font-weight:800;font-size:var(--fs-sm);">${pm.title}</div>
                  <div style="font-size:var(--fs-xs);color:var(--primary);font-weight:700;">
                    Формула: ${pm.correctFormula === 'rect' ? 'S = a × b' : 'S = (a × h) : 2'}
                  </div>
                </div>
                <div class="mini-input-group">
                  <span style="font-weight:800;">S${i + 1} =</span>
                  <input type="text" inputmode="numeric" class="math-input think-part-inp" data-p-idx="${i}" placeholder="?" />
                  <span style="font-weight:800;">см²</span>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
          <div id="thinkStage3Fb" style="margin-top:12px;"></div>
          <div id="thinkStage3Numpad"></div>
        </div>
      `;

      const inputs = rightPanel.querySelectorAll('.think-part-inp');
      inputs.forEach((inp, idx) => {
        Nav.registerMathInput(inp);
        inp.addEventListener('focus', () => scene.highlightPart(task.partsMeta[idx].partId));
      });

      const verifyStage3 = () => {
        const fb = document.getElementById('thinkStage3Fb');
        for (let i = 0; i < task.partsMeta.length; i++) {
          const val = parseInt(inputs[i].value.trim(), 10);
          const expected = task.partsMeta[i].expectedArea;
          if (val !== expected) {
            scene.highlightPart(task.partsMeta[i].partId);
            fb.innerHTML = `<div class="feedback-banner error">Проверь часть ${i + 1}: ${task.partsMeta[i].hint}</div>`;
            Speech.speak(task.partsMeta[i].hint);
            return;
          }
        }
        fb.innerHTML = `<div class="feedback-banner success">✓ Все части найдены верно! Осталось сложить их.</div>`;
        Speech.speak('Молодец! Площади всех частей найдены верно. Теперь найдём общую площадь фигуры.');
        setTimeout(() => {
          appState.thinkingStage = 4;
          renderThinkingSection(root);
        }, 900);
      };

      document.getElementById('thinkStage3Numpad').appendChild(Nav.createBoardNumpad(verifyStage3));
    }

    // ЭТАП 4: Нахождение общей площади
    else if (stage === 4) {
      Speech.setStepText('Сложи площади всех частей, чтобы найти общую площадь фигуры.');
      rightPanel.innerHTML = `
        <div>
          <span class="step-pill">Шаг 4 из 4 • Находим общую площадь фигуры</span>
          <h2 class="lesson-title" style="margin-top:12px;">Сложи площади всех частей!</h2>

          <div class="math-board" style="margin-top:14px;">
            ${task.partsMeta
              .map(
                (pm, i) => `
              <div class="calc-line visible part-rect1">
                <span>${pm.title}:</span>
                <span class="calc-math">S${i + 1} = ${pm.expectedArea} см²</span>
              </div>
            `
              )
              .join('')}
          </div>

          <div class="mini-input-group" style="margin-top:16px;">
            <span style="font-weight:800;font-size:var(--fs-md);">
              S = ${task.partsMeta.map((p) => p.expectedArea).join(' + ')} =
            </span>
            <input type="text" inputmode="numeric" class="math-input" id="thinkTotalInp" placeholder="?" />
            <span style="font-weight:800;font-size:var(--fs-md);">см²</span>
          </div>

          <div id="thinkStage4Fb" style="margin-top:12px;"></div>
          <div id="thinkStage4Numpad"></div>
        </div>
      `;

      const totInp = document.getElementById('thinkTotalInp');
      Nav.registerMathInput(totInp);

      const verifyStage4 = () => {
        const val = parseInt(totInp.value.trim(), 10);
        const fb = document.getElementById('thinkStage4Fb');
        if (val === task.totalArea) {
          fb.innerHTML = `
            <div class="feedback-banner success">
              🎉 Блестяще! Ты самостоятельно прошёл весь путь решения! S = ${task.totalArea} см².
            </div>
            <div class="action-row" style="margin-top:12px;">
              ${
                tIdx < tasks.length - 1
                  ? `<button type="button" class="btn btn-primary" id="nextThinkTaskBtn">Следующее задание →</button>`
                  : `<button type="button" class="btn btn-success" id="goToTrainerFromThinkBtn">Перейти в Тренажёр (20 задач) →</button>`
              }
            </div>
          `;
          Speech.speak(`Блестяще! Общая площадь фигуры равна ${task.totalArea} квадратным сантиметрам.`);
          const nextBtn = document.getElementById('nextThinkTaskBtn');
          if (nextBtn) {
            nextBtn.onclick = () => {
              appState.thinkingIdx++;
              appState.thinkingStage = 1;
              appState.thinkingFormulasChosen = {};
              renderThinkingSection(root);
            };
          }
          const trBtn = document.getElementById('goToTrainerFromThinkBtn');
          if (trBtn) {
            trBtn.onclick = () => Nav.setMainSection('trainer');
          }
        } else {
          fb.innerHTML = `<div class="feedback-banner error">Ты правильно нашёл площади частей (${task.partsMeta.map((p) => p.expectedArea).join(' + ')}), но проверь сложение!</div>`;
        }
      };

      document.getElementById('thinkStage4Numpad').appendChild(Nav.createBoardNumpad(verifyStage4));
    }
  }

  /* ========================================================================
     РАЗДЕЛ 8. ИНТЕРАКТИВНЫЙ ТРЕНАЖЁР (20 ЗАДАЧ ПО 4 УРОВНЯМ СЛОЖНОСТИ)
     ======================================================================== */

  function renderTrainerSection(root) {
    const allProblems = Exercises.TRAINER_PROBLEMS;
    const filtered =
      appState.trainerTier === 'all'
        ? allProblems
        : allProblems.filter((p) => p.tier === appState.trainerTier);

    let currentProb =
      filtered.find((p) => p.id === appState.trainerProblemId) || filtered[0] || allProblems[0];
    appState.trainerProblemId = currentProb.id;

    currentHintText = currentProb.hint;
    Speech.setStepText(`${currentProb.title}. ${currentProb.question}`);

    root.innerHTML = `
      <!-- Панель фильтрации по 4 уровням сложности -->
      <div class="tier-filter-bar">
        <div class="tier-pills">
          <button type="button" class="tier-pill ${appState.trainerTier === 'all' ? 'active' : ''}" data-tier="all">
            Все 20 задач (${appState.trainerSolved.size}/20)
          </button>
          <button type="button" class="tier-pill ${appState.trainerTier === 'easy' ? 'active' : ''}" data-tier="easy">
            🟢 5 лёгких (1–5)
          </button>
          <button type="button" class="tier-pill ${appState.trainerTier === 'simple' ? 'active' : ''}" data-tier="simple">
            🔵 5 несложных (6–10)
          </button>
          <button type="button" class="tier-pill ${appState.trainerTier === 'medium' ? 'active' : ''}" data-tier="medium">
            🟠 5 средних (11–15)
          </button>
          <button type="button" class="tier-pill ${appState.trainerTier === 'hard' ? 'active' : ''}" data-tier="hard">
            🟣 5 сложных (16–20)
          </button>
        </div>

        <div style="font-weight:800;font-size:var(--fs-xs);color:var(--primary);">
          Решено задач: ${appState.trainerSolved.size} из 20
        </div>
      </div>

      <!-- Полоса номеров задач -->
      <div class="problem-number-strip">
        ${filtered
          .map(
            (p) => `
          <button type="button" class="prob-num-btn ${p.id === currentProb.id ? 'active' : ''} ${appState.trainerSolved.has(p.id) ? 'solved' : ''}" data-prob-id="${p.id}">
            ${p.id}
          </button>
        `
          )
          .join('')}
      </div>

      <!-- Основная карточка текущей задачи тренажёра -->
      <div class="board-layout">
        <!-- Левая колонка: Геометрический рисунок задачи -->
        <div class="card-panel geometry-stage-card">
          <div class="stage-header">
            <span class="stage-badge">🎯 Тренажёр • Уровень: ${currentProb.tierName}</span>
            <button type="button" class="btn btn-secondary" id="trainerHintVisualBtn" style="min-height:44px;padding:6px 14px;">
              💡 Подсказка
            </button>
          </div>

          <div class="svg-canvas-wrapper">
            <svg id="trainerSvg" class="geometry-svg" aria-label="${currentProb.title}"></svg>
          </div>

          <div class="geometry-legend">
            <span>Внимательно проверь все размеры на чертеже (1 клетка сетки = 1 см)</span>
          </div>
        </div>

        <!-- Правая колонка: Условие задачи, выбор формулы, ввод вычислений, пошаговый показ решения -->
        <div class="card-panel explanation-panel">
          <div>
            <h2 class="lesson-title">${currentProb.title}</h2>
            <div style="margin-top:10px;">
              ${Geo.renderConditionBoxHTML(currentProb.figure, currentProb.question)}
            </div>
          </div>

          <div class="math-board">
            <!-- 1. Выбор формулы -->
            <div>
              <div style="font-size:var(--fs-xs);font-weight:800;color:var(--text-secondary);margin-bottom:8px;">
                1. Выбери основную формулу для решения:
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;" id="trainerFormulaChoices">
                ${['S = a × b', 'S = (a × h) : 2', 'S = S₁ + S₂', 'S = S₁ + S₂ + S₃'].map(
                  (fStr) => `
                  <button type="button" class="subtab-btn trainer-formula-btn" data-f-val="${fStr}">
                    ${fStr}
                  </button>
                `
                ).join('')}
              </div>
            </div>

            <!-- 2. Промежуточные площади частей (если фигура составная) с маленькими фигурками под S -->
            ${
              currentProb.partAreas.length > 1
                ? `
              <div style="margin-top:6px;">
                <div style="font-size:var(--fs-xs);font-weight:800;color:var(--text-secondary);margin-bottom:8px;">
                  2. Вычисли площади отдельных частей (посмотри на фигурку у знака S):
                </div>
                <div style="display:flex;gap:10px;flex-wrap:wrap;">
                  ${currentProb.partLabels
                    .map((lbl, i) => {
                      const pObj = currentProb.figure.parts[i];
                      const sIcon = pObj
                        ? Geo.renderAreaSymbol(pObj.points, pObj.type, i + 1)
                        : `S${i + 1}`;
                      return `
                    <div style="display:flex;align-items:center;gap:6px;background:#FFF;padding:6px 10px;border-radius:10px;border:1px solid var(--border-color);">
                      <span style="font-size:0.92rem;font-weight:700;">${sIcon} =</span>
                      <input type="text" inputmode="numeric" class="math-input trainer-part-inp" data-p-idx="${i}" placeholder="?" style="width:68px;height:42px;font-size:var(--fs-sm);" />
                    </div>
                  `;
                    })
                    .join('')}
                </div>
              </div>
            `
                : ''
            }

            <!-- 3. Ввод итогового ответа с маленькой иконкой всей фигуры под S -->
            <div class="mini-input-group" style="margin-top:6px;">
              <span style="font-weight:800;font-size:var(--fs-md);">
                Ответ: ${Geo.renderAreaSymbol(currentProb.figure.outerContour, 'total', '')} =
              </span>
              <input type="text" inputmode="numeric" class="math-input" id="trainerTotalInp" placeholder="?" />
              <span style="font-weight:800;font-size:var(--fs-md);">см²</span>
              <button type="button" class="btn btn-primary" id="trainerCheckBtn">
                ✓ Проверить ответ
              </button>
            </div>

            <div id="trainerFeedbackBox"></div>

            <!-- 4. Кнопка поочерёдного показа шагов решения -->
            <div class="next-calc-step-bar">
              <button type="button" class="btn-reveal-step" id="trainerStepByStepBtn">
                ➕ Показать шаг решения (по очереди)
              </button>
              <button type="button" class="subtab-btn" id="contextualShowSolutionBtn" style="min-height:50px;">
                📖 Всё решение сразу
              </button>
            </div>

            <div class="calc-steps-list" id="trainerCalcStepsList">
              ${currentProb.figure.parts
                .map(
                  (p, pIdx) => `
                <div class="calc-line part-${p.type}" data-tr-step="${pIdx}">
                  <span>${pIdx + 1}-е действие (${p.name}):</span>
                  <span class="calc-math">${Geo.renderPartCalcWithIcon(p, currentProb.figure.parts.length > 1 ? pIdx : '')}</span>
                </div>
              `
                )
                .join('')}
              ${
                currentProb.figure.parts.length > 1
                  ? `
                <div class="calc-line total-answer" data-tr-step="${currentProb.figure.parts.length}">
                  <span>Складываем площади частей:</span>
                  <span class="calc-math">${Geo.renderTotalCalcWithIcons(currentProb.figure, currentProb.answer)}</span>
                </div>
              `
                  : ''
              }
            </div>
          </div>

          <div id="trainerNumpadSlot"></div>

          <div class="action-row" style="justify-content:space-between;">
            <button type="button" class="btn btn-secondary" id="trainerPrevBtn" ${currentProb.id <= 1 ? 'disabled' : ''}>
              ← Предыдущая задача
            </button>
            <button type="button" class="btn btn-primary" id="trainerNextBtn" ${currentProb.id >= 20 ? 'disabled' : ''}>
              Следующая задача →
            </button>
          </div>
        </div>
      </div>
    `;

    // Отрисовка SVG задачи тренажёра
    const svgEl = document.getElementById('trainerSvg');
    const trainerScene = Geo.renderScene(svgEl, currentProb.figure, {
      showHeightsImmediately: true,
      onPartClick: (part) => trainerScene.highlightPart(part.id)
    });
    activeSceneController = trainerScene;

    // Фильтры по уровням сложности
    root.querySelectorAll('[data-tier]').forEach((btn) => {
      btn.onclick = () => {
        appState.trainerTier = btn.getAttribute('data-tier');
        const list =
          appState.trainerTier === 'all'
            ? allProblems
            : allProblems.filter((p) => p.tier === appState.trainerTier);
        if (list.length > 0) appState.trainerProblemId = list[0].id;
        renderTrainerSection(root);
      };
    });

    // Переключение по номерам задач
    root.querySelectorAll('[data-prob-id]').forEach((btn) => {
      btn.onclick = () => {
        appState.trainerProblemId = Number(btn.getAttribute('data-prob-id'));
        renderTrainerSection(root);
      };
    });

    // Выбор формулы
    root.querySelectorAll('.trainer-formula-btn').forEach((btn) => {
      btn.onclick = () => {
        root.querySelectorAll('.trainer-formula-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      };
    });

    // Регистрация полей ввода для клавиатуры доски
    root.querySelectorAll('.trainer-part-inp').forEach((inp) => Nav.registerMathInput(inp));
    const totalInp = document.getElementById('trainerTotalInp');
    Nav.registerMathInput(totalInp);

    const checkProblem = () => {
      const enteredTotal = parseInt(totalInp.value.trim(), 10);
      const enteredParts = Array.from(root.querySelectorAll('.trainer-part-inp')).map((inp) =>
        parseInt(inp.value.trim(), 10)
      );
      const fbBox = document.getElementById('trainerFeedbackBox');

      if (Number.isNaN(enteredTotal)) {
        fbBox.innerHTML = `<div class="feedback-banner warning">Введи число в поле ответа S.</div>`;
        return;
      }

      const result = Exercises.diagnoseError(currentProb, enteredParts, enteredTotal);
      if (result.ok) {
        appState.trainerSolved.add(currentProb.id);
        fbBox.innerHTML = `<div class="feedback-banner success">✓ ${result.message}</div>`;
        trainerScene.drawSplitLines();
        trainerScene.colorParts();
        Speech.speak(result.message);
        // Обновим индикатор решённой кнопки
        const activeNumBtn = root.querySelector(`[data-prob-id="${currentProb.id}"]`);
        if (activeNumBtn) activeNumBtn.classList.add('solved');
      } else {
        fbBox.innerHTML = `<div class="feedback-banner error">⚠ ${result.message}</div>`;
        Speech.speak(result.message);
      }
    };

    document.getElementById('trainerCheckBtn').onclick = checkProblem;
    totalInp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') checkProblem();
    });
    document.getElementById('trainerNumpadSlot').appendChild(Nav.createBoardNumpad(checkProblem));

    // Кнопка подсказки
    document.getElementById('trainerHintVisualBtn').onclick = () => {
      trainerScene.drawSplitLines();
      trainerScene.colorParts();
      const fbBox = document.getElementById('trainerFeedbackBox');
      fbBox.innerHTML = `<div class="feedback-banner warning">💡 Подсказка: ${currentProb.hint}</div>`;
      Speech.speak(currentProb.hint);
    };

    // Поочерёдный показ шагов решения в Тренажёре
    const trLines = Array.from(root.querySelectorAll('#trainerCalcStepsList .calc-line'));
    let trRevealed = 0;
    const trStepBtn = document.getElementById('trainerStepByStepBtn');
    if (trStepBtn) {
      trStepBtn.onclick = () => {
        if (trRevealed >= trLines.length) {
          trLines.forEach((el) => el.classList.remove('visible', 'active-focus'));
          trRevealed = 0;
          trainerScene.resetToInitial();
          trStepBtn.classList.remove('all-revealed');
          trStepBtn.textContent = `➕ Показать шаг решения (1 из ${trLines.length})`;
          return;
        }
        trLines.forEach((el) => el.classList.remove('active-focus'));
        const line = trLines[trRevealed];
        if (line) {
          line.classList.add('visible', 'active-focus');
          if (trRevealed < currentProb.figure.parts.length && currentProb.figure.parts.length > 1) {
            trainerScene.drawSplitLines();
            trainerScene.separateParts(true);
            trainerScene.highlightPart(currentProb.figure.parts[trRevealed].id);
          } else {
            trainerScene.reassembleParts(true);
          }
        }
        trRevealed++;
        if (trRevealed >= trLines.length) {
          trStepBtn.classList.add('all-revealed');
          trStepBtn.textContent = `✓ Все шаги открыты (нажми, чтобы скрыть)`;
        } else {
          trStepBtn.textContent = `➕ Показать шаг решения (${trRevealed + 1} из ${trLines.length})`;
        }
      };
    }

    // Кнопка полного решения сразу
    document.getElementById('contextualShowSolutionBtn').onclick = () => {
      trainerScene.drawSplitLines();
      trainerScene.colorParts();
      trainerScene.separateParts(true);
      trLines.forEach((el) => el.classList.add('visible'));
      trRevealed = trLines.length;
      if (trStepBtn) {
        trStepBtn.classList.add('all-revealed');
        trStepBtn.textContent = `✓ Все шаги открыты (нажми, чтобы скрыть)`;
      }
    };

    // Навигация Назад / Далее
    document.getElementById('trainerPrevBtn').onclick = () => {
      if (currentProb.id > 1) {
        appState.trainerProblemId = currentProb.id - 1;
        appState.trainerTier = 'all';
        renderTrainerSection(root);
      }
    };
    document.getElementById('trainerNextBtn').onclick = () => {
      if (currentProb.id < 20) {
        appState.trainerProblemId = currentProb.id + 1;
        appState.trainerTier = 'all';
        renderTrainerSection(root);
      }
    };
  }

  /* ========================================================================
     РАЗДЕЛ 9. ИНТЕРАКТИВНАЯ ВИКТОРИНА ИЗ 10 ВОПРОСОВ
     ======================================================================== */

  function renderQuizSection(root) {
    const questions = Quiz.QUIZ_QUESTIONS;

    if (appState.quizFinished) {
      renderQuizResults(root, questions);
      return;
    }

    const qIdx = appState.quizIndex;
    const q = questions[qIdx];
    const selectedIdx = appState.quizAnswers[q.id];
    const isAnswered = selectedIdx !== undefined;

    Speech.setStepText(`Вопрос ${qIdx + 1}. ${q.question}`);

    root.innerHTML = `
      <div class="board-layout">
        <!-- Левая колонка: Иллюстрация к вопросу викторины -->
        <div class="card-panel geometry-stage-card">
          <div class="stage-header">
            <span class="stage-badge">🏆 Итоговая викторина • Вопрос ${qIdx + 1} из ${questions.length}</span>
            <span class="step-pill" style="background:var(--secondary);">${q.levelRef}</span>
          </div>

          <div class="svg-canvas-wrapper">
            <svg id="quizSvg" class="geometry-svg" aria-label="Чертёж к вопросу ${qIdx + 1}"></svg>
          </div>

          <div class="problem-number-strip" style="margin-top:14px;margin-bottom:0;justify-content:center;">
            ${questions
              .map((item, i) => {
                const ans = appState.quizAnswers[item.id];
                let cls = '';
                if (i === qIdx) cls = 'active';
                else if (ans !== undefined) cls = 'solved';
                return `<button type="button" class="prob-num-btn ${cls}" data-quiz-jump="${i}">${i + 1}</button>`;
              })
              .join('')}
          </div>
        </div>

        <!-- Правая колонка: Вопрос и варианты ответа -->
        <div class="card-panel explanation-panel">
          <div>
            <h2 class="lesson-title">${q.question}</h2>

            <div class="options-list" style="margin-top:18px;">
              ${q.options
                .map((opt, oIdx) => {
                  let stateClass = '';
                  if (isAnswered) {
                    if (opt.correct) stateClass = 'correct';
                    else if (oIdx === selectedIdx) stateClass = 'wrong';
                  }
                  return `
                    <button type="button" class="option-choice-btn ${stateClass}" data-quiz-opt="${oIdx}" ${isAnswered ? 'disabled' : ''}>
                      <span class="level-num-badge" style="background:var(--bg-subtle);">${oIdx + 1}</span>
                      <span>${opt.text}</span>
                    </button>
                  `;
                })
                .join('')}
            </div>

            ${
              isAnswered
                ? `
              <div class="feedback-banner ${q.options[selectedIdx].correct ? 'success' : 'error'}" style="margin-top:16px;">
                ${q.options[selectedIdx].correct ? '✓ Правильно! ' : '✗ Ошибка. '} ${q.explanation}
              </div>
            `
                : ''
            }
          </div>

          <div class="action-row" style="justify-content:space-between;margin-top:18px;">
            <button type="button" class="btn btn-secondary" id="quizPrevBtn" ${qIdx === 0 ? 'disabled' : ''}>
              ← Предыдущий вопрос
            </button>
            ${
              qIdx < questions.length - 1
                ? `<button type="button" class="btn btn-primary" id="quizNextBtn">Следующий вопрос →</button>`
                : `<button type="button" class="btn btn-success" id="quizFinishBtn">Завершить и посмотреть результат 🏆</button>`
            }
          </div>
        </div>
      </div>
    `;

    const svgEl = document.getElementById('quizSvg');
    const qScene = Geo.renderScene(svgEl, q.figure, {
      showHeightsImmediately: true
    });
    qScene.colorParts();
    qScene.drawSplitLines();

    root.querySelectorAll('[data-quiz-opt]').forEach((btn) => {
      btn.onclick = () => {
        const oIdx = Number(btn.getAttribute('data-quiz-opt'));
        appState.quizAnswers[q.id] = oIdx;
        const chosen = q.options[oIdx];
        Speech.speak((chosen.correct ? 'Правильно! ' : 'Обрати внимание: ') + q.explanation);
        renderQuizSection(root);
      };
    });

    root.querySelectorAll('[data-quiz-jump]').forEach((btn) => {
      btn.onclick = () => {
        appState.quizIndex = Number(btn.getAttribute('data-quiz-jump'));
        renderQuizSection(root);
      };
    });

    const prevBtn = document.getElementById('quizPrevBtn');
    if (prevBtn) {
      prevBtn.onclick = () => {
        appState.quizIndex = Math.max(0, qIdx - 1);
        renderQuizSection(root);
      };
    }

    const nextBtn = document.getElementById('quizNextBtn');
    if (nextBtn) {
      nextBtn.onclick = () => {
        appState.quizIndex = Math.min(questions.length - 1, qIdx + 1);
        renderQuizSection(root);
      };
    }

    const finBtn = document.getElementById('quizFinishBtn');
    if (finBtn) {
      finBtn.onclick = () => {
        appState.quizFinished = true;
        renderQuizSection(root);
      };
    }
  }

  /**
   * Экран результатов викторины (Правильные ответы, ошибки, итог, разбор неправильных ответов, кнопка «Пройти ещё раз»)
   */
  function renderQuizResults(root, questions) {
    let correctCount = 0;
    const wrongItems = [];

    questions.forEach((q, idx) => {
      const uAns = appState.quizAnswers[q.id];
      const isRight = uAns !== undefined && q.options[uAns] && q.options[uAns].correct;
      if (isRight) {
        correctCount++;
      } else {
        wrongItems.push({
          num: idx + 1,
          question: q.question,
          userAnswer: uAns !== undefined ? q.options[uAns].text : 'Ответ не выбран',
          correctAnswer: q.options.find((o) => o.correct).text,
          explanation: q.explanation
        });
      }
    });

    const errorCount = questions.length - correctCount;
    const percent = Math.round((correctCount / questions.length) * 100);

    let gradeText = 'Отличный результат! Настоящий мастер геометрии!';
    if (correctCount < 9 && correctCount >= 7) {
      gradeText = 'Хороший результат! Ты уверенно разбираешься в площадях сложных фигур.';
    } else if (correctCount < 7) {
      gradeText = 'Неплохая попытка! Изучи разбор ошибок ниже и попробуй пройти викторину ещё раз.';
    }

    Speech.setStepText(
      `Викторина завершена. Правильных ответов: ${correctCount} из 10. Ошибок: ${errorCount}. ${gradeText}`
    );

    root.innerHTML = `
      <div class="celebration-banner" style="margin-bottom:24px;">
        <div class="celebration-title">🏆 Итоги интерактивной викторины</div>
        <p style="font-size:var(--fs-md);font-weight:700;color:var(--text-secondary);margin-bottom:20px;">
          ${gradeText}
        </p>

        <div style="display:flex;justify-content:center;gap:24px;flex-wrap:wrap;margin-bottom:24px;">
          <div style="background:#FFFFFF;padding:18px 28px;border-radius:18px;border:2px solid var(--success);min-width:210px;">
            <div style="font-size:var(--fs-xs);font-weight:700;color:var(--text-muted);">Правильных ответов</div>
            <div style="font-size:var(--fs-2xl);font-weight:900;color:var(--success);">${correctCount} из 10</div>
          </div>

          <div style="background:#FFFFFF;padding:18px 28px;border-radius:18px;border:2px solid ${errorCount > 0 ? 'var(--error)' : 'var(--border-color)'};min-width:210px;">
            <div style="font-size:var(--fs-xs);font-weight:700;color:var(--text-muted);">Количество ошибок</div>
            <div style="font-size:var(--fs-2xl);font-weight:900;color:${errorCount > 0 ? 'var(--error)' : 'var(--text-primary)'};">${errorCount}</div>
          </div>

          <div style="background:#FFFFFF;padding:18px 28px;border-radius:18px;border:2px solid var(--primary);min-width:210px;">
            <div style="font-size:var(--fs-xs);font-weight:700;color:var(--text-muted);">Итоговый результат</div>
            <div style="font-size:var(--fs-2xl);font-weight:900;color:var(--primary);">${percent}%</div>
          </div>
        </div>

        <div class="action-row" style="justify-content:center;">
          <button type="button" class="btn btn-primary" id="quizRetryBtn">
            🔄 Пройти ещё раз
          </button>
          <button type="button" class="btn btn-success" id="quizGoSummaryBtn">
            Перейти к Заключительному разделу урока →
          </button>
        </div>
      </div>

      <div class="card-panel">
        <h3 style="font-size:var(--fs-lg);font-weight:800;margin-bottom:14px;">
          ${
            wrongItems.length === 0
              ? '🌟 Ни одной ошибки! Все 10 заданий выполнены безупречно!'
              : `📋 Подробный разбор неправильных ответов (${wrongItems.length}):`
          }
        </h3>

        <div style="display:flex;flex-direction:column;gap:14px;">
          ${wrongItems
            .map(
              (item) => `
            <div style="background:var(--bg-subtle);border-left:6px solid var(--error);padding:16px 20px;border-radius:12px;">
              <div style="font-weight:800;font-size:var(--fs-base);margin-bottom:6px;">
                Вопрос ${item.num}: ${item.question}
              </div>
              <div style="font-size:var(--fs-sm);color:var(--error);font-weight:700;">
                Твой ответ: ${item.userAnswer}
              </div>
              <div style="font-size:var(--fs-sm);color:var(--success);font-weight:800;margin-top:4px;">
                Правильный ответ: ${item.correctAnswer}
              </div>
              <div style="font-size:var(--fs-sm);color:var(--text-secondary);margin-top:6px;">
                <strong>Объяснение:</strong> ${item.explanation}
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;

    document.getElementById('quizRetryBtn').onclick = () => {
      appState.quizIndex = 0;
      appState.quizAnswers = {};
      appState.quizFinished = false;
      renderQuizSection(root);
    };

    document.getElementById('quizGoSummaryBtn').onclick = () => {
      Nav.setMainSection('summary');
    };
  }

  /* ========================================================================
     РАЗДЕЛ 13. ЗАКЛЮЧИТЕЛЬНЫЙ РАЗДЕЛ (3 ПРАВИЛА И ФИНАЛЬНОЕ ПОЗДРАВЛЕНИЕ)
     ======================================================================== */

  function renderSummarySection(root) {
    Speech.setStepText(
      'Подведём итоги урока! Правило номер один: чтобы найти площадь прямоугольника, нужно длину умножить на ширину. Правило номер два: чтобы найти площадь треугольника, нужно основание умножить на высоту и разделить на два. Правило номер три: чтобы найти площадь сложной фигуры, можно разделить её на простые геометрические фигуры, вычислить площадь каждой части и сложить результаты. Молодец! Теперь ты умеешь находить площадь сложных фигур!'
    );

    root.innerHTML = `
      <div class="celebration-banner">
        <div class="celebration-title">
          🎉 Молодец! Теперь ты умеешь находить площадь сложных фигур!
        </div>
        <p style="font-size:var(--fs-md);color:var(--text-secondary);font-weight:600;max-width:920px;margin:0 auto;">
          Даже самая сложная геометрическая фигура становится простой и понятной, если разделить её на знакомые прямоугольники и треугольники!
        </p>
      </div>

      <div class="summary-rules-grid">
        <!-- Правило №1 -->
        <div class="rule-card">
          <span class="rule-badge">Правило №1 • Прямоугольник</span>
          <h3 style="font-size:var(--fs-md);font-weight:800;">Площадь прямоугольника</h3>
          <p style="font-size:var(--fs-sm);color:var(--text-secondary);">
            Чтобы найти площадь прямоугольника, нужно длину умножить на ширину.
          </p>
          <div class="formula-banner" style="margin-top:auto;">
            <span class="formula-expression">S = a × b</span>
          </div>
          <div style="height:150px;">
            <svg id="sumSvg1" class="geometry-svg"></svg>
          </div>
        </div>

        <!-- Правило №2 -->
        <div class="rule-card">
          <span class="rule-badge" style="background:var(--secondary-light);color:#0F766E;">Правило №2 • Треугольник</span>
          <h3 style="font-size:var(--fs-md);font-weight:800;">Площадь треугольника</h3>
          <p style="font-size:var(--fs-sm);color:var(--text-secondary);">
            Чтобы найти площадь треугольника, нужно основание умножить на высоту и разделить на 2.
          </p>
          <div class="formula-banner" style="margin-top:auto;">
            <span class="formula-expression" style="color:var(--success);">S = (a × h) / 2</span>
          </div>
          <div style="height:150px;">
            <svg id="sumSvg2" class="geometry-svg"></svg>
          </div>
        </div>

        <!-- Правило №3 -->
        <div class="rule-card">
          <span class="rule-badge" style="background:#FCE7F3;color:#BE185D;">Правило №3 • Сложная фигура</span>
          <h3 style="font-size:var(--fs-md);font-weight:800;">Площадь сложной фигуры</h3>
          <p style="font-size:var(--fs-sm);color:var(--text-secondary);">
            Чтобы найти площадь сложной фигуры, можно разделить её на простые геометрические фигуры, вычислить площадь каждой части и сложить результаты.
          </p>
          <div class="formula-banner" style="margin-top:auto;">
            <span class="formula-expression" style="color:var(--accent-rose);">S = S₁ + S₂ + S₃ + ...</span>
          </div>
          <div style="height:150px;">
            <svg id="sumSvg3" class="geometry-svg"></svg>
          </div>
        </div>
      </div>

      <div class="action-row" style="justify-content:center;margin-top:16px;">
        <button type="button" class="btn btn-primary" id="sumBackToStartBtn">
          ↺ Вернуться к Уровню 1
        </button>
        <button type="button" class="btn btn-secondary" id="sumGoTrainerBtn">
          🎯 Открыть Тренажёр (20 задач)
        </button>
      </div>
    `;

    // Мини-иллюстрации в карточках правил
    const s1 = Geo.renderScene(document.getElementById('sumSvg1'), Geo.makeRectFigure(6, 4), {
      viewW: 420,
      viewH: 210,
      padding: 40,
      showGrid: false
    });
    s1.colorParts();

    const s2 = Geo.renderScene(document.getElementById('sumSvg2'), Geo.makeIsoTriFigure(8, 4), {
      viewW: 420,
      viewH: 210,
      padding: 40,
      showGrid: false,
      showHeightsImmediately: true
    });
    s2.colorParts();

    const s3 = Geo.renderScene(document.getElementById('sumSvg3'), Geo.FIGURES.L3_MAIN, {
      viewW: 420,
      viewH: 210,
      padding: 40,
      showGrid: false,
      showHeightsImmediately: true
    });
    s3.colorParts();
    s3.drawSplitLines();
    s3.separateParts(false);

    document.getElementById('sumBackToStartBtn').onclick = () => Nav.setLevel(1);
    document.getElementById('sumGoTrainerBtn').onclick = () => Nav.setMainSection('trainer');
  }
})();
