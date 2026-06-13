import { useEffect, useState } from 'react';

export function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return mobile;
}

export function useIsCoarsePointer() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px), (pointer: coarse)');
    const update = () => setCoarse(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return coarse;
}

export function useDayPhase() {
  const [phase, setPhase] = useState('day');
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 5) setPhase('night');
    else if (hour >= 5 && hour < 12) setPhase('morning');
    else setPhase('day');
  }, []);
  return phase;
}
