/* ==========================================================================
   КОНТРОЛЛЕР ПОШАГОВЫХ АНИМАЦИЙ И ВРЕМЕННОЙ ШКАЛЫ УРОКА (animations.js)
   Управляет синхронизацией геометрических преобразований и формул:
   - Запустить анимацию / Пауза / Продолжить / Повторить
   - Следующий шаг / Предыдущий шаг (без сброса задачи и без поломки SVG)
   ========================================================================== */

window.AnimationTimeline = (function () {
  let steps = [];
  let currentStepIndex = 0;
  let status = 'idle'; // 'idle' | 'playing' | 'paused'
  let timerId = null;
  let onStepChangeCallback = null;
  let onStatusChangeCallback = null;

  function clearTimer() {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  function notifyStatus(newStatus) {
    status = newStatus;
    if (typeof onStatusChangeCallback === 'function') {
      onStatusChangeCallback(status, currentStepIndex, steps.length);
    }
  }

  function applyCurrentStep() {
    const stepObj = steps[currentStepIndex];
    if (!stepObj) return;

    if (typeof stepObj.execute === 'function') {
      stepObj.execute();
    }
    if (typeof onStepChangeCallback === 'function') {
      onStepChangeCallback(currentStepIndex, stepObj, steps.length);
    }
  }

  function scheduleNextAutoStep() {
    clearTimer();
    if (status !== 'playing') return;

    const currentStep = steps[currentStepIndex];
    const duration = (currentStep && currentStep.durationMs) || 2100;

    timerId = setTimeout(() => {
      if (status !== 'playing') return;
      if (currentStepIndex < steps.length - 1) {
        currentStepIndex++;
        applyCurrentStep();
        scheduleNextAutoStep();
      } else {
        notifyStatus('idle');
      }
    }, duration);
  }

  /**
   * Загружает массив шагов для текущего экрана урока
   */
  function loadSteps(newSteps, options = {}) {
    clearTimer();
    steps = Array.isArray(newSteps) ? newSteps : [];
    currentStepIndex = 0;
    onStepChangeCallback = options.onStepChange || null;
    onStatusChangeCallback = options.onStatusChange || null;
    notifyStatus('idle');
    if (steps.length > 0) {
      applyCurrentStep();
    }
  }

  /**
   * Переход к произвольному шагу по индексу (последовательно применяет состояние,
   * чтобы SVG-сцена всегда оставалась целостной при переходах вперёд и назад)
   */
  function goToStep(targetIndex, stopPlayback = true) {
    if (steps.length === 0) return;
    if (stopPlayback) {
      clearTimer();
      notifyStatus('idle');
    }

    const clamped = Math.max(0, Math.min(targetIndex, steps.length - 1));
    // Для полной согласованности SVG выполняем шаги от 0 до clamped
    for (let i = 0; i <= clamped; i++) {
      if (typeof steps[i].execute === 'function') {
        steps[i].execute(i < clamped);
      }
    }
    currentStepIndex = clamped;
    if (typeof onStepChangeCallback === 'function') {
      onStepChangeCallback(currentStepIndex, steps[currentStepIndex], steps.length);
    }
    notifyStatus(status);
  }

  function nextStep() {
    if (currentStepIndex < steps.length - 1) {
      goToStep(currentStepIndex + 1, true);
    }
  }

  function prevStep() {
    if (currentStepIndex > 0) {
      goToStep(currentStepIndex - 1, true);
    }
  }

  function play() {
    if (steps.length === 0) return;
    clearTimer();
    if (currentStepIndex >= steps.length - 1) {
      goToStep(0, false);
    }
    notifyStatus('playing');
    scheduleNextAutoStep();
  }

  function pause() {
    if (status === 'playing') {
      clearTimer();
      notifyStatus('paused');
    }
  }

  function resume() {
    if (status === 'paused') {
      notifyStatus('playing');
      scheduleNextAutoStep();
    } else if (status === 'idle') {
      play();
    }
  }

  function repeat() {
    clearTimer();
    goToStep(0, false);
    notifyStatus('playing');
    scheduleNextAutoStep();
  }

  function showFullSolution() {
    if (steps.length === 0) return;
    goToStep(steps.length - 1, true);
  }

  return {
    loadSteps,
    goToStep,
    nextStep,
    prevStep,
    play,
    pause,
    resume,
    repeat,
    showFullSolution,
    getCurrentStepIndex: () => currentStepIndex,
    getTotalSteps: () => steps.length,
    getStatus: () => status,
    getCurrentStep: () => steps[currentStepIndex] || null
  };
})();
