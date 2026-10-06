'use client';

import React, { useEffect, useState } from 'react';

interface NumberTickerProps {
  value: number;
  duration?: number;
  suffix?: string;
  className?: string;
}

export function NumberTicker({ value, duration = 1000, suffix = '', className = '' }: NumberTickerProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const steps = 30;
    const increment = value / steps;
    const intervalTime = duration / steps;

    const timer = setInterval(() => {
      start += increment;
      if (start >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [value, duration]);

  const formatted = new Intl.NumberFormat('fr-FR').format(count);
  return <span className={className}>{formatted}{suffix}</span>;
}
