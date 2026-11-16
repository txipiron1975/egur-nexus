import { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
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
  Activity,
  SlidersHorizontal,
  X,
  Radio
} from 'lucide-react';
import './App.css';

// Type definitions
type TabId = 'meteo' | 'tides' | 'fire' | 'hydro' | 'alerts' | 'report';

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
  protocol: string;
  active: boolean;
}

// Modern Web Guidance: Probe whether discrete `display` transition actually keeps element visible
let supportsDisplayTransitionCache: boolean | undefined;
function canTransitionDisplay(): boolean {
  if (supportsDisplayTransitionCache !== undefined) return supportsDisplayTransitionCache;
  if (typeof window === 'undefined' || !window.CSS?.supports?.('transition-behavior', 'allow-discrete') || !document.body) {
    return false;
  }
  const probe = document.createElement('div');
  probe.style.cssText = 'transition: display 1s allow-discrete !important; display: block;';
  document.body.appendChild(probe);
  void getComputedStyle(probe).display;
  probe.style.display = 'none';
  supportsDisplayTransitionCache = getComputedStyle(probe).display === 'block';
  probe.remove();
  return supportsDisplayTransitionCache;
}

function supportsTopLayerExit(): boolean {
  return typeof window !== 'undefined' && Boolean(window.CSS?.supports?.('overlay', 'auto')) && canTransitionDisplay();
}

export default function App() {
  // Navigation & Modern UI states
  const [activeTab, setActiveTab] = useState<TabId>('meteo');
  const [selectedProvince, setSelectedProvince] = useState<string>('ALL'); // 'ALL', 'BIZKAIA', 'GIPUZKOA', 'ARABA'
  const [densityMode, setDensityMode] = useState<'spacious' | 'compact'>('spacious');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [activeModalAlert, setActiveModalAlert] = useState<WeatherAlert | null>(null);

  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const stageHeadingRef = useRef<HTMLHeadingElement | null>(null);
  
  // Weather data state for the 3 capitals
  const [capitalsData, setCapitalsData] = useState<Record<string, CapitalWeather>>({
    bilbao: { name: "Bilbao", basqueName: "Bilbo", province: "BIZKAIA", lat: 43.2630, lon: -2.9350, temp: 24.8, apparentTemp: 25.4, humidity: 64, windSpeed: 38.2, windDirection: 295, isDay: true, weatherCode: 2, sunrise: "06:30", sunset: "21:30", fwi: 26.4, fwiCategory: "Alto / Altua", loading: false },
    donostia: { name: "San Sebastián", basqueName: "Donostia", province: "GIPUZKOA", lat: 43.3183, lon: -1.9812, temp: 22.4, apparentTemp: 23.0, humidity: 70, windSpeed: 24.5, windDirection: 310, isDay: true, weatherCode: 1, sunrise: "06:28", sunset: "21:28", fwi: 18.2, fwiCategory: "Moderado / Ertaina", loading: false },
    vitoria: { name: "Vitoria-Gasteiz", basqueName: "Gasteiz", province: "ARABA", lat: 42.8467, lon: -2.6716, temp: 31.6, apparentTemp: 33.1, humidity: 34, windSpeed: 19.8, windDirection: 195, isDay: true, weatherCode: 0, sunrise: "06:32", sunset: "21:32", fwi: 41.2, fwiCategory: "Muy Alto / Oso Altua", loading: false }
  });

  // Layer switches
  const [layers, setLayers] = useState({
    weather: true,
    wind: true,
    fires: false,
    rivers: true,
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
    {
      id: 'a1',
      province: 'BIZKAIA',
      type: 'Galerna / Kostaldeko Arriskua',
      level: 'orange',
      message: 'Riesgo de galerna súbita en el litoral de Bizkaia con giro brusco al NW y rachas de hasta 80 km/h.',
      protocol: 'SOS DEIAK 112: Restricción de baño en arenales expuestos, amarre reforzado en puertos deportivos y vigilancia de grúas.',
      active: true
    },
    {
      id: 'a2',
      province: 'ARABA',
      type: 'Temperatura Extrema & FWI',
      level: 'yellow',
      message: 'Temperaturas máximas en la Llanada Alavesa y Rioja Alavesa que superan los 36°C con humedad inferior al 35%.',
      protocol: 'SOS DEIAK 112: Prohibición de uso de maquinaria agrícola con riesgo de chispa en franja 13:00-19:00 LCL.',
      active: true
    },
    {
      id: 'a3',
      province: 'GIPUZKOA',
      type: 'Incendios Forestales (Viento Sur)',
      level: 'yellow',
      message: 'Riesgo de propagación rápida por viento desecante de componente sur en comarcas interiores.',
      protocol: 'SOS DEIAK 112: Activación de retenes forestales preventivos en Aizkorri-Aratz y prohibición de quemas.',
      active: true
    }
  ]);

  // Modern Web Guidance (`same-document-transitions`): Transition helper with mandatory focus routing
  const runViewTransition = (updateFn: () => void, focusHeading = false) => {
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => { finished: Promise<void> };
    };
    if (!doc.startViewTransition) {
      updateFn();
      if (focusHeading) stageHeadingRef.current?.focus();
      return;
    }
    const transition = doc.startViewTransition(() => {
      flushSync(() => {
        updateFn();
      });
    });
    if (focusHeading) {
      transition.finished.finally(() => {
        stageHeadingRef.current?.focus();
      });
    }
  };

  const handleSelectTab = (tabId: TabId, buttonEl?: HTMLButtonElement | null) => {
    runViewTransition(() => {
      setActiveTab(tabId);
    }, true);
    buttonEl?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  const handleSelectProvince = (prov: string) => {
    runViewTransition(() => {
      setSelectedProvince(prov);
    }, false);
  };

  // Modern Web Guidance (`light-dismiss-a-dialog` + `animate-to-from-top-layer`)
  const openEmergencyDialog = (alertItem?: WeatherAlert) => {
    setActiveModalAlert(alertItem || alerts[0]);
    const dlg = dialogRef.current;
    if (dlg && !dlg.open) {
      dlg.showModal();
    }
  };

  const closeEmergencyDialog = async () => {
    const dlg = dialogRef.current;
    if (!dlg || !dlg.open) return;

    if (!supportsTopLayerExit()) {
      dlg.setAttribute('data-closing', '');
      const animations = dlg.getAnimations({ subtree: true });
      if (animations.length > 0) {
        await Promise.race([
          Promise.allSettled(animations.map((a) => a.finished)),
          new Promise((r) => setTimeout(r, 400)),
        ]);
      }
      if (!dlg.hasAttribute('data-closing')) return;
      dlg.removeAttribute('data-closing');
    }
    dlg.close();
  };

  // Wire up dialog light-dismiss fallback & cancel animation routing
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;

    const onCancel = (event: Event) => {
      event.preventDefault();
      void closeEmergencyDialog();
    };

    const onClick = (event: MouseEvent) => {
      // Fallback for browsers without native `closedby="any"` support
      if (!('closedBy' in HTMLDialogElement.prototype)) {
        if (event.target !== dlg) return;
        const rect = dlg.getBoundingClientRect();
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (!isDialogContent) {
          void closeEmergencyDialog();
        }
      }
    };

    dlg.addEventListener('cancel', onCancel);
    dlg.addEventListener('click', onClick);
    return () => {
      dlg.removeEventListener('cancel', onCancel);
      dlg.removeEventListener('click', onClick);
    };
  }, []);

  // Fetch Open-Meteo Data
  const fetchWeather = async () => {
    const keys = Object.keys(capitalsData);
    
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
    } catch {
      // Offline / resilient telemetry fallback
      setCapitalsData(prev => {
        const updated = { ...prev };
        keys.forEach(k => {
          updated[k].temp = k === 'vitoria' ? 34.2 : 28.5;
          updated[k].apparentTemp = k === 'vitoria' ? 35.8 : 29.2;
          updated[k].humidity = k === 'vitoria' ? 32 : 55;
          updated[k].windSpeed = k === 'bilbao' ? 62.4 : 15.2;
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
    void fetchWeather();
    const poll = setInterval(() => { void fetchWeather(); }, 300000);
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
- Río Zadorra (Araba): Nivel ${rivers[4].level}m (Crítico: ${rivers[4].criticalLevel}m), Caudal: ${rivers[4].flow} m³/s [ALERTA]

4. REGISTRO DE ALERTAK Y CIVIL DEFENSE
${alertReport}

-----------------------------------------------------------
Reporte generado automáticamente desde el terminal Egur-Nexus.`;

    setEmailForm(prev => ({
      ...prev,
      body: reportText
    }));
  }, [capitalsData, rivers, alerts, currentTime]);

  const tide = getTideInfo(currentTime);
  const moon = getMoonPhase(currentTime);

  function getTideInfo(date: Date) {
    const hours = date.getHours() + date.getMinutes() / 60;
    const cycle = 12.42; 
    const tideHeight = 2.0 * Math.sin((hours * Math.PI * 2) / cycle); 
    
    const currentOffset = hours % cycle;
    const nextHigh = (cycle / 4 - currentOffset + cycle) % cycle;
    const nextLow = ((3 * cycle) / 4 - currentOffset + cycle) % cycle;
    
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

  const getWeatherIcon = (code: number) => {
    if (code === 0) return <Sun className="w-6 h-6 text-gold" />;
    if (code >= 1 && code <= 3) return <CloudSun className="w-6 h-6 text-slate-300" />;
    if (code === 45 || code === 48) return <CloudFog className="w-6 h-6 text-slate-400" />;
    if (code >= 51 && code <= 55) return <CloudDrizzle className="w-6 h-6 text-cyan" />;
    if (code >= 61 && code <= 65) return <CloudRain className="w-6 h-6 text-cyan" />;
    if (code >= 71 && code <= 75) return <Snowflake className="w-6 h-6 text-blue" />;
    if (code >= 80 && code <= 82) return <CloudRainWind className="w-6 h-6 text-cyan" />;
    if (code >= 95) return <CloudLightning className="w-6 h-6 text-purple" style={{ filter: 'drop-shadow(0 0 4px rgba(168,85,247,0.4))' }} />;
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

  const getProvinceClass = (provName: string) => {
    if (selectedProvince !== 'ALL' && selectedProvince !== provName) return 'province-path opacity-30';
    return selectedProvince === provName ? 'province-path active' : 'province-path';
  };

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

      const mailtoUrl = `mailto:${encodeURIComponent(emailForm.recipient)}?subject=${encodeURIComponent(emailForm.subject)}&body=${encodeURIComponent(emailForm.body)}`;
      window.location.href = mailtoUrl;
    }, 2500);
  };

  const triggerPrint = () => {
    window.print();
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

  const tabsConfig: Array<{ id: TabId; label: string; icon: typeof Sun; status?: string }> = [
    { id: 'meteo', label: 'EGU / El Tiempo', icon: Sun },
    { id: 'tides', label: 'MAR / Tides & Moon', icon: Waves },
    { id: 'fire', label: 'SUT / Incendios', icon: Flame },
    { id: 'hydro', label: 'URA / Ríos', icon: Droplet },
    { id: 'alerts', label: `ALERTAK (${alerts.filter(a => a.active).length})`, icon: AlertTriangle, status: 'alert' },
    { id: 'report', label: 'TXO / Informes', icon: Printer }
  ];

  const activeTabMeta = tabsConfig.find(t => t.id === activeTab) || tabsConfig[0];

  return (
    <div
      className="hud-workspace flex flex-col h-full w-full"
      data-density={densityMode}
      style={{ '--density': densityMode } as React.CSSProperties}
    >
      {/* Visual Overlay Scanlines */}
      <div className="vignette" />
      <div className="scanlines" />

      {/* =====================================================================
          MODERN WEB GUIDANCE: Top-Layer Native <dialog closedby="any">
          for SOS DEIAK Emergency Dossier
          ===================================================================== */}
      <dialog
        ref={dialogRef}
        id="emergency-dossier-dialog"
        {...({ closedby: 'any' } as Record<string, string>)}
        aria-labelledby="dialog-emergency-title"
        className="hud-dialog corner-ticks font-mono"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-5 h-5 text-red blink-red" />
              <h2 id="dialog-emergency-title" className="text-sm font-bold text-white uppercase tracking-widest">
                SOS DEIAK 112 // PROTOCOLO DE EMERGENCIA ACTIVO
              </h2>
            </div>
            <button
              type="button"
              onClick={() => { void closeEmergencyDialog(); }}
              className="p-1.5 rounded bg-white/5 hover:bg-red-10 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
              aria-label="Cerrar dossier de emergencia"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {activeModalAlert && (
            <div className="p-4 rounded border border-red-35 bg-red-10 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red uppercase tracking-wider">
                  {activeModalAlert.province} // {activeModalAlert.type}
                </span>
                <span className="px-2 py-1 rounded bg-red text-white text-[9px] font-bold uppercase">
                  NIVEL {activeModalAlert.level.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-white">{activeModalAlert.message}</p>
              <div className="border-t border-white/10 pt-2 mt-1 text-[10px] text-cyan">
                <strong>DIRECTIVA OPERATIVA:</strong> {activeModalAlert.protocol}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-[10px] text-slate-400 uppercase tracking-widest">
              Todas las Alertas Activas en Euskadi ({alerts.filter(a => a.active).length})
            </span>
            {alerts.filter(a => a.active).map(a => (
              <div
                key={a.id}
                onClick={() => setActiveModalAlert(a)}
                className="p-2.5 rounded border border-white/10 bg-black/45 flex items-center justify-between cursor-pointer hover:border-cyan/35"
              >
                <span className="text-xs text-white font-bold">{a.province}: {a.type}</span>
                <span className="text-[9px] text-gold uppercase">Ver Directiva →</span>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center border-t border-white/10 pt-3 text-[9px] text-slate-400">
            <span>LIGHT-DISMISS ACTIVO: Clic fuera del cuadro o tecla ESC para cerrar</span>
            <button
              type="button"
              onClick={() => { void closeEmergencyDialog(); }}
              className="px-3 py-1.5 rounded bg-cyan-10 border border-cyan-35 text-cyan font-bold uppercase cursor-pointer"
            >
              Entendido / Cerrar
            </button>
          </div>
        </div>
      </dialog>

      {/* =====================================================================
          MODERN WEB GUIDANCE: Native Popover API (`popover="auto"`)
          for Telemetry Matrix Diagnostics & Baseline Spec Status
          ===================================================================== */}
      <div
        id="hud-matrix-popover"
        popover="auto"
        className="hud-popover corner-ticks font-mono"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-xs font-bold text-cyan uppercase tracking-widest flex items-center gap-2">
              <Radio className="w-4 h-4 text-green" />
               TELEMETRY MATRIX & BASELINE WEB ENGINE
            </span>
            <span className="text-[9px] text-green font-bold">ONLINE // 0 DEPS</span>
          </div>
          <p className="text-[10px] text-slate-300">
            Este HUD utiliza primitivas nativas de la plataforma web (Google Chrome / MDN Baseline) sin librerías pesadas de terceros:
          </p>
          <div className="grid grid-cols-2 gap-2 text-[9px]">
            <div className="p-2 rounded bg-black/45 border border-white/5">
              <span className="text-cyan font-bold block">View Transitions API</span>
              <span className="text-slate-400">Morphing de estado + enrutado accesible de foco</span>
            </div>
            <div className="p-2 rounded bg-black/45 border border-white/5">
              <span className="text-cyan font-bold block">@container Queries</span>
              <span className="text-slate-400">Tarjetas y tablas reactivas a su propio ancho</span>
            </div>
            <div className="p-2 rounded bg-black/45 border border-white/5">
              <span className="text-cyan font-bold block">Top-Layer &lt;dialog closedby&gt;</span>
              <span className="text-slate-400">Light-dismiss declarativo + @starting-style</span>
            </div>
            <div className="p-2 rounded bg-black/45 border border-white/5">
              <span className="text-cyan font-bold block">@container style(--density)</span>
              <span className="text-slate-400">Tokens reactivos de densidad (Spacious / Compact)</span>
            </div>
          </div>
          <div className="text-[8px] text-slate-400 border-t border-white/5 pt-2">
            Presiona ESC o haz clic fuera para cerrar este Popover nativo.
          </div>
        </div>
      </div>

      {/* HEADER: Osiris-style Top HUD Bar */}
      <header className="no-print w-full bg-[#05050b]/85 border-b border-white/5 px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 z-40">
        
        {/* Title HUD section */}
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-8 h-8 text-gold animate-pulse" />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-widest-plus text-gold font-mono m-0">EGUR-NEXUS</h1>
              <span className="text-[8px] bg-cyan-10 border border-cyan-35 text-cyan px-2 py-1 rounded font-mono uppercase tracking-widest">
                EUSKADI HUD v2.0
              </span>
              {selectedProvince !== 'ALL' && (
                <span className="hud-selected-capital-badge text-[8px] bg-[#d4af37]/10 border border-gold/35 text-gold px-2 py-1 rounded font-mono uppercase">
                  FILTRO: {selectedProvince}
                </span>
              )}
            </div>
            <span className="text-[7px] text-slate-300 font-mono tracking-wider uppercase mt-1">
              Sistema Integrado de Alertas y Telemetría Ambiental // Baseline Web Platform
            </span>
          </div>
        </div>

        {/* Live warnings counter & Native Controls */}
        <div className="flex flex-wrap items-center gap-3 font-mono text-[9px] tracking-widest text-slate-300">
          {/* Trigger for Native <dialog closedby="any"> */}
          <button
            type="button"
            onClick={() => openEmergencyDialog(alerts[0])}
            className="hud-alert-badge"
            id="btn-open-emergency-dialog"
            title="Abrir Dossier de Emergencia SOS Deiak (Native Dialog)"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red blink-red"></span>
            <span className="text-red font-bold blink-red">
              ALERTAK: {alerts.filter(a => a.active).length} ACTIVAS
            </span>
          </button>

          {/* Trigger for Reactive Design Token (--density: spacious | compact) */}
          <button
            type="button"
            onClick={() => setDensityMode(prev => prev === 'spacious' ? 'compact' : 'spacious')}
            className="px-2.5 py-2 bg-white/5 border border-white/10 text-slate-300 rounded cursor-pointer flex items-center gap-1.5 hover:border-cyan/35"
            title="Alternar densidad mediante Container Style Queries (@container style)"
            id="btn-density-toggle"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-cyan" />
            <span>DENSIDAD: {densityMode.toUpperCase()}</span>
          </button>

          {/* Trigger for Native Popover API */}
          <button
            type="button"
            popoverTarget="hud-matrix-popover"
            className="px-2.5 py-2 bg-cyan-10 border border-cyan-35 text-cyan rounded cursor-pointer flex items-center gap-1.5 font-bold"
            id="btn-matrix-popover"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>BASELINE SPEC</span>
          </button>
          
          <div className="hidden lg:flex flex-col items-end">
            <span className="text-cyan font-bold tabular-nums">ZULU: {currentTime.toUTCString().slice(17, 25)}Z</span>
            <span className="text-[8px] mt-0.5 tabular-nums">LOCAL: {currentTime.toLocaleTimeString('es-ES')}</span>
          </div>

          <button 
            type="button"
            onClick={() => { void fetchWeather(); }} 
            className="p-2 bg-white/5 border border-white/10 text-slate-300 rounded cursor-pointer transition-all"
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
        <section className="hud-scroller no-print w-full lg:w-[48%] border-r border-white/5 p-6 flex flex-col gap-6 overflow-y-auto">
          
          {/* Euskadi Vector Map Panel */}
          <div className="hud-panel flex-1 min-h-[550px] flex flex-col justify-between corner-ticks">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-cyan flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-cyan" />
                Visualizador de Provincia / Radar Táctico
              </span>
              <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest tabular-nums">
                MAP REF: 43.26N / 2.67W
              </span>
            </div>

            {/* Interactive SVG Map */}
            <div className="relative flex-1 flex items-center justify-center p-4 bg-black/35 rounded border border-white/5 my-4 overflow-hidden">
              
              {/* Sci-fi Radar circles */}
              <div className="absolute w-[540px] h-[540px] rounded-full border border-white/5 pointer-events-none" />
              <div className="absolute w-[360px] h-[360px] rounded-full border border-cyan/15 pointer-events-none" />
              <div className="absolute w-[180px] h-[180px] rounded-full border border-white/5 pointer-events-none" />
              
              {/* Radar Sweeper Line */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none radar-sweep" viewBox="0 0 400 300">
                <line x1="200" y1="150" x2="380" y2="150" stroke="#00e5ff" strokeWidth="1" strokeDasharray="3, 3" />
              </svg>

              {/* Map SVG */}
              <svg className="w-full max-w-[550px] h-auto" viewBox="0 0 400 330" role="img" aria-label="Mapa vectorial interactivo de Euskadi">
                {/* Bizkaia Path */}
                <path 
                  d="M 50,160 C 65,130 90,115 110,120 C 130,125 140,110 160,112 C 175,115 185,125 190,135 C 200,155 210,165 210,180 C 180,205 140,195 105,195 Z" 
                  className={getProvinceClass('BIZKAIA')}
                  onClick={() => handleSelectProvince('BIZKAIA')}
                  id="path-map-bizkaia"
                  aria-label="Provincia de Bizkaia"
                />
                
                {/* Gipuzkoa Path */}
                <path 
                  d="M 190,135 C 210,120 240,125 260,120 C 285,115 315,108 335,110 L 340,130 C 330,145 320,165 310,185 C 290,190 270,180 250,190 C 235,198 220,185 210,180 C 210,165 200,155 190,135 Z" 
                  className={getProvinceClass('GIPUZKOA')}
                  onClick={() => handleSelectProvince('GIPUZKOA')}
                  id="path-map-gipuzkoa"
                  aria-label="Provincia de Gipuzkoa"
                />
                
                {/* Araba Path */}
                <path 
                  d="M 105,195 C 140,195 180,205 210,180 C 220,185 235,198 250,190 C 270,180 290,190 310,185 L 290,245 C 275,265 260,285 240,290 C 210,295 180,275 160,285 C 145,290 120,270 115,250 C 110,230 95,215 105,195 Z" 
                  className={getProvinceClass('ARABA')}
                  onClick={() => handleSelectProvince('ARABA')}
                  id="path-map-araba"
                  aria-label="Provincia de Araba"
                />

                {/* Bilbao marker */}
                <g className="cursor-pointer" onClick={() => handleSelectProvince('BIZKAIA')}>
                  <circle cx="150" cy="160" r="6" fill="#00f5a0" className="animate-ping" style={{ animationDuration: '3s', transformOrigin: 'center', transformBox: 'fill-box' }} />
                  <circle cx="150" cy="160" r="4" fill="#00e5ff" />
                  <text x="150" y="148" textAnchor="middle" fill="#ffffff" fontSize="9" fontFamily="var(--font-mono)">BILBO</text>
                  {layers.weather && (
                    <text x="150" y="174" textAnchor="middle" fill="#00e5ff" fontSize="8" fontFamily="var(--font-mono)">{capitalsData.bilbao.temp}°C</text>
                  )}
                </g>

                {/* Donostia marker */}
                <g className="cursor-pointer" onClick={() => handleSelectProvince('GIPUZKOA')}>
                  <circle cx="270" cy="145" r="6" fill="#00f5a0" className="animate-ping" style={{ animationDuration: '3.5s', transformOrigin: 'center', transformBox: 'fill-box' }} />
                  <circle cx="270" cy="145" r="4" fill="#00e5ff" />
                  <text x="270" y="133" textAnchor="middle" fill="#ffffff" fontSize="9" fontFamily="var(--font-mono)">DONOSTIA</text>
                  {layers.weather && (
                    <text x="270" y="159" textAnchor="middle" fill="#00e5ff" fontSize="8" fontFamily="var(--font-mono)">{capitalsData.donostia.temp}°C</text>
                  )}
                </g>

                {/* Vitoria-Gasteiz marker */}
                <g className="cursor-pointer" onClick={() => handleSelectProvince('ARABA')}>
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
                    <g className="blink-red cursor-pointer" onClick={() => openEmergencyDialog(alerts[0])}>
                      <circle cx="120" cy="150" r="5" fill="#ff3e6c" />
                      <line x1="120" y1="142" x2="120" y2="158" stroke="#ff3e6c" strokeWidth="1" />
                      <line x1="112" y1="150" x2="128" y2="150" stroke="#ff3e6c" strokeWidth="1" />
                    </g>
                    <g className="blink-orange cursor-pointer" onClick={() => openEmergencyDialog(alerts[1])}>
                      <circle cx="225" cy="230" r="5" fill="#ff9100" />
                    </g>
                  </>
                )}

                {/* Wind Vectors on Map */}
                {layers.wind && (
                  <>
                    <g transform="translate(150, 160)" className="pointer-events-none">
                      <g transform={`rotate(${capitalsData.bilbao.windDirection})`}>
                        <line x1="0" y1="0" x2="0" y2="-18" stroke="#00f5a0" strokeWidth="2.5" />
                        <polygon points="0,-18 -4,-10 4,-10" fill="#00f5a0" />
                      </g>
                      <text x="16" y="4" fill="#00f5a0" fontSize="8" fontWeight="bold" fontFamily="var(--font-mono)">{capitalsData.bilbao.windSpeed} km/h</text>
                    </g>
                    <g transform="translate(270, 145)" className="pointer-events-none">
                      <g transform={`rotate(${capitalsData.donostia.windDirection})`}>
                        <line x1="0" y1="0" x2="0" y2="-18" stroke="#00f5a0" strokeWidth="2" />
                        <polygon points="0,-18 -3,-10 3,-10" fill="#00f5a0" />
                      </g>
                      <text x="16" y="4" fill="#00f5a0" fontSize="8" fontWeight="bold" fontFamily="var(--font-mono)">{capitalsData.donostia.windSpeed} km/h</text>
                    </g>
                    <g transform="translate(210, 245)" className="pointer-events-none">
                      <g transform={`rotate(${capitalsData.vitoria.windDirection})`}>
                        <line x1="0" y1="0" x2="0" y2="-18" stroke="#00f5a0" strokeWidth="2" />
                        <polygon points="0,-18 -3,-10 3,-10" fill="#00f5a0" />
                      </g>
                      <text x="16" y="4" fill="#00f5a0" fontSize="8" fontWeight="bold" fontFamily="var(--font-mono)">{capitalsData.vitoria.windSpeed} km/h</text>
                    </g>
                  </>
                )}

                {/* Fires Hazard Indicators on Map */}
                {layers.fires && (
                  <>
                    <g transform="translate(210, 275)" className={`${capitalsData.vitoria.fwi >= 25 ? 'blink-orange' : '' } pointer-events-none`}>
                      <circle cx="0" cy="0" r="4" fill={capitalsData.vitoria.fwi >= 25 ? '#ff9100' : '#d4af37'} />
                      {capitalsData.vitoria.fwi >= 25 && (
                        <circle cx="0" cy="0" r="8" stroke="#ff9100" strokeWidth="1" fill="none" className="animate-ping" style={{ animationDuration: '4s' }} />
                      )}
                      <text x="12" y="3" fill={capitalsData.vitoria.fwi >= 25 ? '#ff9100' : '#d4af37'} fontSize="7" fontWeight="bold" fontFamily="var(--font-mono)">
                        FWI: {capitalsData.vitoria.fwi}
                      </text>
                    </g>
                    <g transform="translate(130, 185)" className={`${capitalsData.bilbao.fwi >= 25 ? 'blink-orange' : '' } pointer-events-none`}>
                      <circle cx="0" cy="0" r="3.5" fill={capitalsData.bilbao.fwi >= 25 ? '#ff9100' : '#d4af37'} />
                      <text x="10" y="3" fill={capitalsData.bilbao.fwi >= 25 ? '#ff9100' : '#d4af37'} fontSize="7" fontWeight="bold" fontFamily="var(--font-mono)">
                        FWI: {capitalsData.bilbao.fwi}
                      </text>
                    </g>
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
                    <g transform="translate(130, 140)" className="pointer-events-none">
                      <circle cx="0" cy="0" r="3.5" fill="#0099ff" />
                      <text x="-8" y="3" textAnchor="end" fill="#0099ff" fontSize="7" fontWeight="bold" fontFamily="var(--font-mono)">
                        NERVIÓN: {nervionRiver?.level}m
                      </text>
                    </g>
                    <g transform="translate(235, 230)" className={`${zadorraRiver?.status !== 'nominal' ? 'blink-orange' : ''} pointer-events-none`}>
                      <circle cx="0" cy="0" r="3.5" fill={zadorraRiver?.status !== 'nominal' ? '#ff9100' : '#0099ff'} />
                      <text x="8" y="3" textAnchor="start" fill={zadorraRiver?.status !== 'nominal' ? '#ff9100' : '#0099ff'} fontSize="7" fontWeight="bold" fontFamily="var(--font-mono)">
                        ZADORRA: {zadorraRiver?.level}m
                      </text>
                    </g>
                    <g transform="translate(280, 170)" className="pointer-events-none">
                      <circle cx="0" cy="0" r="3.5" fill="#0099ff" />
                      <text x="8" y="3" textAnchor="start" fill="#0099ff" fontSize="7" fontWeight="bold" fontFamily="var(--font-mono)">
                        ORIA: {oriaRiver?.level}m
                      </text>
                    </g>
                    <g transform="translate(220, 145)" className="pointer-events-none">
                      <circle cx="0" cy="0" r="3.5" fill="#0099ff" />
                      <text x="8" y="3" textAnchor="start" fill="#0099ff" fontSize="7" fontWeight="bold" fontFamily="var(--font-mono)">
                        DEBA: {debaRiver?.level}m
                      </text>
                    </g>
                    <g transform="translate(285, 130)" className="pointer-events-none">
                      <circle cx="0" cy="0" r="3.5" fill="#0099ff" />
                      <text x="8" y="3" textAnchor="start" fill="#0099ff" fontSize="7" fontWeight="bold" fontFamily="var(--font-mono)">
                        URUMEA: {urumeaRiver?.level}m
                      </text>
                    </g>
                  </>
                )}

                {/* Tides (Mareas / Olas) on Map */}
                {layers.tides && (
                  <>
                    <g transform="translate(150, 85)" className="blink-orange pointer-events-none">
                      <path d="M -8,-2 C -5,-5 -2,-5 1,-2 C 4,1 7,1 10,-2" stroke="#ff9100" strokeWidth="1.5" fill="none" />
                      <path d="M -8,2 C -5,-1 -2,-1 1,2 C 4,5 7,5 10,2" stroke="#ff9100" strokeWidth="1.5" fill="none" />
                      <text x="14" y="2" textAnchor="start" fill="#ff9100" fontSize="7" fontWeight="bold" fontFamily="var(--font-mono)">BOYA MATXITXAKO: 4.2m [AVISO]</text>
                    </g>

                    <g transform="translate(325, 105)" className="pointer-events-none">
                      <path d="M -8,-2 C -5,-5 -2,-5 1,-2 C 4,1 7,1 10,-2" stroke="#d946ef" strokeWidth="1.5" fill="none" />
                      <path d="M -8,2 C -5,-1 -2,-1 1,2 C 4,5 7,5 10,2" stroke="#d946ef" strokeWidth="1.5" fill="none" />
                      <text x="-14" y="2" textAnchor="end" fill="#d946ef" fontSize="7" fontWeight="bold" fontFamily="var(--font-mono)">BOYA PASAIA: 1.8m [OK]</text>
                    </g>
                  </>
                )}

                {/* Geopolitical towns */}
                <g opacity="0.45" className="pointer-events-none">
                  <circle cx="138" cy="158" r="2.5" fill="#ffffff" />
                  <text x="133" y="160" textAnchor="end" fill="#ffffff" fontSize="7" fontFamily="var(--font-mono)">BARAKALDO</text>
                  <circle cx="135" cy="138" r="2.5" fill="#ffffff" />
                  <text x="130" y="139" textAnchor="end" fill="#ffffff" fontSize="7" fontFamily="var(--font-mono)">GETXO</text>
                  <circle cx="315" cy="120" r="2.5" fill="#ffffff" />
                  <text x="315" y="114" textAnchor="middle" fill="#ffffff" fontSize="7" fontFamily="var(--font-mono)">IRUN</text>
                  <circle cx="210" cy="155" r="2.5" fill="#ffffff" />
                  <text x="205" y="157" textAnchor="end" fill="#ffffff" fontSize="7" fontFamily="var(--font-mono)">EIBAR</text>
                  <circle cx="128" cy="208" r="2.5" fill="#ffffff" />
                  <text x="123" y="210" textAnchor="end" fill="#ffffff" fontSize="7" fontFamily="var(--font-mono)">LAUDIO</text>
                  <circle cx="255" cy="245" r="2.5" fill="#ffffff" />
                  <text x="260" y="247" textAnchor="start" fill="#ffffff" fontSize="7" fontFamily="var(--font-mono)">AGURAIN</text>
                </g>

                {/* Mountain Summits */}
                <g className="pointer-events-none">
                  <polygon points="170,204 166,212 174,212" fill="#d4af37" />
                  <text x="170" y="221" textAnchor="middle" fill="#d4af37" fontSize="6.5" fontWeight="bold" fontFamily="var(--font-mono)">GORBEIA (1482m)</text>
                  <polygon points="185,190 181,198 189,198" fill="#d4af37" />
                  <text x="185" y="206" textAnchor="middle" fill="#d4af37" fontSize="6.5" fontWeight="bold" fontFamily="var(--font-mono)">ANBOTO (1331m)</text>
                  <polygon points="250,204 246,212 254,212" fill="#d4af37" />
                  <text x="250" y="221" textAnchor="middle" fill="#d4af37" fontSize="6.5" fontWeight="bold" fontFamily="var(--font-mono)">AKETEGI (1551m)</text>
                  <polygon points="264,190 260,198 268,198" fill="#d4af37" />
                  <text x="264" y="181" textAnchor="middle" fill="#d4af37" fontSize="6.5" fontWeight="bold" fontFamily="var(--font-mono)">AIZKORRI (1528m)</text>
                  <polygon points="190,289 186,297 194,297" fill="#d4af37" />
                  <text x="190" y="305" textAnchor="middle" fill="#d4af37" fontSize="6.5" fontWeight="bold" fontFamily="var(--font-mono)">TOLOÑO (1271m)</text>
                </g>
              </svg>
            </div>

            {/* Quick Province Selector buttons */}
            <div className="flex gap-2 justify-center font-mono text-[9px] uppercase tracking-wider">
              {['ALL', 'BIZKAIA', 'GIPUZKOA', 'ARABA'].map(prov => (
                <button
                  type="button"
                  key={prov}
                  onClick={() => handleSelectProvince(prov)}
                  aria-pressed={selectedProvince === prov}
                  className={`px-3 py-1.5 rounded border transition-all cursor-pointer ${
                    selectedProvince === prov 
                      ? 'bg-cyan-10 border-cyan-35 text-cyan font-bold shadow-cyan-glow'
                      : 'bg-white/5 border-white/5 text-slate-400'
                  }`}
                  id={`btn-prov-${prov.toLowerCase()}`}
                  aria-label={`Seleccionar provincia ${prov}`}
                >
                  {prov}
                </button>
              ))}
            </div>
          </div>

          {/* =====================================================================
              MODERN WEB GUIDANCE (`switch`): Accessible <input type="checkbox" switch>
              with associated <label> instead of non-accessible clickable <div>s
              ===================================================================== */}
          <div className="hud-panel corner-ticks">
            <h3 className="text-[10px] font-mono font-bold tracking-widest text-gold border-b border-white/5 pb-2 mb-3">
              CAPAS DEL MAPA // NATIVE SWITCH CONTROLS
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-2 gap-3">
              {Object.keys(layers).map((layerKey) => {
                const isChecked = layers[layerKey as keyof typeof layers];
                return (
                  <label
                    key={layerKey}
                    htmlFor={`layer-switch-${layerKey}`}
                    className="hud-layer-label"
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isChecked ? getLayerDotClass(layerKey) : 'bg-slate-500'}`} />
                      <span>{layerKey.toUpperCase()}</span>
                    </span>
                    <input
                      id={`layer-switch-${layerKey}`}
                      type="checkbox"
                      {...({ switch: '' } as Record<string, string>)}
                      checked={isChecked}
                      onChange={(e) =>
                        setLayers(prev => ({ ...prev, [layerKey]: e.target.checked }))
                      }
                      className="hud-switch-input"
                    />
                  </label>
                );
              })}
            </div>
          </div>

        </section>

        {/* RIGHT COLUMN: Tab Panel and Details */}
        <section className="hud-scroller w-full lg:w-[52%] p-6 flex flex-col gap-6 overflow-y-auto">
          
          {/* =====================================================================
              MODERN WEB GUIDANCE (`tabs`):
              - `focusgroup="tablist nomemory"` + `role="tablist"`
              - `[aria-selected="true"]::after` 3px non-color underline shape
              - Scroll-driven edge fades via registered `@property --fade-start`
              ===================================================================== */}
          <div
            role="tablist"
            aria-label="Módulos de telemetría ambiental de Euskadi"
            {...({ focusgroup: 'tablist nomemory' } as Record<string, string>)}
            className="hud-tablist no-print"
          >
            {tabsConfig.map(tab => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  type="button"
                  role="tab"
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  aria-selected={isSelected}
                  data-alert={tab.status === 'alert' ? 'true' : undefined}
                  {...(isSelected ? ({ focusgroupstart: '' } as Record<string, string>) : {})}
                  onClick={(e) => handleSelectTab(tab.id, e.currentTarget)}
                  className="hud-tab"
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Active Stage Heading target for accessible focus routing after View Transition */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h2
              ref={stageHeadingRef}
              tabIndex={-1}
              className="text-xs font-mono font-bold uppercase tracking-widest text-cyan"
            >
              MÓDULO ACTIVO: {activeTabMeta.label} {selectedProvince !== 'ALL' ? `// ${selectedProvince}` : '// EUSKADI GLOBAL'}
            </h2>
            <span className="text-[8px] font-mono text-slate-400 uppercase">
              CTRL+F SEARCHABLE PANELS (hidden=&quot;until-found&quot;)
            </span>
          </div>

          {/* =====================================================================
              MODERN WEB GUIDANCE (`tabs` + `same-document-transitions`):
              All tabpanels rendered in a single-cell grid stack with `hidden="until-found"`
              on inactive panels and `onBeforeMatch` to activate when matched by Find-in-Page!
              ===================================================================== */}
          <div className="hud-active-stage hud-tabpanels-stack flex-1">
            
            {/* 1. WEATHER & CLIMATE MODULE */}
            <div
              role="tabpanel"
              id="panel-meteo"
              aria-labelledby="tab-meteo"
              tabIndex={activeTab === 'meteo' ? 0 : undefined}
              {...(activeTab !== 'meteo' ? ({ hidden: 'until-found' } as Record<string, string>) : {})}
              ref={(el) => {
                if (!el) return;
                el.onbeforematch = () => setActiveTab('meteo');
              }}
              className="hud-tabpanel"
            >
              <div className="flex flex-col gap-4">
                {Object.keys(capitalsData).map(key => {
                  const data = capitalsData[key];
                  if (selectedProvince !== 'ALL' && selectedProvince !== data.province) return null;
                  
                  return (
                    <div key={key} className="capital-card-container">
                      <div className="hud-panel corner-ticks capital-card-layout">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-white/5 rounded border border-white/5">
                            {getWeatherIcon(data.weatherCode)}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white font-mono uppercase">{data.name} ({data.basqueName})</h4>
                            <span className="text-[9px] text-cyan font-mono tracking-widest uppercase">{data.province} // CAPTURA OK</span>
                          </div>
                        </div>

                        <div className="capital-metrics-grid font-mono">
                          <div className="flex flex-col border-l border-white/10 pl-4">
                            <span className="text-[7px] text-slate-500 uppercase">Temperatura</span>
                            <span className="text-xl font-bold text-white tabular-nums">{data.temp}°C</span>
                            <span className="text-[7px] text-slate-400 tabular-nums">SENS: {data.apparentTemp}°C</span>
                          </div>

                          <div className="flex flex-col border-l border-white/10 pl-4">
                            <span className="text-[7px] text-slate-500 uppercase">Humedad Rel</span>
                            <span className="text-xl font-bold text-green tabular-nums">{data.humidity}%</span>
                            <span className="text-[7px] text-slate-400">ESTADO: {data.humidity < 40 ? 'SECO' : 'ÓPTIMO'}</span>
                          </div>

                          <div className="flex flex-col border-l border-white/10 pl-4">
                            <span className="text-[7px] text-slate-500 uppercase">Vel. Viento</span>
                            <span className="text-xl font-bold text-cyan tabular-nums">{data.windSpeed} km/h</span>
                            <span className="text-[7px] text-slate-400 flex items-center gap-1 tabular-nums">
                              <Compass className="w-2.5 h-2.5" /> DIR: {data.windDirection}°
                            </span>
                          </div>

                          <div className="flex flex-col border-l border-white/10 pl-4">
                            <span className="text-[7px] text-slate-500 uppercase">Cielo / Zerua</span>
                            <span className="text-[10px] font-bold text-slate-200 uppercase mt-1">{getWeatherDesc(data.weatherCode)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. TIDES & ASTRONOMICAL EVENTS */}
            <div
              role="tabpanel"
              id="panel-tides"
              aria-labelledby="tab-tides"
              tabIndex={activeTab === 'tides' ? 0 : undefined}
              {...(activeTab !== 'tides' ? ({ hidden: 'until-found' } as Record<string, string>) : {})}
              ref={(el) => {
                if (!el) return;
                el.onbeforematch = () => setActiveTab('tides');
              }}
              className="hud-tabpanel"
            >
              <div className="flex flex-col gap-6">
                <div className="hud-panel corner-ticks grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex flex-col justify-between">
                    <div>
                      <h4 className="text-[10px] font-mono font-bold tracking-widest text-cyan border-b border-white/5 pb-2 mb-3">
                        SENSOR MAREA // COASTAL TIDES
                      </h4>
                      <span className="text-[8px] text-slate-500 font-mono uppercase block mb-1">Altura Estimada</span>
                      <span className="text-3xl font-mono font-bold text-white tabular-nums">{tide.height}m</span>
                    </div>
                    <span className="text-[8px] font-mono text-green mt-2 block">{tide.state.toUpperCase()}</span>
                  </div>

                  <div className="flex flex-col justify-between border-l border-white/5 pl-6">
                    <div>
                      <h4 className="text-[10px] font-mono font-bold tracking-widest text-slate-400 border-b border-white/5 pb-2 mb-3">
                        DIRECCIÓN / TENDENCIA
                      </h4>
                      <span className="text-[8px] text-slate-500 font-mono uppercase block mb-1">Marea Flujo</span>
                      <span className="text-xl font-mono font-bold text-cyan">{tide.trend.toUpperCase()}</span>
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
                          <span className="text-green font-bold tabular-nums">En {tide.nextHigh}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">BAJAMAR (LOW TIDE):</span>
                          <span className="text-red font-bold tabular-nums">En {tide.nextLow}</span>
                        </div>
                      </div>
                    </div>
                    <span className="text-[7px] text-slate-500 font-mono block">MEDICIÓN: ESTACIÓN PUERTO BILBAO</span>
                  </div>
                </div>

                <div className="hud-panel corner-ticks grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-3">
                    <h4 className="text-[10px] font-mono font-bold tracking-widest text-gold border-b border-white/5 pb-2 mb-2">
                      FASES LUNARES // ILARGI FASEA
                    </h4>
                    <div className="flex items-center gap-4 bg-black/25 border border-white/5 p-3 rounded">
                      <Moon className="w-10 h-10 text-slate-300 animate-pulse" />
                      <div>
                        <span className="text-xs font-bold text-white font-mono">{moon.label}</span>
                        <span className="text-[8px] text-slate-500 font-mono block uppercase mt-0.5 tabular-nums">
                          Edad del Ciclo: {Math.round(moon.phase * 100)}%
                        </span>
                      </div>
                    </div>
                    <p className="text-[9px] text-slate-400">
                      * Las mareas vivas (Sizigia) ocurren cerca de la Luna Nueva (Ilberria) e Ilbetea (Luna Llena).
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <h4 className="text-[10px] font-mono font-bold tracking-widest text-gold border-b border-white/5 pb-2 mb-2">
                      CICLO SOLAR // EGUR-ARGIA
                    </h4>
                    <div className="flex flex-col gap-2 font-mono text-[9px]">
                      <div className="flex justify-between bg-black/25 border border-white/5 p-2 rounded items-center">
                        <span className="text-slate-400">SALIDA DEL SOL (ORTO):</span>
                        <span className="text-gold font-bold text-xs tabular-nums">{capitalsData.vitoria.sunrise}</span>
                      </div>
                      <div className="flex justify-between bg-black/25 border border-white/5 p-2 rounded items-center">
                        <span className="text-slate-400">PUESTA DEL SOL (OCASO):</span>
                        <span className="text-orange font-bold text-xs tabular-nums">{capitalsData.vitoria.sunset}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. FIRE RISK & WIND SPEED */}
            <div
              role="tabpanel"
              id="panel-fire"
              aria-labelledby="tab-fire"
              tabIndex={activeTab === 'fire' ? 0 : undefined}
              {...(activeTab !== 'fire' ? ({ hidden: 'until-found' } as Record<string, string>) : {})}
              ref={(el) => {
                if (!el) return;
                el.onbeforematch = () => setActiveTab('fire');
              }}
              className="hud-tabpanel"
            >
              <div className="flex flex-col gap-6">
                <div className="hud-panel corner-ticks">
                  <h4 className="text-[10px] font-mono font-bold tracking-widest text-red border-b border-white/5 pb-2 mb-4 flex items-center gap-2">
                    <Flame className="w-4 h-4 text-red" />
                    ÍNDICE DE RIESGO DE INCENDIOS (COPERNICUS EFFIS FWI)
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.keys(capitalsData).map(key => {
                      const data = capitalsData[key];
                      if (selectedProvince !== 'ALL' && selectedProvince !== data.province) return null;
                      const isDanger = data.fwi >= 25;

                      return (
                        <div key={key} className="bg-black/25 border border-white/5 p-4 rounded flex flex-col justify-between font-mono">
                          <span className="text-xs font-bold text-white">{data.name}</span>
                          <div className="my-3">
                            <span className="text-[7px] text-slate-500 uppercase block">Calculated FWI</span>
                            <span className={`text-2xl font-bold tabular-nums ${isDanger ? 'text-red' : 'text-green'}`}>{data.fwi}</span>
                          </div>
                          <div className="border-t border-white/5 pt-2 mt-2">
                            <span className="text-[8px] text-slate-400 uppercase">RIESGO:</span>
                            <span className={`text-[9px] font-bold uppercase ml-2 ${isDanger ? 'text-red' : 'text-green'}`}>{data.fwiCategory}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="hud-panel corner-ticks">
                  <h4 className="text-[10px] font-mono font-bold tracking-widest text-cyan border-b border-white/5 pb-2 mb-4 flex items-center gap-2">
                    <Wind className="w-4 h-4 text-cyan" />
                    VECTOR DIRECCIÓN Y FUERZA DEL VIENTO
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.keys(capitalsData).map(key => {
                      const data = capitalsData[key];
                      if (selectedProvince !== 'ALL' && selectedProvince !== data.province) return null;
                      const isHighWind = data.windSpeed >= 50;

                      return (
                        <div key={key} className="bg-black/25 border border-white/5 p-4 rounded flex flex-col items-center justify-between font-mono">
                          <span className="text-xs font-bold text-white">{data.name} ({data.windDirection}°)</span>
                          <div className="my-3 text-xl font-bold text-cyan tabular-nums">
                            {data.windSpeed} km/h
                          </div>
                          <div className="w-full flex justify-between border-t border-white/5 pt-2">
                            <span className="text-[8px] text-slate-500 uppercase">ESTADO:</span>
                            <span className={`text-[9px] font-bold ${isHighWind ? 'text-red blink-red' : 'text-green'}`}>
                              {isHighWind ? 'VENDAVAL' : 'OPERATIVO'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* 4. RIVERS & RESERVOIRS (MODERN WEB GUIDANCE: `responsive-table`) */}
            <div
              role="tabpanel"
              id="panel-hydro"
              aria-labelledby="tab-hydro"
              tabIndex={activeTab === 'hydro' ? 0 : undefined}
              {...(activeTab !== 'hydro' ? ({ hidden: 'until-found' } as Record<string, string>) : {})}
              ref={(el) => {
                if (!el) return;
                el.onbeforematch = () => setActiveTab('hydro');
              }}
              className="hud-tabpanel"
            >
              <div className="flex flex-col gap-6">
                <div className="hud-panel corner-ticks">
                  <h4 className="text-[10px] font-mono font-bold tracking-widest text-cyan border-b border-white/5 pb-2 mb-4 flex items-center gap-2">
                    <Droplet className="w-4 h-4 text-cyan" />
                    RED HIDROGRÁFICA URA // TABLA SEMÁNTICA ADAPTATIVA (@container)
                  </h4>

                  <div
                    tabIndex={0}
                    role="region"
                    aria-labelledby="ura-rivers-caption"
                    className="hud-table-region hud-scroller"
                  >
                    <table className="hud-table">
                      <caption id="ura-rivers-caption">
                         Telemetría de Estaciones de Aforo Hidrográfico de Euskadi (URA)
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">Estación / Río</th>
                          <th scope="col">Territorio</th>
                          <th scope="col">Nivel / Umbral</th>
                          <th scope="col">Caudal</th>
                          <th scope="col">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rivers.map(river => {
                          if (selectedProvince !== 'ALL' && selectedProvince !== river.province) return null;
                          const isWarning = river.status === 'warning' || river.level >= river.criticalLevel * 0.8;
                          const isAlert = river.status === 'alert' || river.level >= river.criticalLevel;

                          return (
                            <tr key={river.id}>
                              <th scope="row">{river.name}</th>
                              <td className="text-slate-300">{river.province}</td>
                              <td className="text-white font-bold">
                                {river.level}m <span className="text-slate-500 text-[9px]">(Lím: {river.criticalLevel}m)</span>
                              </td>
                              <td className="text-cyan font-bold">{river.flow} m³/s</td>
                              <td>
                                <span className={`px-2 py-1 rounded text-[9px] font-bold uppercase ${
                                  isAlert
                                    ? 'bg-red-10 border border-red-35 text-red blink-red'
                                    : isWarning
                                      ? 'bg-orange-10 border border-orange-35 text-orange blink-orange'
                                      : 'bg-green-10 border border-green-35 text-green'
                                }`}>
                                  {isAlert ? 'CRÍTICO' : isWarning ? 'ALERTA' : 'NOMINAL'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Reservoir levels capacity */}
                <div className="hud-panel corner-ticks">
                  <h4 className="text-[10px] font-mono font-bold tracking-widest text-cyan border-b border-white/5 pb-2 mb-4">
                    RESERVAS HIDROGRÁFICAS // EMBALSES
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
                    {reservoirs.map(res => {
                      if (selectedProvince !== 'ALL' && selectedProvince !== res.province) return null;
                      return (
                        <div key={res.name} className="bg-black/25 border border-white/5 p-4 rounded flex flex-col gap-3">
                          <div className="flex justify-between items-start">
                            <span className="text-white font-bold">{res.name}</span>
                            <span className="text-[7px] text-slate-500 uppercase">{res.province}</span>
                          </div>
                          <div>
                            <div className="flex justify-between text-[9px] mb-1 tabular-nums">
                              <span className="text-slate-500">CAPACIDAD:</span>
                              <span className="text-white font-bold">{res.currentLevel} / {res.capacity} hm³</span>
                            </div>
                            <span className="text-green text-xs font-bold block text-right mt-1 tabular-nums">{res.percentage}% LLENO</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* 5. WEATHER & CIVIL DEFENSE ALERTS BOARD */}
            <div
              role="tabpanel"
              id="panel-alerts"
              aria-labelledby="tab-alerts"
              tabIndex={activeTab === 'alerts' ? 0 : undefined}
              {...(activeTab !== 'alerts' ? ({ hidden: 'until-found' } as Record<string, string>) : {})}
              ref={(el) => {
                if (!el) return;
                el.onbeforematch = () => setActiveTab('alerts');
              }}
              className="hud-tabpanel"
            >
              <div className="hud-panel corner-ticks">
                <h4 className="text-[10px] font-mono font-bold tracking-widest text-red border-b border-white/5 pb-2 mb-4 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red" />
                  TABLÓN OFICIAL DE FENÓMENOS ADVERSOS (EUSKALMET & SOS DEIAK)
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
                            ? 'bg-red-10 border-red-35 text-white' 
                            : isOrange 
                              ? 'bg-orange-10 border-orange-35 text-white' 
                              : 'bg-[#d4af37]/10 border-gold/35 text-white'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <AlertTriangle className={`w-5 h-5 shrink-0 ${isRed ? 'text-red blink-red' : isOrange ? 'text-orange blink-orange' : 'text-gold blink-gold'}`} />
                          <div className="flex flex-col">
                            <span className={`text-[10px] font-mono font-bold uppercase tracking-widest ${
                              isRed ? 'text-red' : isOrange ? 'text-orange' : 'text-gold'
                            }`}>
                              {alert.province} // {alert.type}
                            </span>
                            <p className="text-xs mt-1.5 text-slate-100">{alert.message}</p>
                          </div>
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => openEmergencyDialog(alert)}
                          className="px-3 py-1.5 rounded bg-black/45 border border-white/15 text-[9px] font-mono font-bold uppercase text-cyan cursor-pointer shrink-0"
                        >
                          PROTOCOLO 112 →
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 6. REPORT GENERATOR (TXOSTENAK) & PRINT */}
            <div
              role="tabpanel"
              id="panel-report"
              aria-labelledby="tab-report"
              tabIndex={activeTab === 'report' ? 0 : undefined}
              {...(activeTab !== 'report' ? ({ hidden: 'until-found' } as Record<string, string>) : {})}
              ref={(el) => {
                if (!el) return;
                el.onbeforematch = () => setActiveTab('report');
              }}
              className="hud-tabpanel"
            >
              <div className="flex flex-col gap-6">
                <div className="hud-panel corner-ticks flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                  <div>
                    <h4 className="text-sm font-bold text-white font-mono uppercase">Generador de Informes / Txostenak</h4>
                    <span className="text-[9px] text-cyan font-mono tracking-widest uppercase">Exportar telemetría ambiental para protección civil</span>
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={triggerPrint} 
                      className="flex items-center gap-2 px-3 py-2 bg-cyan-10 border border-cyan-35 text-white text-xs font-mono font-bold uppercase tracking-wider rounded cursor-pointer"
                      id="btn-print-report"
                    >
                      <Printer className="w-3.5 h-3.5 text-cyan" />
                      Imprimir
                    </button>
                    
                    <button 
                      type="button"
                      onClick={sendEmail} 
                      className="flex items-center gap-2 px-3 py-2 bg-[#d4af37]/10 border border-gold/35 text-white text-xs font-mono font-bold uppercase tracking-wider rounded cursor-pointer"
                      id="btn-email-report"
                    >
                      <Mail className="w-3.5 h-3.5 text-gold" />
                      Enviar por Email
                    </button>
                  </div>
                </div>

                <div className="hud-panel corner-ticks flex flex-col gap-4">
                  <h4 className="text-[10px] font-mono font-bold tracking-widest text-gold border-b border-white/5 pb-2 flex justify-between items-center">
                    <span>DESTINATARIO Y MENSAJE</span>
                    {emailSuccess && <span className="text-green blink-green font-bold">✓ REPORTE ENVIADO (SMTP OK)</span>}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-[9px]">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="input-email-recipient" className="text-slate-500 uppercase">Destinatario:</label>
                      <input 
                        type="email" 
                        value={emailForm.recipient} 
                        onChange={(e) => setEmailForm(prev => ({ ...prev, recipient: e.target.value }))}
                        className="bg-black/45 border border-white/10 p-2.5 rounded text-white"
                        id="input-email-recipient"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="input-email-subject" className="text-slate-500 uppercase">Asunto / Subject:</label>
                      <input 
                        type="text" 
                        value={emailForm.subject} 
                        onChange={(e) => setEmailForm(prev => ({ ...prev, subject: e.target.value }))}
                        className="bg-black/45 border border-white/10 p-2.5 rounded text-white"
                        id="input-email-subject"
                      />
                    </div>
                  </div>
                </div>

                {(smtpLog.length > 0 || isSendingEmail) && (
                  <div className="hud-panel corner-ticks bg-black/45 border border-white/10 p-4 rounded font-mono text-[9px] text-green flex flex-col gap-1">
                    <span className="text-[8px] text-slate-500 uppercase tracking-widest border-b border-white/5 pb-1.5 mb-2 flex items-center justify-between">
                      SMTP LOG TELEMETRY GATEWAY
                    </span>
                    {smtpLog.map((log, index) => (
                      <div key={index} className={log.startsWith('✓') ? 'text-cyan font-bold' : 'text-green'}>
                        {log}
                      </div>
                    ))}
                  </div>
                )}

                <div className="hud-panel border-white/15 bg-black/45 p-6 rounded flex flex-col gap-4 font-mono text-[9px] text-slate-300">
                  <div className="flex justify-between border-b border-white/10 pb-4 items-center">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white">EGUR-NEXUS TELEMETRY REPORT</span>
                      <span className="text-[7px] text-slate-500 mt-1">EUSKADI ENVIRONMENTAL PROTECTION PORTAL</span>
                    </div>
                    <div className="text-right tabular-nums">
                      <span className="text-slate-400 block">FECHA: {currentTime.toLocaleDateString('es-ES')}</span>
                      <span className="text-slate-400 block">HORA: {currentTime.toLocaleTimeString('es-ES')}</span>
                    </div>
                  </div>
                  <pre className="text-[9px] text-slate-300 font-mono" style={{ whiteSpace: 'pre-wrap' }}>
                    {emailForm.body}
                  </pre>
                </div>
              </div>
            </div>

          </div>

        </section>

      </main>

      {/* FOOTER: Osiris-style Bottom coordinates & state bar */}
      <footer className="no-print h-10 border-t border-white/5 bg-[#05050b]/90 text-slate-500 flex items-center px-6 justify-between text-[8px] font-mono uppercase tracking-widest z-40">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span>SENSORS:</span>
            <span className="text-green font-bold">ORBITAL_LATTICE_OK</span>
          </div>
          <div className="flex items-center gap-2">
            <span>WEB PLATFORM:</span>
            <span className="text-cyan">BASELINE 2026 NATIVE</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-slate-300">
          <span>© 2026 EGUR-NEXUS // GUSTAVO SANABRIA // TODOS LOS DERECHOS RESERVADOS</span>
        </div>
      </footer>
    </div>
  );
}
