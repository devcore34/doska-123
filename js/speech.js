/* ==========================================================================
   ЗАГЛУШКА МОДУЛЯ ОЗВУЧИВАНИЯ (speech.js)
   Голосовое сопровождение полностью отключено по запросу пользователя.
   ========================================================================== */

window.SpeechController = (function () {
  if ('speechSynthesis' in window && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}
  }

  return {
    isSupported: () => false,
    speak: () => false,
    pause: () => {},
    resume: () => {},
    stop: () => {},
    setStepText: () => {},
    getStepText: () => '',
    getState: () => 'idle',
    onStateChange: () => {}
  };
})();
