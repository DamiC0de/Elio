/**
 * EL-020 — Weather Service (Open-Meteo API)
 * Free, no API key needed
 */

interface WeatherParams {
  city: string;
  days?: number;
}

interface GeoResult {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
}

interface CurrentWeather {
  city: string;
  country: string;
  temperature: number;
  apparent_temperature: number;
  humidity: number;
  wind_speed: number;
  wind_direction: number;
  weather_code: number;
  weather_description: string;
  is_day: boolean;
}

interface DailyForecast {
  date: string;
  temperature_max: number;
  temperature_min: number;
  weather_code: number;
  weather_description: string;
  precipitation_probability: number;
  wind_speed_max: number;
}

// WMO Weather interpretation codes
const WMO_CODES: Record<number, string> = {
  0: 'Ciel dégagé',
  1: 'Principalement dégagé',
  2: 'Partiellement nuageux',
  3: 'Couvert',
  45: 'Brouillard',
  48: 'Brouillard givrant',
  51: 'Bruine légère',
  53: 'Bruine modérée',
  55: 'Bruine dense',
  56: 'Bruine verglaçante légère',
  57: 'Bruine verglaçante dense',
  61: 'Pluie légère',
  63: 'Pluie modérée',
  65: 'Pluie forte',
  66: 'Pluie verglaçante légère',
  67: 'Pluie verglaçante forte',
  71: 'Neige légère',
  73: 'Neige modérée',
  75: 'Neige forte',
  77: 'Grains de neige',
  80: 'Averses légères',
  81: 'Averses modérées',
  82: 'Averses violentes',
  85: 'Averses de neige légères',
  86: 'Averses de neige fortes',
  95: 'Orage',
  96: 'Orage avec grêle légère',
  99: 'Orage avec grêle forte',
};

async function geocode(city: string): Promise<GeoResult> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
  const data = await res.json() as { results?: { name: string; latitude: number; longitude: number; country: string }[] };
  if (!data.results?.length) throw new Error(`Ville introuvable : "${city}"`);
  const r = data.results[0]!;
  return { name: r.name, latitude: r.latitude, longitude: r.longitude, country: r.country };
}

export async function getWeather(params: WeatherParams): Promise<string> {
  const { city, days = 1 } = params;
  const geo = await geocode(city);

  const forecastDays = Math.min(Math.max(days, 1), 7);
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,wind_speed_10m_max&forecast_days=${forecastDays}&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo API error: ${res.status}`);
  const data = await res.json() as {
    current: { temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number; wind_speed_10m: number; wind_direction_10m: number; weather_code: number; is_day: number };
    daily: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; weather_code: number[]; precipitation_probability_max: number[]; wind_speed_10m_max: number[] };
  };

  const current: CurrentWeather = {
    city: geo.name,
    country: geo.country,
    temperature: data.current.temperature_2m,
    apparent_temperature: data.current.apparent_temperature,
    humidity: data.current.relative_humidity_2m,
    wind_speed: data.current.wind_speed_10m,
    wind_direction: data.current.wind_direction_10m,
    weather_code: data.current.weather_code,
    weather_description: WMO_CODES[data.current.weather_code] || 'Inconnu',
    is_day: data.current.is_day === 1,
  };

  const daily: DailyForecast[] = data.daily.time.map((date: string, i: number) => ({
    date,
    temperature_max: data.daily.temperature_2m_max[i],
    temperature_min: data.daily.temperature_2m_min[i],
    weather_code: data.daily.weather_code[i],
    weather_description: WMO_CODES[data.daily.weather_code[i]] || 'Inconnu',
    precipitation_probability: data.daily.precipitation_probability_max[i],
    wind_speed_max: data.daily.wind_speed_10m_max[i],
  }));

  return JSON.stringify({ current, forecast: daily }, null, 2);
}

// Tool definition for Claude
export const weatherTool = {
  name: 'get_weather',
  description: "Obtenir la météo actuelle et les prévisions pour une ville. Utilise cette fonction quand l'utilisateur demande la météo, la température, ou les conditions climatiques.",
  input_schema: {
    type: 'object' as const,
    properties: {
      city: { type: 'string', description: 'Nom de la ville (ex: Paris, Lyon, Marseille)' },
      days: { type: 'number', description: 'Nombre de jours de prévision (1-7, défaut: 1)' },
    },
    required: ['city'],
  },
};
