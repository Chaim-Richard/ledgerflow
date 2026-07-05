// Exponential Smoothing for Time Series
export function exponentialSmoothing(data: number[], alpha: number): number[] {
  if (data.length === 0) return [];
  const smoothed = [data[0]];
  for (let i = 1; i < data.length; i++) {
    smoothed.push(alpha * data[i] + (1 - alpha) * smoothed[i - 1]);
  }
  return smoothed;
}

// Double Exponential Smoothing (Holt's method) for trending data
export function doubleExponentialSmoothing(data: number[], alpha: number, beta: number, forecastSteps: number): number[] {
  if (data.length === 0) return [];
  
  let level = data[0];
  let trend = data.length > 1 ? data[1] - data[0] : 0;
  
  const smoothed = [level];
  
  for (let i = 1; i < data.length; i++) {
     const lastLevel = level;
     level = alpha * data[i] + (1 - alpha) * (level + trend);
     trend = beta * (level - lastLevel) + (1 - beta) * trend;
     smoothed.push(level);
  }
  
  // Forecast
  const forecast = [];
  for (let i = 1; i <= forecastSteps; i++) {
     forecast.push(level + i * trend);
  }
  
  return forecast;
}
