import { useRef } from 'react';

export function useSound() {
  const audioContext = useRef<AudioContext | null>(null);

  const playBeep = (freq = 400, type: OscillatorType = 'square', duration = 0.05) => {
    try {
      if (!audioContext.current) {
        audioContext.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      if (audioContext.current?.state === 'suspended') {
        audioContext.current.resume();
      }

      const osc = audioContext.current!.createOscillator();
      const gain = audioContext.current!.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioContext.current!.currentTime);
      gain.gain.setValueAtTime(0.1, audioContext.current!.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.current!.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioContext.current!.destination);
      osc.start();
      osc.stop(audioContext.current!.currentTime + duration);
    } catch {
      // Ignore audio errors silently
    }
  };

  const playSuccessSound = () => {
    playBeep(400, 'sine', 0.08);
    setTimeout(() => playBeep(500, 'sine', 0.08), 80);
    setTimeout(() => playBeep(600, 'sine', 0.12), 160);
  };

  const playErrorSound = () => {
    playBeep(300, 'sawtooth', 0.1);
    setTimeout(() => playBeep(200, 'sawtooth', 0.15), 100);
  };

  const playAlertSound = () => {
    playBeep(800, 'square', 0.08);
    setTimeout(() => playBeep(800, 'square', 0.08), 150);
  };

  const playNavigationSound = () => {
    playBeep(600, 'sine', 0.03);
  };

  const playSelectSound = () => {
    playBeep(400, 'square', 0.06);
    setTimeout(() => playBeep(500, 'square', 0.06), 60);
  };

  const playTypeSound = () => {
    playBeep(200, 'square', 0.02);
  };

  return {
    playBeep,
    playSuccessSound,
    playErrorSound,
    playAlertSound,
    playNavigationSound,
    playSelectSound,
    playTypeSound,
  };
}
