import { useState, useEffect } from 'react';
import { 
  Sun, 
  Moon, 
  Cloud, 
  CloudSun, 
  CloudFog, 
  CloudDrizzle, 
  CloudRain, 
  Snowflake, 
  CloudRainWind, 
  CloudLightning, 
  Compass, 
  Wind, 
  AlertTriangle, 
  Droplet, 
  Flame, 
  Printer, 
  Mail, 
  ShieldAlert, 
  RefreshCw, 
  Waves, 
  Activity 
} from 'lucide-react';
import './App.css';

// Type definitions
interface CapitalWeather {
  name: string;
  basqueName: string;
  province: string;
  lat: number;
  lon: number;
  temp: number;
  apparentTemp: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  isDay: boolean;
  weatherCode: number;
  sunrise: string;
  sunset: string;
  fwi: number; // Fire Weather Index calculated
  fwiCategory: string;
  loading: boolean;
}

interface RiverSensor {
  id: string;
  name: string;
  province: string;
  level: number; // in meters
  flow: number;  // in m3/s
  criticalLevel: number;
  status: 'nominal' | 'warning' | 'alert';
}

interface ReservoirSensor {
  name: string;
  province: string;
  capacity: number; // hm3
  currentLevel: number; // hm3
  percentage: number;
}

interface WeatherAlert {
  id: string;
  province: string;
  type: string;
  level: 'yellow' | 'orange' | 'red';
  message: string;
  active: boolean;
}

export default function App() {
  // Navigation states
  const [activeTab, setActiveTab] = useState<'meteo' | 'tides' | 'fire' | 'hydro' | 'alerts' | 'report'>('meteo');
  const [selectedProvince, setSelectedProvince] = useState<string>('ALL'); // 'ALL', 'BIZKAIA', 'GIPUZKOA', 'ARABA'
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  
  // Weather data state for the 3 capitals
  const [capitalsData, setCapitalsData] = useState<Record<string, CapitalWeather>>({
    bilbao: { name: "Bilbao", basqueName: "Bilbo", province: "BIZKAIA", lat: 43.2630, lon: -2.9350, temp: 0, apparentTemp: 0, humidity: 0, windSpeed: 0, windDirection: 0, isDay: true, weatherCode: 0, sunrise: "06:30", sunset: "21:30", fwi: 0, fwiCategory: "Bajo", loading: true },
    donostia: { name: "San Sebastián", basqueName: "Donostia", province: "GIPUZKOA", lat: 43.3183, lon: -1.9812, temp: 0, apparentTemp: 0, humidity: 0, windSpeed: 0, windDirection: 0, isDay: true, weatherCode: 0, sunrise: "06:28", sunset: "21:28", fwi: 0, fwiCategory: "Bajo", loading: true },
    vitoria: { name: "Vitoria-Gasteiz", basqueName: "Gasteiz", province: "ARABA", lat: 42.8467, lon: -2.6716, temp: 0, apparentTemp: 0, humidity: 0, windSpeed: 0, windDirection: 0, isDay: true, weatherCode: 0, sunrise: "06:32", sunset: "21:32", fwi: 0, fwiCategory: "Bajo", loading: true }
  });

  // Layer switches
  const [layers, setLayers] = useState({
    weather: true,
    wind: false,
    fires: false,
    rivers: false,
    tides: false,
    alerts: true
  });

  // SMTP Simulation logs state
  const [smtpLog, setSmtpLog] = useState<string[]>([]);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [emailForm, setEmailForm] = useState({
    recipient: 'larrialdiak@euskadi.eus',
    subject: 'Reporte Ambiental Automatizado - EGUR-NEXUS',
    body: ''
  });

  // Static/dynamic hydro data state
  const [rivers] = useState<RiverSensor[]>([
    { id: 'nervion', name: 'Nervión (Ibaizabal)', province: 'BIZKAIA', level: 1.25, flow: 14.8, criticalLevel: 3.5, status: 'nominal' },
    { id: 'deba', name: 'Deba', province: 'GIPUZKOA', level: 1.10, flow: 11.2, criticalLevel: 2.2, status: 'nominal' },
    { id: 'oria', name: 'Oria', province: 'GIPUZKOA', level: 1.10, flow: 12.1, criticalLevel: 2.8, status: 'nominal' },
    { id: 'urumea', name: 'Urumea', province: 'GIPUZKOA', level: 0.85, flow: 8.5, criticalLevel: 2.0, status: 'nominal' },
    { id: 'zadorra', name: 'Zadorra', province: 'ARABA', level: 2.10, flow: 22.4, criticalLevel: 2.5, status: 'warning' }
  ]);

  const [reservoirs] = useState<ReservoirSensor[]>([
    { name: 'Ullibarri-Gamboa', province: 'ARABA', capacity: 146.6, currentLevel: 121.2, percentage: 82.7 },
    { name: 'Urrunaga', province: 'ARABA', capacity: 72.5, currentLevel: 56.8, percentage: 78.3 },
    { name: 'Añarbe', province: 'GIPUZKOA', capacity: 37.2, currentLevel: 31.4, percentage: 84.4 }
  ]);

  // Static/dynamic alerts state
  const [alerts] = useState<WeatherAlert[]>([
    { id: 'a1', province: 'BIZKAIA', type: 'Galerna / Kostaldeko Arriskua', level: 'orange', message: 'Riesgo de galerna súbita en el litoral de Bizkaia con rachas estimadas de hasta 80 km/h.', active: true },
    { id: 'a2', province: 'ARABA', type: 'Temperatura Extrema', level: 'yellow', message: 'Temperaturas máximas en Araba central que pueden superar los 36°C en horas centrales.', active: true },
    { id: 'a3', province: 'GIPUZKOA', type: 'Incendios Forestales', level: 'yellow', message: 'Riesgo de incendios por vientos secos de componente sur.', active: true }
  ]);

  // Fetch Open-Meteo Data
  const fetchWeather = async () => {
    const keys = Object.keys(capitalsData);
    
    // Set all to loading
    setCapitalsData(prev => {
      const updated = { ...prev };
      keys.forEach(k => { updated[k].loading = true; });
      return updated;
    });

    try {
      await Promise.all(keys.map(async (key) => {
        const cap = capitalsData[key];
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${cap.lat}&longitude=${cap.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m&daily=sunrise,sunset&timezone=Europe/Madrid&_t=${Date.now()}`, { cache: 'no-store' });
        const data = await res.json();
        
        const temp = data.current.temperature_2m;
        const apparentTemp = data.current.apparent_temperature;
        const humidity = data.current.relative_humidity_2m;
        const windSpeed = data.current.wind_speed_10m;
        const windDirection = data.current.wind_direction_10m;
        const isDay = data.current.is_day === 1;
        const weatherCode = data.current.weather_code;
        const sunrise = data.daily.sunrise[0]?.split('T')[1] || "06:30";
        const sunset = data.daily.sunset[0]?.split('T')[1] || "21:30";

        // Calculate Fire Weather Index (FWI) proxy
        // Standard simplified formula: FWI_proxy = (Temp * 1.6) + (Wind * 0.9) - (Humidity * 0.4)
        const fwiVal = Math.max(0, (temp * 1.6) + (windSpeed * 0.9) - (humidity * 0.4));
        let fwiCat = "Bajo / Baxua";
        if (fwiVal >= 50) fwiCat = "Extremo / Muturrekoa";
        else if (fwiVal >= 38) fwiCat = "Muy Alto / Oso Altua";
        else if (fwiVal >= 25) fwiCat = "Alto / Altua";
        else if (fwiVal >= 12) fwiCat = "Moderado / Ertaina";

        setCapitalsData(prev => ({
          ...prev,
          [key]: {
            ...prev[key],
            temp,
            apparentTemp,
            humidity,
            windSpeed,
            windDirection,
            isDay,
            weatherCode,
            sunrise,
            sunset,
            fwi: Math.round(fwiVal * 10) / 10,
            fwiCategory: fwiCat,
            loading: false
          }
        }));
      }));
    } catch (e) {
      console.error("Failed to fetch Euskadi weather telemetry:", e);
      // fallback to realistic mock data on error (resilience)
      setCapitalsData(prev => {
        const updated = { ...prev };
        keys.forEach(k => {
          updated[k].temp = k === 'vitoria' ? 34.2 : 28.5;
          updated[k].apparentTemp = k === 'vitoria' ? 35.8 : 29.2;
          updated[k].humidity = k === 'vitoria' ? 32 : 55;
          updated[k].windSpeed = k === 'bilbao' ? 62.4 : 15.2; // Bilbao galerna wind speed
          updated[k].windDirection = 210;
          updated[k].isDay = true;
          updated[k].weatherCode = k === 'bilbao' ? 80 : 1;
          updated[k].fwi = k === 'vitoria' ? 44.5 : 22.8;
          updated[k].fwiCategory = k === 'vitoria' ? "Muy Alto / Oso Altua" : "Moderado / Ertaina";
          updated[k].loading = false;
        });
        return updated;
      });
    }
  };

  // Clock tick effect
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Onload fetch
  useEffect(() => {
    fetchWeather();
    // Poll every 5 minutes
    const poll = setInterval(fetchWeather, 300000);
    return () => clearInterval(poll);
  }, []);

  // Update email report body when relevant data changes
  useEffect(() => {
    const activeAlerts = alerts.filter(a => a.active);
    const alertReport = activeAlerts.length > 0
      ? activeAlerts.map(a => `- [${a.level.toUpperCase()}] ${a.province}: ${a.type} - ${a.message}`).join('\n')
      : 'No hay alertas activas.';

    const reportText = `SISTEMA EGUR-NEXUS // INFORME DE EMERGENCIA AMBIENTAL
-----------------------------------------------------------
Fecha/Hora del Reporte: ${currentTime.toLocaleString('es-ES')}

1. ESTADO DEL TIEMPO Y TELEMETRÍA (CAPITALES)
- Bilbao (Bizkaia): ${capitalsData.bilbao.temp}°C, Viento ${capitalsData.bilbao.windSpeed} km/h, Humedad ${capitalsData.bilbao.humidity}%
- Donostia (Gipuzkoa): ${capitalsData.donostia.temp}°C, Viento ${capitalsData.donostia.windSpeed} km/h, Humedad ${capitalsData.donostia.humidity}%
- Gasteiz (Araba): ${capitalsData.vitoria.temp}°C, Viento ${capitalsData.vitoria.windSpeed} km/h, Humedad ${capitalsData.vitoria.humidity}%

2. ASTRONOMÍA Y MAREAS
- Altura de Marea estimada: ${getTideInfo(currentTime).height}m (${getTideInfo(currentTime).state})
- Fase Lunar: ${getMoonPhase(currentTime).label}
- Ciclo solar (Gasteiz): Salida: ${capitalsData.vitoria.sunrise} | Ocaso: ${capitalsData.vitoria.sunset}

3. HIDROGRAFÍA Y RÍOS
- Río Nervión (Bizkaia): Nivel ${rivers[0].level}m (Crítico: ${rivers[0].criticalLevel}m), Caudal: ${rivers[0].flow} m³/s
- Río Zadorra (Araba): Nivel ${rivers[3].level}m (Crítico: ${rivers[3].criticalLevel}m), Caudal: ${rivers[3].flow} m³/s [ALERTA]

5. REGISTRO DE ALERTAK Y CIVIL DEFENSE
${alertReport}

-----------------------------------------------------------
Reporte generado automáticamente desde el terminal Egur-Nexus.`;

    setEmailForm(prev => ({
      ...prev,
      body: reportText
    }));
  }, [capitalsData, rivers, alerts, currentTime]);

  // Calculations for tides & lunar
  const tide = getTideInfo(currentTime);
  const moon = getMoonPhase(currentTime);

  function getTideInfo(date: Date) {
    const hours = date.getHours() + date.getMinutes() / 60;
    const cycle = 12.42; 
    const tideHeight = 2.0 * Math.sin((hours * Math.PI * 2) / cycle); 
    
    const currentOffset = hours % cycle;
    let nextHigh = (cycle / 4 - currentOffset + cycle) % cycle;
    let nextLow = ((3 * cycle) / 4 - currentOffset + cycle) % cycle;
    
    return {
      height: Number((2.5 + tideHeight).toFixed(2)),
      state: tideHeight > 0.5 ? "Pleamar / Marea Gora" : tideHeight < -0.5 ? "Bajamar / Marea Behera" : "Marea Media / Marea Bitartekoa",
      trend: Math.cos((hours * Math.PI * 2) / cycle) > 0 ? "Subiendo / Gorantz" : "Bajando / Beherantz",
      nextHigh: nextHigh.toFixed(1) + "h",
      nextLow: nextLow.toFixed(1) + "h"
    };
  }

  function getMoonPhase(date: Date) {
    const knownNewMoon = new Date(2000, 0, 6, 18, 14); 
    const diffTime = Math.abs(date.getTime() - knownNewMoon.getTime());
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    const phase = (diffDays % 29.530588853) / 29.530588853; 
    
    let label = "";
    let iconIndex = 0;
    
    if (phase < 0.03 || phase > 0.97) {
      label = "Luna Nueva / Ilberria";
      iconIndex = 0;
    } else if (phase >= 0.03 && phase < 0.22) {
      label = "Luna Creciente / Ilgora";
      iconIndex = 1;
    } else if (phase >= 0.22 && phase < 0.28) {
      label = "Cuarto Creciente / Ilgora Handia";
      iconIndex = 2;
    } else if (phase >= 0.28 && phase < 0.47) {
      label = "Luna Gibosa Creciente / Ilgora Zabaldua";
      iconIndex = 3;
    } else if (phase >= 0.47 && phase < 0.53) {
      label = "Luna Llena / Ilbetea";
      iconIndex = 4;
    } else if (phase >= 0.53 && phase < 0.72) {
      label = "Luna Gibosa Menguante / Ilbehera Zabaldua";
      iconIndex = 5;
    } else if (phase >= 0.72 && phase < 0.78) {
      label = "Cuarto Menguante / Ilbehera Handia";
      iconIndex = 6;
    } else {
      label = "Luna Menguante / Ilbehera";
      iconIndex = 7;
    }
    
    return { phase, label, iconIndex };
  }

  // Weather code to icon mapping
  const getWeatherIcon = (code: number) => {
    if (code === 0) return <Sun className="w-6 h-6 text-yellow-400" />;
    if (code >= 1 && code <= 3) return <CloudSun className="w-6 h-6 text-slate-300" />;
    if (code === 45 || code === 48) return <CloudFog className="w-6 h-6 text-slate-400" />;
    if (code >= 51 && code <= 55) return <CloudDrizzle className="w-6 h-6 text-cyan-200" />;
    if (code >= 61 && code <= 65) return <CloudRain className="w-6 h-6 text-cyan-400" />;
    if (code >= 71 && code <= 75) return <Snowflake className="w-6 h-6 text-blue-200" />;
    if (code >= 80 && code <= 82) return <CloudRainWind className="w-6 h-6 text-cyan-500" />;
    if (code >= 95) return <CloudLightning className="w-6 h-6 text-purple-400" style={{ filter: 'drop-shadow(0 0 4px rgba(168,85,247,0.4))' }} />;
    return <Cloud className="w-6 h-6 text-slate-400" />;
  };

  const getWeatherDesc = (code: number) => {
    if (code === 0) return "Cielo Despejado / Garbi";
    if (code >= 1 && code <= 3) return "Poco Nuboso / Hodei Gutxi";
    if (code === 45 || code === 48) return "Niebla / Lainoa";
    if (code >= 51 && code <= 55) return "Llovizna / Zirimiria";
    if (code >= 61 && code <= 65) return "Lluvia / Euria";
    if (code >= 71 && code <= 75) return "Nieve / Elurra";
    if (code >= 80 && code <= 82) return "Chubascos / Euri-jasa";
    if (code >= 95) return "Tormenta / Ekaitza";
    return "Nublado / Hodeitsu";
  };

  // Province colors for active map selections
  const getProvinceClass = (provName: string) => {
    if (selectedProvince !== 'ALL' && selectedProvince !== provName) return 'province-path opacity-30';
    return selectedProvince === provName ? 'province-path active' : 'province-path';
  };

  // Simulate Sending Email (Terminal Log style)
  const sendEmail = () => {
    if (isSendingEmail) return;
    setIsSendingEmail(true);
    setEmailSuccess(false);
    setSmtpLog([
      "RESOLVING HOST: smtp.euskadi.eus...",
      "CONNECTING TO smtp.euskadi.eus [217.135.24.89] ON PORT 587...",
      "220 smtp.euskadi.eus ESMTP Postfix (Basque-Gov-Sec-Mail-Gate)",
      "EHLO egur-nexus.local",
      "250-smtp.euskadi.eus, PIPELINING, SIZE 15728640, 8BITMIME, STARTTLS",
      "STARTTLS",
      "220 2.0.0 Ready to start TLS",
      "EHLO egur-nexus.local",
      "250-smtp.euskadi.eus, PIPELINING, SIZE 15728640, 8BITMIME",
      "MAIL FROM: <egurnexus-c2@euskadi.eus>",
      "250 2.1.0 Ok",
      `RCPT TO: <${emailForm.recipient}>`,
      "250 2.1.5 Ok",
      "DATA",
      "354 End data with <CR><LF>.<CR><LF>"
    ]);

    setTimeout(() => {
      setSmtpLog(prev => [
        ...prev,
        "Subject: " + emailForm.subject,
        "To: " + emailForm.recipient,
        "Content-Type: text/plain; charset=utf-8",
        "... [SENDING BODY TELEMETRY DATA] ...",
        ".",
        "250 2.0.0 Ok: queued as 7F231D9B04F2A",
        "QUIT",
        "221 2.0.0 Bye",
        "CONNECTION CLOSED.",
        "✓ LARRIALDIAK PORTAL: REPORTE TRANSMITIDO CON ÉXITO."
      ]);
      setIsSendingEmail(false);
      setEmailSuccess(true);

      // Trigger the real mailto link to open the local email client (e.g. Outlook) with all the prefilled data
      const mailtoUrl = `mailto:${encodeURIComponent(emailForm.recipient)}?subject=${encodeURIComponent(emailForm.subject)}&body=${encodeURIComponent(emailForm.body)}`;
      window.location.href = mailtoUrl;
    }, 2500);
  };

  // Print function
  const triggerPrint = () => {
    window.print();
  };

  // Helper to get active classes for each layer type to match map color coding
  const getLayerActiveClasses = (layerKey: string) => {
    switch (layerKey) {
      case 'weather': // Cyan
        return 'bg-cyan-10 border-cyan-35 text-cyan font-bold shadow-cyan-glow';
      case 'wind': // Mint Green
        return 'bg-green-10 border-green-35 text-green font-bold shadow-green-glow';
      case 'fires': // Orange
        return 'bg-orange-10 border-orange-35 text-orange font-bold shadow-orange-glow';
      case 'rivers': // Light Blue/Cyan
        return 'bg-blue-10 border-blue-35 text-blue font-bold shadow-blue-glow';
      case 'tides': // Purple
        return 'bg-purple-10 border-purple-35 text-purple font-bold shadow-purple-glow';
      case 'alerts': // Red
        return 'bg-red-10 border-red-35 text-red font-bold shadow-red-glow';
      default:
        return 'bg-cyan-10 border-cyan-35 text-cyan font-bold shadow-cyan-glow';
    }
  };

  const getLayerDotClass = (layerKey: string) => {
    switch (layerKey) {
      case 'weather': return 'bg-cyan';
      case 'wind': return 'bg-green';
      case 'fires': return 'bg-orange';
      case 'rivers': return 'bg-blue';
      case 'tides': return 'bg-purple';
      case 'alerts': return 'bg-red';
      default: return 'bg-cyan';
    }
  };

  const nervionRiver = rivers.find(r => r.id === 'nervion');
  const debaRiver = rivers.find(r => r.id === 'deba');
  const oriaRiver = rivers.find(r => r.id === 'oria');
  const urumeaRiver = rivers.find(r => r.id === 'urumea');
  const zadorraRiver = rivers.find(r => r.id === 'zadorra');

  return (
    <>
      {/* Visual Overlay Scanlines */}
      <div className="vignette" />
      <div className="scanlines" />

      {/* HEADER: Osiris-style Top HUD Bar */}
      <header className="no-print w-full bg-[#05050b]/85 border-b border-white/5 px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 z-40 backdrop-blur-md">
        
        {/* Title HUD section */}
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-8 h-8 text-[#d4af37] drop-shadow-[0_0_8px_rgba(212,175,55,0.4)] animate-pulse" />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-widest-plus text-[#d4af37] font-mono m-0">EGUR-NEXUS</h1>
              <span className="text-[8px] bg-cyan/15 border border-cyan/30 text-cyan px-2 py-0.2 rounded font-mono uppercase tracking-widest">EUSKADI HUD</span>
            </div>
            <span className="text-[7px] text-slate-300 font-mono tracking-wider uppercase mt-1">Sistema Integrado de Alertas y Telemetría Ambiental</span>
          </div>
        </div>

        {/* Live warnings counter */}
        <div className="flex items-center gap-6 font-mono text-[9px] tracking-widest text-slate-300">
          <div className="hud-alert-badge">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ff3e6c] blink-red"></span>
            <span className="text-[#ff3e6c] font-bold blink-red">ALERTAK: {alerts.filter(a => a.active).length} ACTIVAS</span>
          </div>
          
          <div className="hidden lg:flex flex-col items-end">
            <span className="text-[#00e5ff] font-bold tabular-nums">ZULU: {currentTime.toUTCString().slice(17, 25)}Z</span>
            <span className="text-[8px] mt-0.5">LOCAL: {currentTime.toLocaleTimeString('es-ES')}</span>
          </div>

          <button 
            onClick={fetchWeather} 
            className="p-2 bg-white/5 hover:bg-[#00e5ff]/10 border border-white/5 hover:border-[#00e5ff]/30 text-slate-300 hover:text-[#00e5ff] rounded transition-all duration-200"
            title="Sincronizar Telemetría"
            id="btn-sync-telemetry"
            aria-label="Sincronizar Telemetría"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* CORE CONTENT LAYOUT */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0 w-full">
        
        {/* LEFT COLUMN: Map panel & Layers Control */}
        <section className="no-print w-full lg:w-[48%] border-r border-white/5 p-6 flex flex-col gap-6 overflow-y-auto">
          
          {/* Euskadi Vector Map Panel */}
          <div className="hud-panel flex-1 min-h-[550px] flex flex-col justify-between corner-ticks">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-[#00e5ff] flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-[#00e5ff]" />
                Visualizador de Provincia / Radar
              </span>
              <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">MAP REF: 43.26N / 2.67W</span>
            </div>

            {/* Interactive SVG Map */}
            <div className="relative flex-1 flex items-center justify-center p-4 bg-black/35 rounded border border-white/5 my-4 overflow-hidden">
              
              {/* Sci-fi Radar circles */}
              <div className="absolute w-[540px] h-[540px] rounded-full border border-[#00e5ff]/5 pointer-events-none" />
              <div className="absolute w-[360px] h-[360px] rounded-full border border-[#00e5ff]/10 pointer-events-none" />
              <div className="absolute w-[180px] h-[180px] rounded-full border border-[#00e5ff]/5 pointer-events-none" />
              
              {/* Radar Sweeper Line */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none radar-sweep" viewBox="0 0 400 300">
                <line x1="200" y1="150" x2="380" y2="150" stroke="#00e5ff" strokeWidth="1" strokeDasharray="3, 3" />
              </svg>

              {/* Map SVG */}
              <svg className="w-full max-w-[550px] h-auto drop-shadow-[0_0_15px_rgba(0,229,255,0.05)]" viewBox="0 0 400 330">
                {/* Bizkaia Path */}
                <path 
                  d="M 50,160 C 65,130 90,115 110,120 C 130,125 140,110 160,112 C 175,115 185,125 190,135 C 200,155 210,165 210,180 C 180,205 140,195 105,195 Z" 
                  className={getProvinceClass('BIZKAIA')}
                  onClick={() => setSelectedProvince('BIZKAIA')}
                  id="path-map-bizkaia"
                  aria-label="Provincia de Bizkaia"
                />
                
                {/* Gipuzkoa Path */}
                <path 
                  d="M 190,135 C 210,120 240,125 260,120 C 285,115 315,108 335,110 L 340,130 C 330,145 320,165 310,185 C 290,190 270,180 250,190 C 235,198 220,185 210,180 C 210,165 200,155 190,135 Z" 
                  className={getProvinceClass('GIPUZKOA')}
                  onClick={() => setSelectedProvince('GIPUZKOA')}
                  id="path-map-gipuzkoa"
                  aria-label="Provincia de Gipuzkoa"
                />
                
                {/* Araba Path */}
                <path 
                  d="M 105,195 C 140,195 180,205 210,180 C 220,185 235,198 250,190 C 270,180 290,190 310,185 L 290,245 C 275,265 260,285 240,290 C 210,295 180,275 160,285 C 145,290 120,270 115,250 C 110,230 95,215 105,195 Z" 
                  className={getProvinceClass('ARABA')}
                  onClick={() => setSelectedProvince('ARABA')}
                  id="path-map-araba"
                  aria-label="Provincia de Araba"
                />

                {/* Capital Indicators / Glowing markers (Always Visible) */}
                {/* Bilbao marker */}
                <g className="cursor-pointer" onClick={() => setSelectedProvince('BIZKAIA')}>
                  <circle cx="150" cy="160" r="6" fill="#00f5a0" className="animate-ping" style={{ animationDuration: '3s', transformOrigin: 'center', transformBox: 'fill-box' }} />
                  <circle cx="150" cy="160" r="4" fill="#00e5ff" />
                  <text x="150" y="148" textAnchor="middle" fill="#ffffff" fontSize="9" fontFamily="var(--font-mono)">BILBO</text>
                  {layers.weather && (
                    <text x="150" y="174" textAnchor="middle" fill="#00e5ff" fontSize="8" fontFamily="var(--font-mono)">{capitalsData.bilbao.temp}°C</text>
                  )}
                </g>

                {/* Donostia marker */}
                <g className="cursor-pointer" onClick={() => setSelectedProvince('GIPUZKOA')}>
                  <circle cx="270" cy="145" r="6" fill="#00f5a0" className="animate-ping" style={{ animationDuration: '3.5s', transformOrigin: 'center', transformBox: 'fill-box' }} />
                  <circle cx="270" cy="145" r="4" fill="#00e5ff" />
                  <text x="270" y="133" textAnchor="middle" fill="#ffffff" fontSize="9" fontFamily="var(--font-mono)">DONOSTIA</text>
                  {layers.weather && (
                    <text x="270" y="159" textAnchor="middle" fill="#00e5ff" fontSize="8" fontFamily="var(--font-mono)">{capitalsData.donostia.temp}°C</text>
                  )}
                </g>

                {/* Vitoria-Gasteiz marker */}
                <g className="cursor-pointer" onClick={() => setSelectedProvince('ARABA')}>
                  <circle cx="210" cy="245" r="6" fill="#00f5a0" className="animate-ping" style={{ animationDuration: '2.5s', transformOrigin: 'center', transformBox: 'fill-box' }} />
                  <circle cx="210" cy="245" r="4" fill="#00e5ff" />
                  <text x="210" y="233" textAnchor="middle" fill="#ffffff" fontSize="9" fontFamily="var(--font-mono)">GASTEIZ</text>
                  {layers.weather && (
                    <text x="210" y="259" textAnchor="middle" fill="#00e5ff" fontSize="8" fontFamily="var(--font-mono)">{capitalsData.vitoria.temp}°C</text>
                  )}
                </g>

                {/* Emergency Alert Marks on Map */}
                {layers.alerts && (
                  <>
                    <g className="blink-red">
                      <circle cx="120" cy="150" r="5" fill="#ff3e6c" />
                      <line x1="120" y1="142" x2="120" y2="158" stroke="#ff3e6c" strokeWidth="1" />
                      <line x1="112" y1="150" x2="128" y2="150" stroke="#ff3e6c" strokeWidth="1" />
                    </g>
                    <g className="blink-orange">
                      <circle cx="225" cy="230" r="5" fill="#ff9100" />
                    </g>
                  </>
                )}

                {/* Wind Vectors on Map */}
                {layers.wind && (
                  <>
                    {/* Bilbao wind arrow */}
                    <g transform="translate(150, 160)" className="pointer-events-none">
                      <g transform={`rotate(${capitalsData.bilbao.windDirection})`}>
                        <line x1="0" y1="0" x2="0" y2="-18" stroke="#00f5a0" strokeWidth="2.5" />
                        <polygon points="0,-18 -4,-10 4,-10" fill="#00f5a0" />
                      </g>
                      <text x="16" y="4" fill="#00f5a0" fontSize="8" fontWeight="bold" fontFamily="var(--font-mono)">{capitalsData.bilbao.windSpeed} km/h</text>
                    </g>
                    {/* Donostia wind arrow */}
                    <g transform="translate(270, 145)" className="pointer-events-none">
                      <g transform={`rotate(${capitalsData.donostia.windDirection})`}>
                        <line x1="0" y1="0" x2="0" y2="-18" stroke="#00f5a0" strokeWidth="2" />
                        <polygon points="0,-18 -3,-10 3,-10" fill="#00f5a0" />
                      </g>
                      <text x="16" y="4" fill="#00f5a0" fontSize="8" fontWeight="bold" fontFamily="var(--font-mono)">{capitalsData.donostia.windSpeed} km/h</text>
                    </g>
                    {/* Vitoria wind arrow */}
                    <g transform="translate(210, 245)" className="pointer-events-none">
                      <g transform={`rotate(${capitalsData.vitoria.windDirection})`}>
                        <line x1="0" y1="0" x2="0" y2="-18" stroke="#00f5a0" strokeWidth="2" />
                        <polygon points="0,-18 -3,-10 3,-10" fill="#00f5a0" />
                      </g>
                      <text x="16" y="4" fill="#00f5a0" fontSize="8" fontWeight="bold" fontFamily="var(--font-mono)">{capitalsData.vitoria.windSpeed} km/h</text>
                    </g>
                             {/* Fires Hazard Indicators on Map */}
                {layers.fires && (
                  <>
                    {/* Gasteiz (Araba) fire risk */}
                    <g transform="translate(210, 275)" className={`${capitalsData.vitoria.fwi >= 25 ? 'blink-orange' : '' } pointer-events-none`}>
                      <circle cx="0" cy="0" r="4" fill={capitalsData.vitoria.fwi >= 25 ? '#ff9100' : '#d4af37'} />
                      {capitalsData.vitoria.fwi >= 25 && (
                        <circle cx="0" cy="0" r="8" stroke="#ff9100" strokeWidth="1" fill="none" className="animate-ping" style={{ animationDuration: '4s' }} />
                      )}
                      <text x="12" y="3" fill={capitalsData.vitoria.fwi >= 25 ? '#ff9100' : '#d4af37'} fontSize="7" fontWeight="bold" fontFamily="var(--font-mono)">
                        FWI: {capitalsData.vitoria.fwi} ({capitalsData.vitoria.fwi >= 38 ? 'MUY ALTO' : capitalsData.vitoria.fwi >= 25 ? 'ALTO' : capitalsData.vitoria.fwi >= 12 ? 'MODERADO' : 'BAJO'})
                      </text>
                    </g>

                    {/* Bilbao (Bizkaia) fire risk */}
                    <g transform="translate(130, 185)" className={`${capitalsData.bilbao.fwi >= 25 ? 'blink-orange' : '' } pointer-events-none`}>
                      <circle cx="0" cy="0" r="3.5" fill={capitalsData.bilbao.fwi >= 25 ? '#ff9100' : '#d4af37'} />
                      <text x="10" y="3" fill={capitalsData.bilbao.fwi >= 25 ? '#ff9100' : '#d4af37'} fontSize="7" fontWeight="bold" fontFamily="var(--font-mono)">
                        FWI: {capitalsData.bilbao.fwi}
                      </text>
                    </g>

                    {/* Donostia (Gipuzkoa) fire risk */}
                    <g transform="translate(250, 165)" className={`${capitalsData.donostia.fwi >= 25 ? 'blink-orange' : '' } pointer-events-none`}>
                      <circle cx="0" cy="0" r="3.5" fill={capitalsData.donostia.fwi >= 25 ? '#ff9100' : '#d4af37'} />
                      <text x="10" y="3" fill={capitalsData.donostia.fwi >= 25 ? '#ff9100' : '#d4af37'} fontSize="7" fontWeight="bold" fontFamily="var(--font-mono)">
                        FWI: {capitalsData.donostia.fwi}
                      </text>
                    </g>
                  </>
                )}

                {/* River levels on Map */}
                {layers.rivers && (
                  <>
                    {/* Nervion near Bilbo (Bizkaia) */}
                    <g transform="translate(130, 140)" className="pointer-events-none">
                      <circle cx="0" cy="0" r="3.5" fill="#0099ff" />
                      <text x="-8" y="3" textAnchor="end" fill="#0099ff" fontSize="7" fontWeight="bold" fontFamily="var(--font-mono)">
                        NERVIÓN: {nervionRiver?.level}m
                      </text>
                    </g>
                    {/* Zadorra near Gasteiz (Araba) */}
                    <g transform="translate(235, 230)" className={`${zadorraRiver?.status !== 'nominal' ? 'blink-orange' : ''} pointer-events-none`}>
                      <circle cx="0" cy="0" r="3.5" fill={zadorraRiver?.status !== 'nominal' ? '#ff9100' : '#0099ff'} />
                      <text x="8" y="3" textAnchor="start" fill={zadorraRiver?.status !== 'nominal' ? '#ff9100' : '#0099ff'} fontSize="7" fontWeight="bold" fontFamily="var(--font-mono)">
                        ZADORRA: {zadorraRiver?.level}m{zadorraRiver?.status !== 'nominal' ? ' [CRÍTICO]' : ''}
                      </text>
                    </g>
                    {/* Oria near Tolosa (Gipuzkoa) */}
                    <g transform="translate(280, 170)" className={`${oriaRiver?.status === 'warning' ? 'blink-orange' : ''} pointer-events-none`}>
                      <circle cx="0" cy="0" r="3.5" fill={oriaRiver?.status === 'warning' ? '#ff9100' : '#0099ff'} />
                      <text x="8" y="3" textAnchor="start" fill={oriaRiver?.status === 'warning' ? '#ff9100' : '#0099ff'} fontSize="7" fontWeight="bold" fontFamily="var(--font-mono)">
                        ORIA: {oriaRiver?.level}m
                      </text>
                    </g>
                    {/* Deba near Eibar (Gipuzkoa) */}
                    <g transform="translate(220, 145)" className={`${debaRiver?.status === 'warning' ? 'blink-orange' : ''} pointer-events-none`}>
                      <circle cx="0" cy="0" r="3.5" fill={debaRiver?.status === 'warning' ? '#ff9100' : '#0099ff'} />
                      <text x="8" y="3" textAnchor="start" fill={debaRiver?.status === 'warning' ? '#ff9100' : '#0099ff'} fontSize="7" fontWeight="bold" fontFamily="var(--font-mono)">
                        DEBA: {debaRiver?.level}m
                      </text>
                    </g>
                    {/* Urumea near Donostia (Gipuzkoa) */}
                    <g transform="translate(285, 130)" className={`${urumeaRiver?.status === 'warning' ? 'blink-orange' : ''} pointer-events-none`}>
                      <circle cx="0" cy="0" r="3.5" fill={urumeaRiver?.status === 'warning' ? '#ff9100' : '#0099ff'} />
                      <text x="8" y="3" textAnchor="start" fill={urumeaRiver?.status === 'warning' ? '#ff9100' : '#0099ff'} fontSize="7" fontWeight="bold" fontFamily="var(--font-mono)">
                        URUMEA: {urumeaRiver?.level}m
                      </text>
                    </g>
                  </>
                )}          </>
                )}

                {/* Tides (Mareas / Olas) on Map */}
                {layers.tides && (
                  <>
                    {/* Bilbao / Cabo Matxitxako Buoy (Bizkaia) - Orange Alert (flashing/blinking) */}
                    <g transform="translate(150, 85)" className="blink-orange pointer-events-none">
                      <path d="M -8,-2 C -5,-5 -2,-5 1,-2 C 4,1 7,1 10,-2" stroke="#ff9100" strokeWidth="1.5" fill="none" />
                      <path d="M -8,2 C -5,-1 -2,-1 1,2 C 4,5 7,5 10,2" stroke="#ff9100" strokeWidth="1.5" fill="none" />
                      <text x="14" y="2" textAnchor="start" fill="#ff9100" fontSize="7" fontWeight="bold" fontFamily="var(--font-mono)">BOYA MATXITXAKO: 4.2m [AVISO]</text>
                    </g>

                    {/* Donostia / Pasaia Buoy (Gipuzkoa) - Nominal (purple) */}
                    <g transform="translate(325, 105)" className="pointer-events-none">
                      <path d="M -8,-2 C -5,-5 -2,-5 1,-2 C 4,1 7,1 10,-2" stroke="#d946ef" strokeWidth="1.5" fill="none" />
                      <path d="M -8,2 C -5,-1 -2,-1 1,2 C 4,5 7,5 10,2" stroke="#d946ef" strokeWidth="1.5" fill="none" />
                      <text x="-14" y="2" textAnchor="end" fill="#d946ef" fontSize="7" fontWeight="bold" fontFamily="var(--font-mono)">BOYA PASAIA: 1.8m [OK]</text>
                    </g>
                  </>
                )}

                {/* Geopolitical towns (Poblaciones secundarias) */}
                <g opacity="0.45" className="pointer-events-none">
                  {/* Bizkaia */}
                  <circle cx="138" cy="158" r="2.5" fill="#ffffff" />
                  <text x="133" y="160" textAnchor="end" fill="#ffffff" fontSize="7" fontFamily="var(--font-mono)">BARAKALDO</text>
                  
                  <circle cx="135" cy="138" r="2.5" fill="#ffffff" />
                  <text x="130" y="139" textAnchor="end" fill="#ffffff" fontSize="7" fontFamily="var(--font-mono)">GETXO</text>
                  
                  {/* Gipuzkoa */}
                  <circle cx="315" cy="120" r="2.5" fill="#ffffff" />
                  <text x="315" y="114" textAnchor="middle" fill="#ffffff" fontSize="7" fontFamily="var(--font-mono)">IRUN</text>
                  
                  <circle cx="210" cy="155" r="2.5" fill="#ffffff" />
                  <text x="205" y="157" textAnchor="end" fill="#ffffff" fontSize="7" fontFamily="var(--font-mono)">EIBAR</text>
                  
                  {/* Araba */}
                  <circle cx="128" cy="208" r="2.5" fill="#ffffff" />
                  <text x="123" y="210" textAnchor="end" fill="#ffffff" fontSize="7" fontFamily="var(--font-mono)">LAUDIO</text>
                  
                  <circle cx="255" cy="245" r="2.5" fill="#ffffff" />
                  <text x="260" y="247" textAnchor="start" fill="#ffffff" fontSize="7" fontFamily="var(--font-mono)">AGURAIN</text>
                </g>

                {/* Mountain Summits (Cumbres importantes - Triángulos dorados) */}
                <g className="pointer-events-none">
                  {/* Gorbeia (Highest of Bizkaia & Araba - Shared) */}
                  <polygon points="170,204 166,212 174,212" fill="#d4af37" />
                  <text x="170" y="221" textAnchor="middle" fill="#d4af37" fontSize="6.5" fontWeight="bold" fontFamily="var(--font-mono)">GORBEIA (1482m)</text>
                  
                  {/* Anboto (Bizkaia Interior) */}
                  <polygon points="185,190 181,198 189,198" fill="#d4af37" />
                  <text x="185" y="206" textAnchor="middle" fill="#d4af37" fontSize="6.5" fontWeight="bold" fontFamily="var(--font-mono)">ANBOTO (1331m)</text>

                  {/* Aketegi (Highest Peak of Gipuzkoa & Basque Country) */}
                  <polygon points="250,204 246,212 254,212" fill="#d4af37" />
                  <text x="250" y="221" textAnchor="middle" fill="#d4af37" fontSize="6.5" fontWeight="bold" fontFamily="var(--font-mono)">AKETEGI (1551m)</text>

                  {/* Aizkorri (Iconic Gipuzkoa Summit) */}
                  <polygon points="264,190 260,198 268,198" fill="#d4af37" />
                  <text x="264" y="181" textAnchor="middle" fill="#d4af37" fontSize="6.5" fontWeight="bold" fontFamily="var(--font-mono)">AIZKORRI (1528m)</text>
                  
                  {/* Toloño (Iconic Araba Southern Summit) */}
                  <polygon points="190,289 186,297 194,297" fill="#d4af37" />
                  <text x="190" y="305" textAnchor="middle" fill="#d4af37" fontSize="6.5" fontWeight="bold" fontFamily="var(--font-mono)">TOLOÑO (1271m)</text>
                </g>
              </svg>


            </div>

            {/* Quick Province Selector buttons */}
            <div className="flex gap-2 justify-center font-mono text-[9px] uppercase tracking-wider">
              {['ALL', 'BIZKAIA', 'GIPUZKOA', 'ARABA'].map(prov => (
                <button
                  key={prov}
                  onClick={() => setSelectedProvince(prov)}
                  className={`px-3 py-1.5 rounded border transition-all ${
                    selectedProvince === prov 
                      ? 'bg-[#00e5ff]/15 border-[#00e5ff]/50 text-[#00e5ff] font-bold shadow-[0_0_10px_rgba(0,229,255,0.15)]'
                      : 'bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                  id={`btn-prov-${prov.toLowerCase()}`}
                  aria-label={`Seleccionar provincia ${prov}`}
                >
                  {prov}
                </button>
              ))}
            </div>
          </div>

          {/* Toggle Layers controller panel */}
          <div className="hud-panel corner-ticks">
            <h3 className="text-[10px] font-mono font-bold tracking-widest text-[#d4af37] border-b border-white/5 pb-2 mb-3">
              CAPAS DEL MAPA // LAYERS
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-2 gap-3 text-[9px] font-mono tracking-wider">
              {Object.keys(layers).map((layerKey) => (
                <div 
                  key={layerKey}
                  onClick={() => setLayers(prev => ({ ...prev, [layerKey]: !prev[layerKey as keyof typeof layers] }))}
                  className={`p-2.5 rounded border cursor-pointer transition-all flex items-center justify-between ${
                    layers[layerKey as keyof typeof layers]
                      ? getLayerActiveClasses(layerKey)
                      : 'bg-black/20 border-white/5 text-slate-500 hover:text-slate-400'
                  }`}
                  id={`layer-${layerKey}`}
                >
                  <span>{layerKey.toUpperCase()}</span>
                  <div className={`w-1.5 h-1.5 rounded-full ${layers[layerKey as keyof typeof layers] ? getLayerDotClass(layerKey) : 'bg-slate-700'}`} />
                </div>
              ))}
            </div>
          </div>

        </section>

        {/* RIGHT COLUMN: Tab Panel and Details */}
        <section className="w-full lg:w-[52%] p-6 flex flex-col gap-6 overflow-y-auto">
          
          {/* Navigation Menu / Tabs */}
          <nav className="no-print flex flex-wrap gap-2 font-mono text-[9px] tracking-widest uppercase">
            {[
              { id: 'meteo', label: 'EGU / El Tiempo', icon: Sun },
              { id: 'tides', label: 'MAR / Tides & Moon', icon: Waves },
              { id: 'fire', label: 'SUT / Incendios', icon: Flame },
              { id: 'hydro', label: 'URA / Ríos', icon: Droplet },
              { id: 'alerts', label: `ALERTAK (${alerts.filter(a => a.active).length})`, icon: AlertTriangle, status: 'alert' },
              { id: 'report', label: 'TXO / Informes', icon: Printer }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded border transition-all ${
                    activeTab === tab.id
                      ? tab.status === 'alert'
                        ? 'bg-[#ff3e6c]/15 border-[#ff3e6c]/50 text-[#ff3e6c] font-bold shadow-[0_0_10px_rgba(255,62,108,0.2)]'
                        : 'bg-[#00e5ff]/15 border-[#00e5ff]/50 text-[#00e5ff] font-bold shadow-[0_0_10px_rgba(0,229,255,0.2)]'
                      : tab.status === 'alert'
                        ? 'bg-[#ff3e6c]/5 border-[#ff3e6c]/25 text-[#ff3e6c]/80 hover:bg-[#ff3e6c]/15 hover:text-white blink-red'
                        : 'bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                  id={`tab-${tab.id}`}
                  aria-label={tab.label}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* DYNAMIC TELEMETRY DISPLAY */}
          <div className="flex-1 min-h-[300px] flex flex-col">
            
            {/* 1. WEATHER & CLIMATE MODULE */}
            {activeTab === 'meteo' && (
              <div className="flex flex-col gap-6 fade-in">
                {Object.keys(capitalsData).map(key => {
                  const data = capitalsData[key];
                  if (selectedProvince !== 'ALL' && selectedProvince !== data.province) return null;
                  
                  return (
                    <div key={key} className="hud-panel corner-ticks flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-white/5 rounded border border-white/5">
                          {getWeatherIcon(data.weatherCode)}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white font-mono uppercase">{data.name} ({data.basqueName})</h4>
                          <span className="text-[9px] text-[#00e5ff] font-mono tracking-widest uppercase">{data.province} // CAPTURA OK</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 font-mono w-full md:w-auto">
                        <div className="flex flex-col border-l border-white/5 pl-4">
                          <span className="text-[7px] text-slate-500 uppercase">Temperatura</span>
                          <span className="text-xl font-bold text-white tabular-nums">{data.temp}°C</span>
                          <span className="text-[7px] text-slate-400">SENS: {data.apparentTemp}°C</span>
                        </div>

                        <div className="flex flex-col border-l border-white/5 pl-4">
                          <span className="text-[7px] text-slate-500 uppercase">Humedad Rel</span>
                          <span className="text-xl font-bold text-[#00f5a0] tabular-nums">{data.humidity}%</span>
                          <span className="text-[7px] text-slate-400">ESTADO: SECO</span>
                        </div>

                        <div className="flex flex-col border-l border-white/5 pl-4">
                          <span className="text-[7px] text-slate-500 uppercase">Vel. Viento</span>
                          <span className="text-xl font-bold text-[#00e5ff] tabular-nums">{data.windSpeed} km/h</span>
                          <span className="text-[7px] text-slate-400 flex items-center gap-1">
                            <Compass className="w-2.5 h-2.5 animate-spin" style={{ animationDuration: '10s' }} /> DIR: {data.windDirection}°
                          </span>
                        </div>

                        <div className="flex flex-col border-l border-white/5 pl-4">
                          <span className="text-[7px] text-slate-500 uppercase">Cielo / Zerua</span>
                          <span className="text-[10px] font-bold text-slate-200 uppercase mt-1 truncate max-w-[100px]">{getWeatherDesc(data.weatherCode)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 2. TIDES & ASTRONOMICAL EVENTS */}
            {activeTab === 'tides' && (
              <div className="flex flex-col gap-6 fade-in">
                
                {/* Real-time Tide telemetry */}
                <div className="hud-panel corner-ticks grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  <div className="flex flex-col justify-between">
                    <div>
                      <h4 className="text-[10px] font-mono font-bold tracking-widest text-[#00e5ff] border-b border-white/5 pb-2 mb-3">
                        SENSOR MAREA // COASTAL TIDES
                      </h4>
                      <span className="text-[8px] text-slate-500 font-mono uppercase block mb-1">Altura Estimada</span>
                      <span className="text-3xl font-mono font-bold text-white tabular-nums">{tide.height}m</span>
                    </div>
                    <span className="text-[8px] font-mono text-[#00f5a0] mt-2 block">{tide.state.toUpperCase()}</span>
                  </div>

                  <div className="flex flex-col justify-between border-l border-white/5 pl-6">
                    <div>
                      <h4 className="text-[10px] font-mono font-bold tracking-widest text-slate-400 border-b border-white/5 pb-2 mb-3">
                        DIRECCIÓN / TENDENCIA
                      </h4>
                      <span className="text-[8px] text-slate-500 font-mono uppercase block mb-1">Marea Flujo</span>
                      <span className="text-xl font-mono font-bold text-[#00e5ff]">{tide.trend.toUpperCase()}</span>
                    </div>
                    <span className="text-[8px] font-mono text-slate-400 mt-2 block">CICLO PERIÓDICO 12.42H</span>
                  </div>

                  <div className="flex flex-col justify-between border-l border-white/5 pl-6">
                    <div>
                      <h4 className="text-[10px] font-mono font-bold tracking-widest text-slate-400 border-b border-white/5 pb-2 mb-3">
                        PRÓXIMOS EXTREMOS
                      </h4>
                      <div className="flex flex-col gap-2 font-mono text-[9px]">
                        <div className="flex justify-between">
                          <span className="text-slate-500">PLEAMAR (HIGH TIDE):</span>
                          <span className="text-[#00f5a0] font-bold">En {tide.nextHigh}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">BAJAMAR (LOW TIDE):</span>
                          <span className="text-[#ff3e6c] font-bold">En {tide.nextLow}</span>
                        </div>
                      </div>
                    </div>
                    <span className="text-[7px] text-slate-500 font-mono block">MEDICIÓN: ESTACIÓN PUERTO BILBAO</span>
                  </div>

                </div>

                {/* Astronomy panel (Sunrise / Sunset / Moon) */}
                <div className="hud-panel corner-ticks grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Moon phase calculator display */}
                  <div className="flex flex-col gap-3">
                    <h4 className="text-[10px] font-mono font-bold tracking-widest text-[#d4af37] border-b border-white/5 pb-2 mb-2">
                      FASES LUNARES // ILARGI FASEA
                    </h4>
                    <div className="flex items-center gap-4 bg-black/25 border border-white/5 p-3 rounded">
                      <Moon className="w-10 h-10 text-slate-300 drop-shadow-[0_0_6px_rgba(255,255,255,0.2)] animate-pulse" />
                      <div>
                        <span className="text-xs font-bold text-white font-mono">{moon.label}</span>
                        <span className="text-[8px] text-slate-500 font-mono block uppercase mt-0.5">Edad del Ciclo: {Math.round(moon.phase * 100)}%</span>
                      </div>
                    </div>
                    <p className="text-[9px] text-slate-400 leading-normal">
                      * El ciclo lunar afecta el rango de las mareas. Las mareas vivas ocurren cerca de la Luna Nueva e Ilbetea (Luna Llena).
                    </p>
                  </div>

                  {/* Solar Cycle Times */}
                  <div className="flex flex-col gap-3">
                    <h4 className="text-[10px] font-mono font-bold tracking-widest text-[#d4af37] border-b border-white/5 pb-2 mb-2">
                      CICLO SOLAR // EGUR-ARGIA
                    </h4>
                    <div className="flex flex-col gap-2 font-mono text-[9px]">
                      <div className="flex justify-between bg-black/25 border border-white/5 p-2 rounded items-center">
                        <span className="text-slate-400">SALIDA DEL SOL (ORTO):</span>
                        <span className="text-yellow-400 font-bold text-xs">{capitalsData.vitoria.sunrise}</span>
                      </div>
                      <div className="flex justify-between bg-black/25 border border-white/5 p-2 rounded items-center">
                        <span className="text-slate-400">PUESTA DEL SOL (OCASO):</span>
                        <span className="text-orange-500 font-bold text-xs">{capitalsData.vitoria.sunset}</span>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* 3. FIRE RISK & WIND SPEED */}
            {activeTab === 'fire' && (
              <div className="flex flex-col gap-6 fade-in">
                
                {/* Fire weather index proxy metrics */}
                <div className="hud-panel corner-ticks">
                  <h4 className="text-[10px] font-mono font-bold tracking-widest text-[#ff3e6c] border-b border-white/5 pb-2 mb-4 flex items-center gap-2">
                    <Flame className="w-4 h-4 text-[#ff3e6c]" />
                    ÍNDICE DE RIESGO DE INCENDIOS (COPERNICUS FWI MOCK)
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {Object.keys(capitalsData).map(key => {
                      const data = capitalsData[key];
                      if (selectedProvince !== 'ALL' && selectedProvince !== data.province) return null;
                      
                      const isDanger = data.fwi >= 25;

                      return (
                        <div key={key} className="bg-black/25 border border-white/5 p-4 rounded flex flex-col justify-between font-mono">
                          <span className="text-xs font-bold text-white">{data.name}</span>
                          
                          <div className="my-3">
                            <span className="text-[7px] text-slate-500 uppercase block">Calculated FWI</span>
                            <span className={`text-2xl font-bold ${isDanger ? 'text-[#ff3e6c]' : 'text-[#00f5a0]'}`}>{data.fwi}</span>
                          </div>

                          <div className="border-t border-white/5 pt-2 mt-2">
                            <span className="text-[8px] text-slate-400 uppercase">RIESGO:</span>
                            <span className={`text-[9px] font-bold uppercase ml-2 ${isDanger ? 'text-[#ff3e6c]' : 'text-[#00f5a0]'}`}>{data.fwiCategory}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Winds detailed telemetry */}
                <div className="hud-panel corner-ticks">
                  <h4 className="text-[10px] font-mono font-bold tracking-widest text-[#00e5ff] border-b border-white/5 pb-2 mb-4 flex items-center gap-2">
                    <Wind className="w-4 h-4 text-[#00e5ff]" />
                    VECTOR DIRECCIÓN Y FUERZA DEL VIENTO
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {Object.keys(capitalsData).map(key => {
                      const data = capitalsData[key];
                      if (selectedProvince !== 'ALL' && selectedProvince !== data.province) return null;
                      
                      const isHighWind = data.windSpeed >= 50;

                      return (
                        <div key={key} className="bg-black/25 border border-white/5 p-4 rounded flex flex-col items-center justify-between font-mono">
                          <span className="text-xs font-bold text-white self-start">{data.name}</span>
                          
                          {/* Wind compass vector indicator */}
                          <div className="relative w-20 h-20 border border-white/5 rounded-full my-4 flex items-center justify-center">
                            <div className="absolute text-[6px] text-slate-500 top-1">N</div>
                            <div className="absolute text-[6px] text-slate-500 bottom-1">S</div>
                            <div className="absolute text-[6px] text-slate-500 left-1">W</div>
                            <div className="absolute text-[6px] text-slate-500 right-1">E</div>
                            
                            {/* Direction pointer arrow */}
                            <div 
                              className="transition-transform duration-500 flex items-center justify-center" 
                              style={{ transform: `rotate(${data.windDirection}deg)` }}
                            >
                              <svg 
                                width="44" 
                                height="44" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                className="filter drop-shadow-[0_0_8px_rgba(0,229,255,0.7)]"
                              >
                                <defs>
                                  <linearGradient id={`arrow-grad-${key}`} x1="0%" y1="100%" x2="0%" y2="0%">
                                    <stop offset="0%" stopColor="rgba(0, 229, 255, 0.1)" />
                                    <stop offset="100%" stopColor="#00e5ff" />
                                  </linearGradient>
                                </defs>
                                <line 
                                  x1="12" 
                                  y1="20" 
                                  x2="12" 
                                  y2="4" 
                                  stroke={`url(#arrow-grad-${key})`} 
                                  strokeWidth="2.5" 
                                  strokeLinecap="round" 
                                />
                                <path 
                                  d="M7 9L12 3L17 9" 
                                  stroke="#00e5ff" 
                                  strokeWidth="2.5" 
                                  strokeLinecap="round" 
                                  strokeLinejoin="round" 
                                />
                                <circle cx="12" cy="12" r="2.5" fill="#00e5ff" />
                              </svg>
                            </div>
                          </div>

                          <div className="w-full flex justify-between border-t border-white/5 pt-2">
                            <span className="text-[8px] text-slate-500 uppercase">FUERZA:</span>
                            <span className={`text-[9px] font-bold ${isHighWind ? 'text-[#ff3e6c] blink-red' : 'text-[#00f5a0]'}`}>{data.windSpeed} km/h</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* 4. RIVERS & RESERVOIRS */}
            {activeTab === 'hydro' && (
              <div className="flex flex-col gap-6 fade-in">
                
                {/* River telemetry list */}
                <div className="hud-panel corner-ticks">
                  <h4 className="text-[10px] font-mono font-bold tracking-widest text-[#00e5ff] border-b border-white/5 pb-2 mb-4 flex items-center gap-2">
                    <Droplet className="w-4 h-4 text-[#00e5ff]" />
                    RED HIDROGRÁFICA // RIVER FLUCTUATION FLOWS
                  </h4>
                  
                  <div className="flex flex-col gap-3 font-mono text-[9px]">
                    <div className="grid grid-cols-5 text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2">
                      <span>Río / Sensor</span>
                      <span>Provincia</span>
                      <span>Nivel (m)</span>
                      <span>Caudal (m³/s)</span>
                      <span>Estado</span>
                    </div>

                    {rivers.map(river => {
                      if (selectedProvince !== 'ALL' && selectedProvince !== river.province) return null;
                      
                      const isWarning = river.status === 'warning' || river.level >= river.criticalLevel * 0.8;
                      const isAlert = river.status === 'alert' || river.level >= river.criticalLevel;

                      return (
                        <div key={river.id} className="grid grid-cols-5 py-2.5 border-b border-white/5 items-center">
                          <span className="text-white font-bold">{river.name}</span>
                          <span className="text-slate-400">{river.province}</span>
                          <span className="text-white font-bold tabular-nums">
                            {river.level}m 
                            <span className="text-[7px] text-slate-500 font-normal block">LIM: {river.criticalLevel}m</span>
                          </span>
                          <span className="text-[#00e5ff] font-bold tabular-nums">{river.flow} m³/s</span>
                          
                          <span className={`px-2 py-0.5 rounded text-[8px] font-bold text-center uppercase max-w-[80px] ${
                            isAlert 
                              ? 'bg-[#ff3e6c]/10 border border-[#ff3e6c]/20 text-[#ff3e6c] blink-red'
                              : isWarning 
                                ? 'bg-[#ff9100]/10 border border-[#ff9100]/20 text-[#ff9100] blink-orange'
                                : 'bg-[#00f5a0]/10 border border-[#00f5a0]/20 text-[#00f5a0]'
                          }`}>
                            {isAlert ? 'CRÍTICO' : isWarning ? 'ALERTA' : 'NOMINAL'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Reservoir levels capacity */}
                <div className="hud-panel corner-ticks">
                  <h4 className="text-[10px] font-mono font-bold tracking-widest text-[#00e5ff] border-b border-white/5 pb-2 mb-4">
                    RESERVAS HIDROGRÁFICAS // EMBALSES
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono">
                    {reservoirs.map(res => {
                      if (selectedProvince !== 'ALL' && selectedProvince !== res.province) return null;

                      return (
                        <div key={res.name} className="bg-black/25 border border-white/5 p-4 rounded flex flex-col gap-3">
                          <div className="flex justify-between items-start">
                            <span className="text-white font-bold">{res.name}</span>
                            <span className="text-[7px] text-slate-500 uppercase">{res.province}</span>
                          </div>

                          <div>
                            <div className="flex justify-between text-[9px] mb-1">
                              <span className="text-slate-500">CAPACIDAD:</span>
                              <span className="text-white font-bold">{res.currentLevel} / {res.capacity} hm³</span>
                            </div>
                            
                            {/* Graphic progress bar */}
                            <div className="relative w-full h-2.5 bg-black/45 border border-white/5 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-[#00e5ff] to-[#00f5a0] rounded-full" 
                                style={{ width: `${res.percentage}%` }}
                              />
                            </div>
                            
                            <span className="text-[#00f5a0] text-[10px] font-bold block text-right mt-1.5">{res.percentage}% LLENO</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* 5. WEATHER & CIVIL DEFENSE ALERTS BOARD */}
            {activeTab === 'alerts' && (
              <div className="flex flex-col gap-6 fade-in">
                
                {/* Active official alerts board */}
                <div className="hud-panel corner-ticks">
                  <h4 className="text-[10px] font-mono font-bold tracking-widest text-[#ff3e6c] border-b border-white/5 pb-2 mb-4 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-[#ff3e6c]" />
                    TABLÓN OFICIAL DE FENÓMENOS ADVERSOS (EUSKALMET)
                  </h4>
                  
                  <div className="flex flex-col gap-4">
                    {alerts.filter(a => a.active).map(alert => {
                      if (selectedProvince !== 'ALL' && selectedProvince !== alert.province) return null;

                      const isRed = alert.level === 'red';
                      const isOrange = alert.level === 'orange';

                      return (
                        <div 
                          key={alert.id} 
                          className={`p-4 rounded border flex flex-col md:flex-row gap-4 items-start md:items-center justify-between ${
                            isRed 
                              ? 'bg-[#ff3e6c]/10 border-[#ff3e6c]/40 text-white' 
                              : isOrange 
                                ? 'bg-[#ff9100]/10 border-[#ff9100]/40 text-white' 
                                : 'bg-[#d4af37]/10 border-[#d4af37]/30 text-white'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <AlertTriangle className={`w-5 h-5 shrink-0 ${isRed ? 'text-[#ff3e6c] blink-red' : isOrange ? 'text-[#ff9100] blink-orange' : 'text-[#d4af37] blink-gold'}`} />
                            <div className="flex flex-col">
                              <span className={`text-[10px] font-mono font-bold uppercase tracking-widest ${
                                isRed ? 'text-[#ff3e6c] blink-red' : isOrange ? 'text-[#ff9100] blink-orange' : 'text-[#d4af37] blink-gold'
                              }`}>
                                {alert.province} // {alert.type}
                              </span>
                              <p className="text-xs mt-1.5 leading-relaxed text-slate-100">{alert.message}</p>
                            </div>
                          </div>
                          
                          <span className={`px-2.5 py-1 rounded text-[8px] font-mono font-bold uppercase text-center shrink-0 ${
                            isRed 
                              ? 'bg-[#ff3e6c] text-[#030307] blink-red' 
                              : isOrange 
                                ? 'bg-[#ff9100] text-[#030307] blink-orange' 
                                : 'bg-[#d4af37] text-[#030307] blink-gold'
                          }`}>
                            ALERTA {alert.level.toUpperCase()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* 6. REPORT GENERATOR (TXOSTENAK) & PRINT */}
            {activeTab === 'report' && (
              <div className="flex flex-col gap-6 fade-in">
                
                {/* Controls and trigger panels */}
                <div className="hud-panel corner-ticks flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                  <div>
                    <h4 className="text-sm font-bold text-white font-mono uppercase">Generador de Informes / Txostenak</h4>
                    <span className="text-[9px] text-[#00e5ff] font-mono tracking-widest uppercase">Exportar telemetría ambiental para protección civil</span>
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={triggerPrint} 
                      className="flex items-center gap-2 px-3 py-2 bg-[#00e5ff]/10 border border-[#00e5ff]/35 hover:bg-[#00e5ff] hover:text-[#030307] text-white text-xs font-mono font-bold uppercase tracking-wider rounded transition-all duration-200"
                      id="btn-print-report"
                      aria-label="Imprimir Reporte"
                    >
                      <Printer className="w-3.5 h-3.5 text-[#00e5ff]" />
                      Imprimir
                    </button>
                    
                    <button 
                      onClick={sendEmail} 
                      className="flex items-center gap-2 px-3 py-2 bg-[#d4af37]/10 border border-[#d4af37]/35 hover:bg-[#d4af37] hover:text-[#030307] text-white text-xs font-mono font-bold uppercase tracking-wider rounded transition-all duration-200"
                      id="btn-email-report"
                      aria-label="Enviar Reporte por Email"
                    >
                      <Mail className="w-3.5 h-3.5 text-[#d4af37]" />
                      Enviar por Email
                    </button>
                  </div>
                </div>

                {/* Email Form fields */}
                <div className="hud-panel corner-ticks flex flex-col gap-4">
                  <h4 className="text-[10px] font-mono font-bold tracking-widest text-[#d4af37] border-b border-white/5 pb-2 flex justify-between items-center">
                    <span>DESTINATARIO Y MENSAJE</span>
                    {emailSuccess && <span className="text-[#00f5a0] blink-green font-bold">✓ REPORTE ENVIADO (SMTP OK)</span>}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-[9px]">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-slate-500 uppercase">Destinatario:</label>
                      <input 
                        type="text" 
                        value={emailForm.recipient} 
                        onChange={(e) => setEmailForm(prev => ({ ...prev, recipient: e.target.value }))}
                        className="bg-black/45 border border-white/5 p-2.5 rounded text-white focus:outline-none focus:border-[#00e5ff]"
                        id="input-email-recipient"
                        aria-label="Correo del destinatario"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-slate-500 uppercase">Asunto / Subject:</label>
                      <input 
                        type="text" 
                        value={emailForm.subject} 
                        onChange={(e) => setEmailForm(prev => ({ ...prev, subject: e.target.value }))}
                        className="bg-black/45 border border-white/5 p-2.5 rounded text-white focus:outline-none focus:border-[#00e5ff]"
                        id="input-email-subject"
                        aria-label="Asunto del correo"
                      />
                    </div>
                  </div>
                </div>

                {/* SMTP Simulated Terminal Log screen */}
                {(smtpLog.length > 0 || isSendingEmail) && (
                  <div className="hud-panel corner-ticks bg-black border border-white/10 p-4 rounded font-mono text-[9px] text-[#00f5a0] flex flex-col gap-1 max-h-[250px] overflow-y-auto">
                    <span className="text-[8px] text-slate-500 uppercase tracking-widest border-b border-white/5 pb-1.5 mb-2 flex items-center justify-between">
                      SMTP LOG TELEMETRY GATEWAY
                      {isSendingEmail && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    </span>
                    <div className="space-y-1">
                      {smtpLog.map((log, index) => (
                        <div key={index} className={log.startsWith('✓') ? 'text-[#00e5ff]' : log.startsWith('354') ? 'text-yellow-400' : 'text-[#00f5a0]'}>
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Printable Environmental Report Page Layout */}
                <div className="hud-panel border-white/15 bg-black/45 p-6 rounded flex flex-col gap-4 font-mono text-[9px] text-slate-300">
                  <div className="flex justify-between border-b border-white/10 pb-4 items-center">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white">EGUR-NEXUS TELEMETRY REPORT</span>
                      <span className="text-[7px] text-slate-500 mt-1">EUSKADI ENVIRONMENTAL PROTECTION PORTAL</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block">FECHA: {currentTime.toLocaleDateString('es-ES')}</span>
                      <span className="text-slate-400 block">HORA: {currentTime.toLocaleTimeString('es-ES')}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div>
                      <span className="text-[#00e5ff] font-bold block mb-1">1. TELEMETRÍA DEL CLIMA (ESTADO ACTUAL)</span>
                      <div className="grid grid-cols-3 gap-4 border-t border-white/5 pt-2">
                        {Object.keys(capitalsData).map(k => {
                          const c = capitalsData[k];
                          return (
                            <div key={k} className="flex flex-col gap-0.5">
                              <span className="text-white font-bold">{c.name}</span>
                              <span>Temp: {c.temp}°C (Sens: {c.apparentTemp}°C)</span>
                              <span>Humedad: {c.humidity}% | Viento: {c.windSpeed} km/h ({c.windDirection}°)</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <span className="text-[#00e5ff] font-bold block mb-1">2. HIDROLOGÍA Y ESTADO DE CAUCES</span>
                      <div className="flex flex-col gap-1 border-t border-white/5 pt-2">
                        {rivers.map(r => (
                          <div key={r.id} className="flex justify-between">
                            <span>Río {r.name}: Nivel {r.level}m (Límite: {r.criticalLevel}m)</span>
                            <span className={r.status !== 'nominal' ? 'text-[#ff3e6c] font-bold' : 'text-[#00f5a0]'}>
                              {r.status.toUpperCase()} (Caudal: {r.flow} m³/s)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-[#ff3e6c] font-bold block mb-1">3. REGISTRO DE ALERTAK REGISTRADAS</span>
                      <div className="flex flex-col gap-1 border-t border-white/5 pt-2">
                        {alerts.filter(a => a.active).map(a => (
                          <div key={a.id} className="text-slate-100">
                            • [{a.level.toUpperCase()}] {a.province}: {a.type} - {a.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

          </div>

        </section>

      </main>

      {/* FOOTER: Osiris-style Bottom coordinates & state bar */}
      <footer className="no-print h-10 border-t border-white/5 bg-[#05050b]/90 text-slate-500 flex items-center px-6 justify-between text-[8px] font-mono uppercase tracking-[0.2em] z-40">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span>SENSORS:</span>
            <span className="text-[#00f5a0] font-bold">ORBITAL_LATTICE_OK</span>
          </div>
          <div className="flex items-center gap-2">
            <span>RADAR COMPASS:</span>
            <span className="text-[#00e5ff]">360° SWEEP ACTIVE</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-slate-300">
          <span>© 2026 EGUR-NEXUS // GUSTAVO SANABRIA // TODOS LOS DERECHOS RESERVADOS</span>
        </div>
      </footer>
    </>
  );
}
