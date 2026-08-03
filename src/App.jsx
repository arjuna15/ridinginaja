import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Map as MapIcon, Activity, Navigation, ChevronRight, Zap, Bike, LogOut, LocateFixed, LayoutTemplate, X, Download, Headset, Mic, MicOff, PhoneOff, Search, Settings, Mail, Ruler, Moon, Info, Shield, ChevronDown, Trash2, AlertTriangle, Fuel, Wrench } from 'lucide-react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import html2canvas from 'html2canvas';
import { Peer } from 'peerjs';
import { useRegisterSW } from 'virtual:pwa-register/react';
import 'leaflet/dist/leaflet.css';
import { registerPlugin, Capacitor } from '@capacitor/core';
import { supabase } from './supabaseClient';
import bikeDatabase from './bikeDatabase';

const RadioService = registerPlugin('RadioService');

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const bikeIcon = L.divIcon({
  className: 'custom-bike-icon',
  html: `<div style="width:16px;height:16px;background:#4a90e2;border-radius:50%;border:3px solid white;box-shadow:0 0 15px #4a90e2;"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

function MapBoundsFitter({ path }) {
  const map = useMap();
  useEffect(() => {
    if (path && path.length > 0) {
      if (map.dragging) map.dragging.disable();
      if (map.touchZoom) map.touchZoom.disable();
      if (map.doubleClickZoom) map.doubleClickZoom.disable();
      if (map.scrollWheelZoom) map.scrollWheelZoom.disable();

      const fit = () => {
        map.invalidateSize();
        const bounds = L.latLngBounds(path);
        map.fitBounds(bounds, { 
          padding: [50, 50],
          animate: false
        });
      };

      fit();
      const container = map.getContainer();
      const observer = new ResizeObserver(() => {
        fit();
      });
      observer.observe(container);
      
      return () => {
        observer.disconnect();
        if (map.dragging) map.dragging.enable();
        if (map.touchZoom) map.touchZoom.enable();
        if (map.doubleClickZoom) map.doubleClickZoom.enable();
        if (map.scrollWheelZoom) map.scrollWheelZoom.enable();
      };
    }
  }, [path, map]);
  return null;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; 
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; 
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function App() {
  const mapRef = useRef(null);
  const shareContainerRef = useRef(null); 

  // PWA Update Prompt
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered:', r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  // Auth State
  const [session, setSession] = useState(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  // App State
  const [activeTab, setActiveTab] = useState('RIDE');
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(0); 
  const [topSpeed, setTopSpeed] = useState(0);
  const [distance, setDistance] = useState(0); 
  const [time, setTime] = useState(0); 
  const [statusText, setStatusText] = useState("Locating...");
  const [mapStyle, setMapStyle] = useState('DARK'); // DARK, SATELLITE, STREET
  
  // God Tier Features State
  const [maxLeanAngle, setMaxLeanAngle] = useState(0);
  const [currentLeanAngle, setCurrentLeanAngle] = useState(0);
  const [maxAltitude, setMaxAltitude] = useState(0);
  const [groupLocations, setGroupLocations] = useState({}); // { userId: {lat, lng, speed} }
  
  // Share Export State
  const [shareMode, setShareMode] = useState(false);
  const [shareTheme, setShareTheme] = useState('CLASSIC'); // CLASSIC, NEON, MINIMAL
  const [storyTitle, setStoryTitle] = useState('Afternoon Ride');
  const [isTransparentBg, setIsTransparentBg] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isEditorCollapsed, setIsEditorCollapsed] = useState(false);
  
  const [currentPosition, setCurrentPosition] = useState([-6.2088, 106.8456]); 
  const [routePath, setRoutePath] = useState([]); 

  // Cloud State
  const [bikes, setBikes] = useState([]);
  const [rides, setRides] = useState([]);
  const [showAddBike, setShowAddBike] = useState(false);
  const [newBike, setNewBike] = useState({ brand: '', name: '', type: '' });
  const [bikeSearch, setBikeSearch] = useState('');
  const [viewingRoute, setViewingRoute] = useState(null);
  
  // Tuning / Bore Up State
  const [tuningConfigs, setTuningConfigs] = useState(() => JSON.parse(localStorage.getItem('mokat_tuning_configs') || '{}'));
  const [expandedTuningBike, setExpandedTuningBike] = useState(null);

  // SOS Emergency State
  const [showSosModal, setShowSosModal] = useState(false);
  const [sosCountdown, setSosCountdown] = useState(5);
  const [isSosActive, setIsSosActive] = useState(false);
  const [emergencyContact, setEmergencyContact] = useState('');
  const sosTimerRef = useRef(null);

  // Maintenance State
  const [lastOilChangeKm, setLastOilChangeKm] = useState(0);

  // Settings State
  const [displayName, setDisplayName] = useState('');
  const [distanceUnit, setDistanceUnit] = useState(() => localStorage.getItem('mokat_distance_unit') || 'km');
  const [speedUnit, setSpeedUnit] = useState(() => localStorage.getItem('mokat_speed_unit') || 'kmh');

  // Radio State
  const [inRadio, setInRadio] = useState(false);
  const [radioStatus, setRadioStatus] = useState("Offline");
  const [radioPeers, setRadioPeers] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [audioInputs, setAudioInputs] = useState([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState('');
  const [isMicDropdownOpen, setIsMicDropdownOpen] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [activeRoomCode, setActiveRoomCode] = useState('');
  
  const generateRandomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let res = 'MOKAT-';
    for (let i = 0; i < 4; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setRoomCode(res);
  };
  const localStreamRef = useRef(null);
  const peerInstanceRef = useRef(null);
  const radioChannelRef = useRef(null);
  const callsRef = useRef({});

  const watchIdRef = useRef(null);
  const timerRef = useRef(null);
  const prevPosRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  useEffect(() => {
    if (session?.user) {
      const savedName = localStorage.getItem('mokat_name_' + session.user.id) || session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || '';
      setDisplayName(savedName);
      
      const savedSos = localStorage.getItem('mokat_emergency_contact_' + session.user.id) || localStorage.getItem('mokat_emergency_contact') || '';
      setEmergencyContact(savedSos);

      const savedOil = localStorage.getItem('mokat_oil_km_' + session.user.id) || localStorage.getItem('mokat_oil_km') || 0;
      setLastOilChangeKm(Number(savedOil) || 0);

      fetchCloudData();
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setCurrentPosition([latitude, longitude]);
          setStatusText("GPS Ready");
          if (mapRef.current) {
            mapRef.current.flyTo([latitude, longitude], 16);
          }
        },
        () => setStatusText("GPS Denied"),
        { enableHighAccuracy: true }
      );
    }
  }, [session]);

  useEffect(() => {
    if (viewingRoute?.created_at) {
      const hour = new Date(viewingRoute.created_at).getHours();
      let title = 'Afternoon Ride ☀️';
      if (hour >= 5 && hour < 12) title = 'Sunmori Ride 🌅';
      else if (hour >= 12 && hour < 17) title = 'Afternoon Ride ☀️';
      else if (hour >= 17 && hour < 20) title = 'Sunset Ride 🌆';
      else title = 'Night Run 🌙';
      setStoryTitle(title);
    }
  }, [viewingRoute]);

  const fetchCloudData = async () => {
    if (!session?.user?.id) return;
    const uid = session.user.id;
    const { data: bikeData, error: bikeError } = await supabase.from('motorcycles').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    if (bikeError) {
      console.error('Failed to fetch bikes:', bikeError);
    } else if (bikeData) {
      setBikes(bikeData);
    }

    const { data: rideData, error: rideError } = await supabase.from('rides').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    if (rideError) {
      console.error('Failed to fetch rides:', rideError);
    } else if (rideData) {
      setRides(rideData);
    }
  };

  // Re-fetch data when app comes back from background (visibility change)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && session?.user) {
        fetchCloudData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [session]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    if (isLoginMode) {
      const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
      if (error) {
        if (error.message.toLowerCase().includes('rate limit')) {
          alert("Server email sedang sibuk. Tunggu 1-2 menit lalu coba klik Sign In lagi.");
        } else {
          alert(error.message);
        }
      }
    } else {
      const { data, error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
      if (error) {
        if (error.message.toLowerCase().includes('rate limit')) {
          // If rate limit error occurs during signup, attempt direct login as account might already be created
          const { error: loginError } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
          if (!loginError) {
            // Rate-limited signup but login succeeded — user is now authenticated
            setStatusText('Login berhasil!');
          } else {
            alert("Batas pengiriman email server penuh. Silakan langsung pindah ke menu 'Sign In' dan masukkan email/password kamu!");
            setIsLoginMode(true);
          }
        } else {
          alert(error.message);
        }
      } else {
        if (data?.session) {
          // Logged in immediately after signup
          setStatusText('Akun berhasil! Selamat datang.');
        } else {
          alert("Akun berhasil dibuat! Silakan coba Sign In sekarang.");
          setIsLoginMode(true);
        }
      }
    }
    setAuthLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // SOS Handler
  const handleTriggerSos = () => {
    setShowSosModal(true);
    setSosCountdown(5);
    let count = 5;
    sosTimerRef.current = setInterval(() => {
      count -= 1;
      setSosCountdown(count);
      if (count <= 0) {
        clearInterval(sosTimerRef.current);
        setIsSosActive(true);
        // Send WhatsApp SOS Location Link
        const [lat, lng] = currentPosition;
        const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
        const msg = encodeURIComponent(`🚨 SOS EMERGENCY ALERT MOKAT! 🚨\nSaya membutuhkan bantuan darurat saat touring!\nPosisi GPS: ${mapsUrl}`);
        
        let targetNum = emergencyContact.trim().replace(/^0/, '62').replace(/[^0-9]/g, '');
        if (targetNum) {
          window.open(`https://api.whatsapp.com/send?phone=${targetNum}&text=${msg}`, '_blank');
        } else {
          window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
        }
      }
    }, 1000);
  };

  const handleCancelSos = () => {
    if (sosTimerRef.current) clearInterval(sosTimerRef.current);
    setShowSosModal(false);
    setIsSosActive(false);
    setSosCountdown(5);
  };

  // God-Tier Sensor Tracking (Lean Angle & Crash Detection)
  useEffect(() => {
    if (!isTracking || isPaused) return;

    const handleOrientation = (e) => {
      if (e.gamma !== null) {
        let angle = Math.abs(Math.round(e.gamma));
        if (angle > 90) angle = 180 - angle;
        setCurrentLeanAngle(angle);
        setMaxLeanAngle(prev => Math.max(prev, angle));
      }
    };

    const handleMotion = (e) => {
      if (e.acceleration) {
        const ax = e.acceleration.x || 0;
        const ay = e.acceleration.y || 0;
        const az = e.acceleration.z || 0;
        const gForce = Math.sqrt(ax * ax + ay * ay + az * az) / 9.81;

        if (gForce > 3.0 && speed < 10) {
           if (!showSosModal) {
             handleTriggerSos();
           }
        }
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);
    window.addEventListener('devicemotion', handleMotion);

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [isTracking, isPaused, speed, showSosModal]);

  // SPBU & Rest Area Finder
  const handleFindNearbyPlaces = (type) => {
    const [lat, lng] = currentPosition;
    let query = 'SPBU Pertamina';
    if (type === 'SPBU') query = 'SPBU Pertamina Shell';
    else if (type === 'FOOD') query = 'Restoran Rumah Makan';
    else if (type === 'REPAIR') query = 'Bengkel Motor Tambal Ban';

    window.open(`https://www.google.com/maps/search/${encodeURIComponent(query)}/@${lat},${lng},15z`, '_blank');
  };

  // Maintenance Handler
  const handleResetOilKm = (totalKm) => {
    setLastOilChangeKm(totalKm);
    if (session?.user?.id) {
      localStorage.setItem('mokat_oil_km_' + session.user.id, totalKm);
    }
    localStorage.setItem('mokat_oil_km', totalKm);
    alert("Berhasil mereset riwayat pergantian Oli Mesin!");
  };

  const handleCenterMap = () => {
    if (mapRef.current && currentPosition) {
      mapRef.current.flyTo(currentPosition, 16, { animate: true, duration: 1 });
    }
  };

  const generateShareImage = async () => {
    if (!shareContainerRef.current) return;
    setIsCapturing(true);

    try {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
      await new Promise(resolve => setTimeout(resolve, 300));

      const targetWidth = shareContainerRef.current.offsetWidth || 360;
      const targetScale = 1080 / targetWidth;

      const canvas = await html2canvas(shareContainerRef.current, {
        useCORS: true,
        scale: targetScale,
        backgroundColor: isTransparentBg ? null : (themeConfigs[shareTheme]?.bg || '#050505'),
        logging: false
      });
      
      const image = canvas.toDataURL("image/png");
      const filename = `mokat-story-${shareTheme.toLowerCase()}-${new Date().getTime()}.png`;

      // Try Native Web Share API (Works seamlessly on Android Chrome / WebViews)
      if (navigator.share && navigator.canShare) {
        try {
          const res = await fetch(image);
          const blob = await res.blob();
          const file = new File([blob], filename, { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'Mokat Touring SG',
              text: 'My Touring Story Stats'
            });
            setIsCapturing(false);
            return;
          }
        } catch (shareErr) {
          console.log("Web Share fallback to direct download:", shareErr);
        }
      }
      
      // Fallback Direct File Download
      const a = document.createElement('a');
      a.href = image;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
    } catch (err) {
      console.error("Failed to generate image:", err);
      alert("Gagal memproses gambar: " + err.message);
    } finally {
      setIsCapturing(false);
    }
  };

  const startTracking = () => {
    if (!navigator.geolocation) {
      alert("Geolocation tidak didukung");
      return;
    }
    setViewingRoute(null);
    setIsTracking(true);
    setIsPaused(false);
    setStatusText("Recording...");
    setRoutePath([]);
    setDistance(0);
    setTime(0);
    setTopSpeed(0);

    handleCenterMap();

    timerRef.current = setInterval(() => {
      setTime(prev => prev + 1);
    }, 1000);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, speed: gpsSpeed } = position.coords;
        const newPos = [latitude, longitude];
        
        setCurrentPosition(newPos);
        setRoutePath(prev => {
           if(prev.length > 0 && prev[prev.length-1][0] === newPos[0]) return prev;
           return [...prev, newPos];
        });

        if (gpsSpeed !== null && gpsSpeed > 0) {
          const currentKmh = Math.round(gpsSpeed * 3.6);
          setSpeed(currentKmh);
          setTopSpeed(prevMax => Math.max(prevMax, currentKmh));
        } else {
          setSpeed(0);
        }

        if (prevPosRef.current) {
          const distMetres = calculateDistance(
            prevPosRef.current.latitude,
            prevPosRef.current.longitude,
            latitude,
            longitude
          );
          if (distMetres > 2) { 
            setDistance(prev => prev + (distMetres / 1000));
          }
        }
        if (position.coords.altitude !== null) {
          setMaxAltitude(prev => Math.max(prev, Math.round(position.coords.altitude)));
        }

        if (radioChannelRef.current && activeRoomCode) {
           radioChannelRef.current.send({
             type: 'broadcast',
             event: 'location',
             payload: { userId: session?.user?.id, lat: latitude, lng: longitude, speed: gpsSpeed ? Math.round(gpsSpeed * 3.6) : 0 }
           });
        }
        
        prevPosRef.current = { latitude, longitude };
      },
      (error) => {
        console.error(error);
        setStatusText("GPS Signal Lost");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );
  };

  const pauseTracking = () => {
    setIsPaused(true);
    setStatusText("Paused");
    setSpeed(0);
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const resumeTracking = () => {
    setIsPaused(false);
    setStatusText("Recording...");

    timerRef.current = setInterval(() => {
      setTime(prev => prev + 1);
    }, 1000);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, speed: gpsSpeed } = position.coords;
        const newPos = [latitude, longitude];
        
        setCurrentPosition(newPos);
        setRoutePath(prev => {
           if(prev.length > 0 && prev[prev.length-1][0] === newPos[0]) return prev;
           return [...prev, newPos];
        });

        if (gpsSpeed !== null && gpsSpeed > 0) {
          const currentKmh = Math.round(gpsSpeed * 3.6);
          setSpeed(currentKmh);
          setTopSpeed(prevMax => Math.max(prevMax, currentKmh));
        } else {
          setSpeed(0);
        }

        if (prevPosRef.current) {
          const distMetres = calculateDistance(
            prevPosRef.current.latitude,
            prevPosRef.current.longitude,
            latitude,
            longitude
          );
          if (distMetres > 2) { 
            setDistance(prev => prev + (distMetres / 1000));
          }
        }
        if (position.coords.altitude !== null) {
          setMaxAltitude(prev => Math.max(prev, Math.round(position.coords.altitude)));
        }

        if (radioChannelRef.current && activeRoomCode) {
           radioChannelRef.current.send({
             type: 'broadcast',
             event: 'location',
             payload: { userId: session?.user?.id, lat: latitude, lng: longitude, speed: gpsSpeed ? Math.round(gpsSpeed * 3.6) : 0 }
           });
        }
        
        prevPosRef.current = { latitude, longitude };
      },
      (error) => {
        console.error(error);
        setStatusText("GPS Signal Lost");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );
  };

  const stopTracking = async () => {
    setIsTracking(false);
    setIsPaused(false);
    
    if (distance > 0 || time > 2) {
      setStatusText("Saving Ride...");
      const avgSpeed = distance > 0 && time > 0 ? (distance / (time / 3600)) : 0;
      const newRide = {
        user_id: session.user.id,
        distance: distance,
        time: time,
        avg_speed: avgSpeed,
        top_speed: topSpeed,
        route_path: routePath
      };
      
      const { data, error } = await supabase.from('rides').insert([newRide]).select();
      
      if (error) {
         console.error("Failed to save ride:", error);
         alert("Database Error: " + error.message);
         setStatusText("Save Failed");
      } else if (data) {
         setRides([data[0], ...rides]);
         setStatusText("Ride Saved!");
      }
    } else {
       setStatusText("Canceled");
       alert("Perjalanan terlalu singkat (kurang dari 3 detik). Rute diabaikan.");
    }

    setSpeed(0);
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    prevPosRef.current = null;
  };

  const handleSaveBike = async (bikeData) => {
    const toSave = bikeData || newBike;
    if (!toSave.name || !toSave.brand) return;
    const newBikeRow = {
      user_id: session.user.id,
      brand: toSave.brand,
      name: toSave.name,
      type: toSave.type || 'Standard'
    };
    const { data, error } = await supabase.from('motorcycles').insert([newBikeRow]).select();
    if (!error && data) {
      setBikes([data[0], ...bikes]);
      setNewBike({ brand: '', name: '', type: '' });
      setBikeSearch('');
      setShowAddBike(false);
    } else {
      console.error("Failed to save bike:", error);
    }
  };

  const handleDeleteBike = async (bikeId) => {
    if (!confirm('Yakin ingin menghapus motor ini dari garage?')) return;
    const { data, error } = await supabase.from('motorcycles').delete().eq('id', bikeId).select();
    if (!error) {
      if (data && data.length === 0) {
        alert("Gagal menghapus: Akses ditolak oleh Database (Supabase RLS). Silakan tambahkan 'DELETE' policy di Supabase Dashboard untuk tabel motorcycles.");
        return;
      }
      setBikes(bikes.filter(b => b.id !== bikeId));
      if (selectedBike?.id === bikeId) {
        setSelectedBike(null);
      }
    } else {
      console.error('Failed to delete bike:', error);
      alert('Gagal menghapus motor: ' + error.message);
    }
  };

  const handleDeleteRide = async (rideId) => {
    if (!confirm('Yakin ingin menghapus riwayat ride ini?')) return;
    const { data, error } = await supabase.from('rides').delete().eq('id', rideId).select();
    if (!error) {
      if (data && data.length === 0) {
        alert("Gagal menghapus: Akses ditolak oleh Database (Supabase RLS). Silakan tambahkan 'DELETE' policy di Supabase Dashboard untuk tabel rides.");
        return;
      }
      setRides(rides.filter(r => r.id !== rideId));
    } else {
      console.error('Failed to delete ride:', error);
      alert('Gagal menghapus ride: ' + error.message);
    }
  };

  const handleUpdateDisplayName = async (name) => {
    setDisplayName(name);
    if (session?.user?.id) {
      localStorage.setItem('mokat_name_' + session.user.id, name);
      try {
        await supabase.auth.updateUser({ data: { display_name: name } });
      } catch (e) {
        console.error("Error updating user metadata:", e);
      }
    }
  };

  const testAudioSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5 note
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
        alert("🔊 Suara audio test berhasil diputar! Jika kamu mendengarnya, speaker HP kamu 100% aktif.");
      }
    } catch (e) {
      console.error(e);
      alert("Gagal memutar audio test.");
    }
  };

  const enumerateMics = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter(d => d.kind === 'audioinput');
      setAudioInputs(mics);
      if (mics.length > 0 && !selectedAudioInput) {
        setSelectedAudioInput(mics[0].deviceId);
      }
    } catch (err) {
      console.warn("Could not enumerate mics:", err);
    }
  };

  const switchMicrophone = async (deviceId) => {
    setSelectedAudioInput(deviceId);
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } }
      });
      const newTrack = newStream.getAudioTracks()[0];
      if (localStreamRef.current) {
        const oldTrack = localStreamRef.current.getAudioTracks()[0];
        if (oldTrack) oldTrack.stop();
        localStreamRef.current.removeTrack(oldTrack);
        localStreamRef.current.addTrack(newTrack);
        newTrack.enabled = !isMuted;
      }
      Object.values(callsRef.current).forEach(call => {
        const sender = call.peerConnection?.getSenders().find(s => s.track?.kind === 'audio');
        if (sender) sender.replaceTrack(newTrack);
      });
    } catch (err) {
      console.error("Failed to switch mic:", err);
    }
  };

  const joinRadio = async () => {
    setInRadio(true);
    try {
      setRadioStatus("Connecting Microphone...");
      if (window.AudioContext || window.webkitAudioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const tempCtx = new AudioCtx();
        if (tempCtx.state === 'suspended') {
          await tempCtx.resume();
        }
      }

      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: { 
            echoCancellation: true, 
            noiseSuppression: true, 
            autoGainControl: true 
          } 
        });
      } catch (e1) {
        // Fallback for laptops with strict/virtual drivers
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      
      stream.getAudioTracks().forEach(track => { track.enabled = true; });
      localStreamRef.current = stream;
      setIsMuted(false);
      await enumerateMics();
      
      setRadioStatus("Connecting to Peer Server...");

      // 3. Initialize PeerJS with multiple public STUN servers for NAT traversal
      const peer = new Peer({
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });
      peerInstanceRef.current = peer;

      peer.on('error', (err) => {
        console.warn("PeerJS error:", err);
      });
      
      peer.on('open', (id) => {
        setInRadio(true);
        const targetRoom = roomCode.trim().toUpperCase() || 'MOKAT-PUBLIC';
        setActiveRoomCode(targetRoom);
        setRadioStatus(`Online in Room [${targetRoom}]`);
        // Start Android Foreground Service so radio doesn't disconnect when app is minimized/screen locked
        if (Capacitor.isNativePlatform()) {
          RadioService.startService({ roomCode: targetRoom }).catch(() => {});
        }

        const channel = supabase.channel(`radio_room_${targetRoom}`, {
          config: { presence: { key: session.user.id } }
        });
        radioChannelRef.current = channel;

        const connectToPeer = (targetPeerId, targetName) => {
          if (!targetPeerId || targetPeerId === id) return;
          if (!callsRef.current[targetPeerId]) {
            const call = peer.call(targetPeerId, stream);
            if (call) setupCallEvents(call, targetName);
          }
        };

        // Listen for Supabase Realtime Broadcast signaling
        channel.on('broadcast', { event: 'rider_joined' }, (payload) => {
          if (payload.payload && payload.payload.peerId !== id) {
            connectToPeer(payload.payload.peerId, payload.payload.displayName);
          }
        });

        // Listen for Live Radar (Group Location)
        channel.on('broadcast', { event: 'location' }, (payload) => {
           if (payload.payload) {
             setGroupLocations(prev => ({
               ...prev,
               [payload.payload.userId]: {
                 lat: payload.payload.lat,
                 lng: payload.payload.lng,
                 speed: payload.payload.speed,
                 updatedAt: Date.now()
               }
             }));
           }
        });

        const syncPeers = () => {
          const state = channel.presenceState();
          for (const key in state) {
            const presenceList = state[key];
            if (presenceList && presenceList[0]) {
              const presence = presenceList[0];
              if (presence.peerId && presence.peerId !== id) {
                if (!callsRef.current[presence.peerId] && id > presence.peerId) {
                  connectToPeer(presence.peerId, presence.displayName || presence.email || "Rider");
                }
              }
            }
          }
        };

        channel.on('presence', { event: 'sync' }, syncPeers);
        channel.on('presence', { event: 'join' }, syncPeers);

        channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            const riderInfo = { 
              user_id: session.user.id, 
              peerId: id, 
              email: session.user.email,
              displayName: displayName || session.user.email?.split('@')[0] || 'Rider'
            };
            await channel.track(riderInfo);
            // Broadcast to active riders in channel
            channel.send({
              type: 'broadcast',
              event: 'rider_joined',
              payload: riderInfo
            });
          }
        });
      });

      peer.on('call', (call) => {
        // Always answer incoming call with our local stream
        call.answer(localStreamRef.current);
        const state = radioChannelRef.current?.presenceState() || {};
        let callerEmail = "Rider";
        for (const key in state) {
          if (state[key][0]?.peerId === call.peer) {
            callerEmail = state[key][0].displayName || state[key][0].email || "Rider";
          }
        }
        setupCallEvents(call, callerEmail);
      });

    } catch (err) {
      console.error(err);
      setInRadio(false);
      setRadioStatus("Failed to access Microphone");
      if (err.name === 'NotAllowedError' || err.message.toLowerCase().includes('permission')) {
        alert("Akses Mikrofon diblokir oleh browser! 🔒\n\nCara memperbaiki:\n1. Klik ikon Gembok 🔒 di kiri atas URL (samping ridinginaja.vercel.app)\n2. Pilih 'Site settings' (Setelan Situs)\n3. Ubah izin Microphone (Mikrofon) menjadi 'Allow' (Izinkan)\n4. Refresh halaman ini.");
      } else {
        alert("Gagal mengakses mikrofon: " + err.message);
      }
    }
  };

  const setupCallEvents = (call, callerEmail) => {
    callsRef.current[call.peer] = call;
    
    call.on('stream', (remoteStream) => {
      let audio = document.getElementById(`audio-${call.peer}`);
      if (!audio) {
        audio = document.createElement('audio');
        audio.id = `audio-${call.peer}`;
        // DO NOT use display:none as it mutes WebKit/Blink media audio context
        audio.style.position = 'fixed';
        audio.style.top = '-9999px';
        audio.style.opacity = '0';
        audio.style.pointerEvents = 'none';
        document.body.appendChild(audio);
      }
      
      audio.srcObject = remoteStream;
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('autoplay', 'true');
      audio.autoplay = true;
      audio.volume = 1.0;
      
      // Attempt immediate play & attach tap-to-play fallback for mobile browser autoplay policy
      const playAudio = () => {
        audio.play().then(() => {
          console.log(`Audio playing for peer ${call.peer}`);
        }).catch(err => {
          console.log("Autoplay blocked by browser policy, unlocking on next user tap:", err);
          const unlock = () => {
            audio.play().catch(() => {});
            document.removeEventListener('pointerdown', unlock);
            document.removeEventListener('click', unlock);
            document.removeEventListener('touchstart', unlock);
          };
          document.addEventListener('pointerdown', unlock, { once: true });
          document.addEventListener('click', unlock, { once: true });
          document.addEventListener('touchstart', unlock, { once: true });
        });
      };
      
      playAudio();
      
      setRadioPeers(prev => {
        if (prev.find(p => p.id === call.peer)) return prev;
        return [...prev, { id: call.peer, email: callerEmail }];
      });
    });

    call.on('close', () => {
      const audio = document.getElementById(`audio-${call.peer}`);
      if (audio) audio.remove();
      delete callsRef.current[call.peer];
      setRadioPeers(prev => prev.filter(p => p.id !== call.peer));
    });

    call.on('error', (err) => {
      console.error("Peer call error:", err);
    });
  };

  const leaveRadio = () => {
    if (radioChannelRef.current) {
      radioChannelRef.current.unsubscribe();
      radioChannelRef.current = null;
    }
    if (peerInstanceRef.current) {
      peerInstanceRef.current.destroy();
      peerInstanceRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    Object.keys(callsRef.current).forEach(peerId => {
      const audio = document.getElementById(`audio-${peerId}`);
      if (audio) audio.remove();
    });
    if (Capacitor.isNativePlatform()) {
      RadioService.stopService().catch(() => {});
    }
    callsRef.current = {};
    setRadioPeers([]);
    setInRadio(false);
    setActiveRoomCode('');
    setRadioStatus('Offline');
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  if (!session) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
         <div className="grid-overlay"></div>
         <div className="glow-orb top-left"></div>
         <div className="glow-orb bottom-right"></div>
         
         <div className="glass-panel" style={{ padding: '40px 32px', width: '100%', maxWidth: '400px', zIndex: 1, borderRadius: '32px' }}>
            <h1 style={{ textAlign: 'center', marginBottom: '12px', fontSize: '32px', fontWeight: '900', letterSpacing: '-1px', background: 'linear-gradient(to right, #fff, #888)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Mokat Touring</h1>
            <p style={{ textAlign: 'center', color: '#888', marginBottom: '40px', fontSize: '15px' }}>Log in to access your cloud garage & routes.</p>
            
            <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
               <input className="glass-input" type="email" placeholder="Email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} required />
               <input className="glass-input" type="password" placeholder="Password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} required />
               <button className="glass-button primary" type="submit" style={{ padding: '12px' }}>
                  {authLoading ? 'Loading...' : (isLoginMode ? 'Sign In' : 'Sign Up')}
               </button>
            </form>

            <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: '#888' }}>
               {isLoginMode ? "Don't have an account? " : "Already have an account? "}
               <span style={{ color: '#4a90e2', cursor: 'pointer' }} onClick={() => setIsLoginMode(!isLoginMode)}>
                 {isLoginMode ? 'Sign Up' : 'Sign In'}
               </span>
            </p>
         </div>
      </div>
    );
  }

  // ==== SHARE THEME STYLES ====
  const themeConfigs = {
    STRAVA_DARK: { label: 'Pro', color: '#fc4c02', bg: '#050505', routeColor: '#fc4c02', hideMap: true },
    CLASSIC: { label: 'Classic', color: '#fff', bg: null, routeColor: '#4a90e2', hideMap: false },
    NEON: { label: 'Neon', color: '#0f0', bg: '#000', routeColor: '#0f0', hideMap: true },
    MINIMAL: { label: 'Minimal', color: '#000', bg: null, routeColor: '#4a90e2', hideMap: false },
    SUNSET: { label: 'Sunset', color: '#ff6b35', bg: null, routeColor: '#ff6b35', hideMap: false },
    MIDNIGHT: { label: 'Midnight', color: '#818cf8', bg: '#0f0a2e', routeColor: '#818cf8', hideMap: true },
    CARBON: { label: 'Carbon', color: '#e4e4e7', bg: '#18181b', routeColor: '#e4e4e7', hideMap: true },
    RETRO: { label: 'Retro', color: '#fbbf24', bg: '#1c1917', routeColor: '#fbbf24', hideMap: true },
    FROST: { label: 'Frost', color: '#06b6d4', bg: '#0c1929', routeColor: '#22d3ee', hideMap: true },
    LAVA: { label: 'Lava', color: '#ef4444', bg: '#1a0505', routeColor: '#ef4444', hideMap: true },
  };

  const getShareStyles = () => {
    // 1. CLASSIC — Bottom gradient, horizontal 3-col stats
    if (shareTheme === 'CLASSIC') {
      return {
        wrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: '40px 28px', background: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.8) 50%, transparent 100%)', zIndex: 50 },
        title: { fontSize: '28px', fontWeight: 'bold', color: '#fff', marginBottom: '4px' },
        date: { fontSize: '14px', color: '#aaa', marginBottom: '24px' },
        statRow: { display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '16px' },
        statVal: { fontSize: '24px', fontWeight: 'bold', color: '#fff' },
        statLbl: { fontSize: '12px', color: '#888', textTransform: 'uppercase' }
      };
    }
    // 2. NEON — Grid border box, scanline feel
    if (shareTheme === 'NEON') {
      return {
        wrapper: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, background: '#000', padding: '40px 20px', zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' },
        title: { fontSize: '32px', fontWeight: '900', color: '#0f0', textShadow: '0 0 10px #0f0', marginBottom: '4px', fontFamily: 'monospace' },
        date: { fontSize: '14px', color: '#0a0', marginBottom: '40px', fontFamily: 'monospace' },
        statRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', background: 'rgba(0,255,0,0.05)', padding: '20px', borderRadius: '4px', border: '1px solid #0f0', boxShadow: '0 0 20px rgba(0,255,0,0.1), inset 0 0 20px rgba(0,255,0,0.05)' },
        statVal: { fontSize: '22px', fontWeight: 'bold', color: '#0f0', textShadow: '0 0 8px #0f0', fontFamily: 'monospace' },
        statLbl: { fontSize: '10px', color: '#0a0', textTransform: 'uppercase', fontFamily: 'monospace', letterSpacing: '2px' }
      };
    }
    // 3. MINIMAL — Floating white card, top position
    if (shareTheme === 'MINIMAL') {
      return {
        wrapper: { position: 'absolute', top: '40px', left: '20px', right: '20px', background: 'rgba(255,255,255,0.95)', padding: '24px', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', zIndex: 50 },
        title: { fontSize: '24px', fontWeight: '800', color: '#000', marginBottom: '4px' },
        date: { fontSize: '12px', color: '#666', marginBottom: '20px' },
        statRow: { display: 'flex', justifyContent: 'space-between' },
        statVal: { fontSize: '20px', fontWeight: '800', color: '#000' },
        statLbl: { fontSize: '10px', color: '#888', textTransform: 'uppercase', fontWeight: '600' }
      };
    }
    // 4. SUNSET — Hero big number (distance) style, warm bottom gradient
    if (shareTheme === 'SUNSET') {
      return {
        wrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: '48px 28px', background: 'linear-gradient(to top, rgba(120,30,0,0.95) 0%, rgba(80,20,0,0.7) 40%, transparent 100%)', zIndex: 50 },
        title: { fontSize: '14px', fontWeight: '700', color: '#ffb088', textTransform: 'uppercase', letterSpacing: '4px', marginBottom: '8px' },
        date: { display: 'none' },
        statRow: { display: 'flex', flexDirection: 'column', gap: '4px' },
        statVal: { fontSize: '52px', fontWeight: '900', color: '#fff', lineHeight: '1.1' },
        statLbl: { fontSize: '11px', color: '#ffb088', textTransform: 'uppercase', letterSpacing: '3px', marginBottom: '12px' }
      };
    }
    // 5. MIDNIGHT — Centered glass pill container
    if (shareTheme === 'MIDNIGHT') {
      return {
        wrapper: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(15,10,46,0.85)', backdropFilter: 'blur(20px)', padding: '40px 48px', borderRadius: '32px', border: '1px solid rgba(129,140,248,0.2)', boxShadow: '0 30px 60px rgba(0,0,0,0.5), 0 0 80px rgba(129,140,248,0.1)', zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' },
        title: { display: 'none' },
        date: { display: 'none' },
        statRow: { display: 'flex', flexDirection: 'column', gap: '28px', alignItems: 'center' },
        statVal: { fontSize: '40px', fontWeight: '900', color: '#c7d2fe', textShadow: '0 0 30px rgba(129,140,248,0.6)' },
        statLbl: { fontSize: '11px', color: '#818cf8', textTransform: 'uppercase', letterSpacing: '4px', marginTop: '4px' }
      };
    }
    // 6. CARBON — Industrial horizontal bar at bottom
    if (shareTheme === 'CARBON') {
      return {
        wrapper: { position: 'absolute', bottom: '40px', left: '16px', right: '16px', background: 'rgba(24,24,27,0.92)', backdropFilter: 'blur(16px)', padding: '20px 24px', borderRadius: '16px', border: '1px solid rgba(228,228,231,0.08)', zIndex: 50, boxShadow: '0 20px 40px rgba(0,0,0,0.6)' },
        title: { display: 'none' },
        date: { display: 'none' },
        statRow: { display: 'flex', justifyContent: 'space-around', alignItems: 'center' },
        statVal: { fontSize: '28px', fontWeight: '900', color: '#e4e4e7', letterSpacing: '-1px', fontFamily: '"Outfit", monospace' },
        statLbl: { fontSize: '9px', color: '#52525b', textTransform: 'uppercase', letterSpacing: '3px', fontWeight: '700', marginTop: '4px' }
      };
    }
    // 7. RETRO — Boxed sections with decorative borders, left-aligned
    if (shareTheme === 'RETRO') {
      return {
        wrapper: { position: 'absolute', top: '10%', left: '24px', zIndex: 50, display: 'flex', flexDirection: 'column', gap: '0' },
        title: { display: 'none' },
        date: { display: 'none' },
        statRow: { display: 'flex', flexDirection: 'column', gap: '0' },
        statVal: { fontSize: '48px', fontWeight: '900', color: '#fbbf24', textShadow: '0 0 20px rgba(251,191,36,0.3)', borderLeft: '4px solid #fbbf24', paddingLeft: '16px', lineHeight: '1.2' },
        statLbl: { fontSize: '11px', color: '#a16207', textTransform: 'uppercase', letterSpacing: '4px', paddingLeft: '20px', marginBottom: '20px' }
      };
    }
    // 8. FROST — Right-aligned, stacked with thin line separators
    if (shareTheme === 'FROST') {
      return {
        wrapper: { position: 'absolute', top: '12%', right: '24px', zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right' },
        title: { display: 'none' },
        date: { display: 'none' },
        statRow: { display: 'flex', flexDirection: 'column', gap: '0', alignItems: 'flex-end' },
        statVal: { fontSize: '42px', fontWeight: '900', color: '#e0f2fe', textShadow: '0 0 25px rgba(6,182,212,0.4)', lineHeight: '1.2' },
        statLbl: { fontSize: '10px', color: '#06b6d4', textTransform: 'uppercase', letterSpacing: '3px', marginBottom: '16px', borderBottom: '1px solid rgba(6,182,212,0.3)', paddingBottom: '12px' }
      };
    }
    // 9. LAVA — Centered with glowing horizontal divider lines
    if (shareTheme === 'LAVA') {
      return {
        wrapper: { position: 'absolute', top: '8%', left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#fff', zIndex: 50 },
        title: { display: 'none' },
        date: { display: 'none' },
        statRow: { display: 'flex', flexDirection: 'column', gap: '0', alignItems: 'center', textAlign: 'center' },
        statVal: { fontSize: '44px', fontWeight: '900', color: '#fca5a5', textShadow: '0 0 30px rgba(239,68,68,0.6)', paddingTop: '16px' },
        statLbl: { fontSize: '11px', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '3px', marginTop: '4px', paddingBottom: '16px', borderBottom: '2px solid rgba(239,68,68,0.3)', width: '120px', textAlign: 'center' }
      };
    }
    // Default: STRAVA_DARK / Pro — Centered vertical, clean
    return {
      wrapper: { position: 'absolute', top: '6%', left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#fff', zIndex: 50 },
      title: { display: 'none' },
      date: { display: 'none' },
      statRow: { display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', textAlign: 'center' },
      statVal: { fontSize: '32px', fontWeight: '800', textShadow: '0 4px 20px rgba(0,0,0,0.8)', lineHeight: '1.2', marginBottom: '2px' },
      statLbl: { fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '2px', textShadow: '0 2px 10px rgba(0,0,0,0.8)', lineHeight: '1.2' }
    };
  };

  const triggerCopilot = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const unitStr = distanceUnit === 'km' ? 'kilometer' : 'mil';
      const speedStr = speedUnit === 'kmh' ? 'kilometer per jam' : 'mil per jam';
      const tuningStr = Object.keys(tuningConfigs).length > 0 ? 'Mode bore up aktif, hati-hati bensin boros.' : 'Kondisi mesin standar.';
      
      const msg = new SpeechSynthesisUtterance(`Halo Mokat! Jarak tempuh saat ini ${(convertDistance(distance)).toFixed(1)} ${unitStr}. Kecepatan ${convertSpeed(speed)} ${speedStr}. ${tuningStr}`);
      msg.lang = 'id-ID';
      msg.rate = 0.9;
      window.speechSynthesis.speak(msg);
    } else {
      alert("Browser kamu tidak mendukung Voice Co-Pilot.");
    }
  };

  const renderContent = () => {
    if (activeTab === 'RIDE') {
      return (
        <>
          {/* VIEWING ROUTE HEADER */}
          {viewingRoute && !shareMode && (
             <div className="glass-panel" style={{ padding: '14px 20px', marginBottom: '16px', marginInline: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div>
                 <p style={{fontSize: '12px', color: '#888'}}>Viewing Saved Route</p>
                 <p style={{fontSize: '14px', fontWeight: 'bold'}}>{new Date(viewingRoute.created_at).toLocaleDateString()}</p>
               </div>
               
               <div style={{ display: 'flex', gap: '8px' }}>
                 <button className="glass-button primary" style={{padding: '6px 12px', fontSize: '12px', background: '#4a90e2', color: '#fff'}} onClick={() => setShareMode(true)}>
                   <LayoutTemplate size={14} style={{ marginRight: '4px' }} /> Share SG
                 </button>
                 <button className="glass-button" style={{padding: '6px 12px', fontSize: '12px'}} onClick={() => {
                   setViewingRoute(null);
                   setRoutePath([]);
                   handleCenterMap();
                 }}>Close</button>
               </div>
             </div>
          )}

          {/* FLOATING MAP CONTROLS (Right side floating pill) */}
          {!viewingRoute && !shareMode && (
            <div style={{ position: 'absolute', right: '16px', top: '100px', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 30 }}>
              <button 
                className="glass-button" 
                onClick={() => {
                  const styles = ['DARK', 'SATELLITE', 'STREET'];
                  const next = styles[(styles.indexOf(mapStyle) + 1) % styles.length];
                  setMapStyle(next);
                }}
                title={`Map Style: ${mapStyle}`}
                style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 8px 20px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px', fontWeight: '800' }}
              >
                {mapStyle === 'DARK' ? '🌙' : mapStyle === 'SATELLITE' ? '🛰️' : '🗺️'}
              </button>
              <button 
                className="glass-button" 
                onClick={triggerCopilot}
                title="AI Voice Co-Pilot"
                style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(59,130,246,0.6) 0%, rgba(139,92,246,0.6) 100%)', border: '1px solid rgba(255,255,255,0.4)', boxShadow: '0 8px 20px rgba(59,130,246,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Headset size={20} color="#fff" />
              </button>
              <button 
                className="glass-button" 
                onClick={handleCenterMap}
                title="Pusatkan Lokasi"
                style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 8px 20px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <LocateFixed size={20} color="#3b82f6" />
              </button>
              <button 
                className="glass-button" 
                onClick={() => handleFindNearbyPlaces('SPBU')}
                title="Cari SPBU Terdekat"
                style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 8px 20px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Fuel size={18} color="#10b981" />
              </button>
              <button 
                className="glass-button danger" 
                onClick={handleTriggerSos}
                title="SOS Emergency"
                style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', boxShadow: '0 0 20px rgba(239,68,68,0.6)', border: '1px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <AlertTriangle size={20} color="#fff" />
              </button>
            </div>
          )}

          {/* GOD TIER OVERLAYS (Lean Angle & Elevation) */}
          {!viewingRoute && !shareMode && (
            <div style={{ position: 'absolute', top: '100px', left: '16px', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 40 }}>
              {/* Lean Angle */}
              <div className="glass-card" style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
                <Activity size={16} color="#c084fc" />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '9px', color: '#c084fc', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '1px' }}>Lean Angle</span>
                  <span style={{ fontSize: '14px', fontWeight: '900', color: '#fff' }}>{currentLeanAngle}° <span style={{ fontSize: '9px', color: '#888' }}>Max {maxLeanAngle}°</span></span>
                </div>
              </div>
              
              {/* Topography */}
              <div className="glass-card" style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
                <Navigation size={16} color="#60a5fa" />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '9px', color: '#60a5fa', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '1px' }}>Max Alt (Elev)</span>
                  <span style={{ fontSize: '14px', fontWeight: '900', color: '#fff' }}>{maxAltitude} <span style={{ fontSize: '9px', color: '#888' }}>m DPL</span></span>
                </div>
              </div>
            </div>
          )}

          <div className="dashboard-spacer"></div>

          {/* MAIN START / PAUSE / RESUME / STOP RECORDING BUTTONS */}
          {!viewingRoute && !shareMode && (
            <div className="action-area" style={{ marginBottom: '16px', display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'center' }}>
              {isTracking && (
                <div 
                  className="btn-start" 
                  onClick={isPaused ? resumeTracking : pauseTracking}
                  style={{ width: '56px', height: '56px' }}
                >
                  <div className="btn-inner" style={{ color: '#000', width: '40px', height: '40px' }}>
                    {isPaused ? <Play size={22} fill="currentColor" style={{ marginLeft: '2px' }} /> : <Pause size={22} fill="currentColor" />}
                  </div>
                </div>
              )}
              <div className={`btn-start ${isTracking ? 'recording' : ''}`} onClick={isTracking ? stopTracking : startTracking}>
                <div className="btn-inner" style={{ color: '#000' }}>
                  {isTracking ? <Square size={28} fill="currentColor" /> : <Play size={32} fill="currentColor" style={{ marginLeft: '4px' }} />}
                </div>
              </div>
            </div>
          )}

        {/* STATS PANEL - Hide during share mode (we use custom overlay) */}
        {!shareMode && (
          <div className="stats-panel glass-panel">
            <div className="stat-item">
              <div className="stat-value">
                {(() => {
                  const rawSpd = viewingRoute ? Math.round(viewingRoute.avg_speed) : speed;
                  return speedUnit === 'mph' ? Math.round(rawSpd * 0.621371) : rawSpd;
                })()}
                <span>{speedUnit === 'mph' ? 'mph' : 'km/h'}</span>
              </div>
              <div className="stat-label">{viewingRoute ? 'Avg Spd' : 'Speed'}</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">
                {(() => {
                  const rawTop = viewingRoute ? (Math.round(viewingRoute.top_speed || viewingRoute.avg_speed * 1.3)) : topSpeed;
                  return speedUnit === 'mph' ? Math.round(rawTop * 0.621371) : rawTop;
                })()}
                <span>{speedUnit === 'mph' ? 'mph' : 'km/h'}</span>
              </div>
              <div className="stat-label">Top Speed</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">
                {(() => {
                  const rawDist = viewingRoute ? viewingRoute.distance : distance;
                  return distanceUnit === 'mi' ? (rawDist * 0.621371).toFixed(1) : rawDist.toFixed(1);
                })()}
                <span>{distanceUnit === 'mi' ? 'mi' : 'km'}</span>
              </div>
              <div className="stat-label">Distance</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{formatTime(viewingRoute ? viewingRoute.time : time)}</div>
              <div className="stat-label">Time</div>
            </div>
          </div>
        )}
        </>
      );
    }

    if (activeTab === 'ROUTES') {
      return (
        <div className="glass-panel" style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px', overflowY: 'auto' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600' }}>Cloud Routes</h2>
          
          {rides.length === 0 ? (
            <p style={{ fontSize: '14px', color: '#888', textAlign: 'center', marginTop: '20px' }}>No routes saved yet. Go for a ride!</p>
          ) : (
            rides.map(ride => (
              <div 
                key={ride.id} 
                className="glass-card"
                style={{ cursor: 'pointer' }}
              >
                <div 
                  onClick={() => {
                    setViewingRoute(ride);
                    setRoutePath(ride.route_path || []);
                    setActiveTab('RIDE');
                  }}
                >
                  <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '6px', color: '#fff' }}>Ride on {new Date(ride.created_at).toLocaleDateString()}</h3>
                  <p style={{ fontSize: '13px', color: '#888', marginBottom: '8px', fontWeight: '500' }}>
                    {Number(ride.distance).toFixed(2)} km • {formatTime(ride.time)} • Avg {Math.round(ride.avg_speed)} km/h
                    {ride.top_speed ? ` • Top ${Math.round(ride.top_speed)} km/h` : ''}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div 
                    onClick={() => {
                      setViewingRoute(ride);
                      setRoutePath(ride.route_path || []);
                      setActiveTab('RIDE');
                    }}
                    style={{ display: 'flex', alignItems: 'center', color: '#4a90e2', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    View on Map <ChevronRight size={16} />
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteRide(ride.id); }}
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '10px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '700', transition: 'all 0.3s' }}
                  >
                    <Trash2 size={14} /> Hapus
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      );
    }

    if (activeTab === 'RADIO') {
      return (
        <div className="glass-panel" style={{ flex: 1, padding: '24px', marginTop: '20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
             <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: inRadio ? 'rgba(74, 222, 128, 0.2)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: inRadio ? '0 0 20px rgba(74, 222, 128, 0.4)' : 'none', transition: 'all 0.3s' }}>
                <Headset size={40} color={inRadio ? '#4ade80' : '#888'} />
             </div>
             <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>Live Intercom</h2>
             <p style={{ color: '#888', fontSize: '13px', marginTop: '4px' }}>Ngobrol bareng teman pas riding, jarak tak terbatas.</p>
             <div style={{ marginTop: '8px', fontSize: '12px', color: inRadio ? '#4ade80' : '#666', fontWeight: '700' }}>
               ● {radioStatus}
             </div>
             {inRadio && activeRoomCode && (
               <div style={{ marginTop: '6px', fontSize: '14px', color: '#fff', fontWeight: '800', letterSpacing: '1px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', padding: '6px 16px', borderRadius: '12px', display: 'inline-block' }}>
                 🔑 {activeRoomCode}
               </div>
             )}
          </div>

          {!inRadio ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <label style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '800', display: 'block', marginBottom: '8px', textAlign: 'center' }}>
                  🔑 Kode Room Rahasia / Private
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    className="glass-input" 
                    placeholder="Masukkan Kode Room (contoh: MOKAT-7890)" 
                    value={roomCode} 
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    style={{ textAlign: 'center', fontSize: '14px', fontWeight: '800', letterSpacing: '1px' }}
                  />
                  <button 
                    className="glass-button" 
                    onClick={generateRandomCode}
                    title="Generate Kode Random"
                    style={{ padding: '0 16px', fontSize: '12px', background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)', color: '#3b82f6', flexShrink: 0 }}
                  >
                    🎲 Random
                  </button>
                </div>
                <p style={{ fontSize: '11px', color: '#666', textAlign: 'center', marginTop: '8px' }}>
                  Hanya pengguna yang memegang Kode Room yang sama yang bisa saling mendengar & ngobrol.
                </p>
              </div>

              <button className="glass-button primary" onClick={joinRadio} style={{ padding: '16px', fontSize: '15px', fontWeight: 'bold' }}>
                Join Private Intercom Room
              </button>
              <button className="glass-button" onClick={testAudioSound} style={{ padding: '12px', fontSize: '13px', background: 'rgba(255,255,255,0.05)' }}>
                🔊 Test HP Speaker Sound
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                 <button className="glass-button" onClick={toggleMute} style={{ flex: 1, padding: '16px', background: isMuted ? 'rgba(239, 68, 68, 0.2)' : 'rgba(74, 222, 128, 0.15)', color: isMuted ? '#ef4444' : '#4ade80', border: isMuted ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(74,222,128,0.4)' }}>
                    {isMuted ? <MicOff size={24} style={{margin:'0 auto'}} /> : <Mic size={24} style={{margin:'0 auto'}} />}
                 </button>
                 <button className="glass-button" onClick={testAudioSound} style={{ padding: '16px', background: 'rgba(255,255,255,0.08)' }} title="Test Speaker">
                    🔊
                 </button>
                 <button className="glass-button" onClick={leaveRadio} style={{ flex: 1, padding: '16px', background: '#ef4444', color: '#fff', border: 'none' }}>
                    <PhoneOff size={24} style={{margin:'0 auto'}} />
                 </button>
              </div>

              <h3 style={{ fontSize: '14px', color: '#888', marginBottom: '12px' }}>Active Riders ({radioPeers.length + 1})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                 <div style={{ background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.3)', padding: '12px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 'bold' }}>
                         {(displayName?.trim()?.[0] || session.user.email.substring(0,1)).toUpperCase()}
                      </div>
                      <div>
                         <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#4ade80' }}>{displayName || session.user.email.split('@')[0]} (You)</div>
                         <div style={{ fontSize: '11px', color: isMuted ? '#ef4444' : '#4ade80' }}>{isMuted ? 'Mic Muted' : 'Mic Active 🎙️'}</div>
                      </div>
                    </div>
                 </div>

                 {/* Custom Microphone Device Picker for Laptops/Desktops */}
                 {audioInputs.length > 1 && (
                   <div style={{ background: 'rgba(255,255,255,0.04)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                     <label style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700', display: 'block', marginBottom: '8px' }}>Select Microphone:</label>
                     <div style={{ position: 'relative' }}>
                       <div 
                         onClick={() => setIsMicDropdownOpen(!isMicDropdownOpen)}
                         style={{ 
                           background: 'rgba(0,0,0,0.5)', 
                           border: '1px solid rgba(255,255,255,0.2)', 
                           borderRadius: '8px', 
                           padding: '10px 14px', 
                           color: '#fff', 
                           fontSize: '13px', 
                           display: 'flex', 
                           justifyContent: 'space-between', 
                           alignItems: 'center',
                           cursor: 'pointer',
                           boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                           transition: 'all 0.2s ease'
                         }}
                       >
                         <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                           <Mic size={16} color="#60a5fa" />
                           <span style={{ fontWeight: '500' }}>
                             {audioInputs.find(m => m.deviceId === selectedAudioInput)?.label || 'Default Microphone'}
                           </span>
                         </div>
                         <ChevronDown size={16} color="#aaa" style={{ transform: isMicDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }} />
                       </div>
                       
                       {/* Dropdown Menu */}
                       {isMicDropdownOpen && (
                         <div style={{ 
                           position: 'absolute', 
                           top: '100%', 
                           left: 0, 
                           right: 0, 
                           marginTop: '8px', 
                           background: 'rgba(20,20,24,0.95)', 
                           backdropFilter: 'blur(16px)', 
                           border: '1px solid rgba(255,255,255,0.15)', 
                           borderRadius: '10px', 
                           overflow: 'hidden', 
                           zIndex: 100,
                           boxShadow: '0 8px 32px rgba(0,0,0,0.6)'
                         }}>
                           {audioInputs.map((mic, idx) => {
                             const isSelected = mic.deviceId === selectedAudioInput;
                             return (
                               <div 
                                 key={mic.deviceId || idx}
                                 onClick={() => {
                                   switchMicrophone(mic.deviceId);
                                   setIsMicDropdownOpen(false);
                                 }}
                                 style={{ 
                                   padding: '12px 14px', 
                                   color: isSelected ? '#60a5fa' : '#e4e4e7', 
                                   background: isSelected ? 'rgba(96,165,250,0.1)' : 'transparent',
                                   fontSize: '13px', 
                                   fontWeight: isSelected ? '600' : '400',
                                   cursor: 'pointer',
                                   borderBottom: idx < audioInputs.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                                   display: 'flex',
                                   alignItems: 'center',
                                   gap: '10px',
                                   transition: 'background 0.2s'
                                 }}
                                 onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                                 onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                               >
                                 <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isSelected ? '#60a5fa' : 'transparent' }}></div>
                                 {mic.label || `Microphone ${idx + 1}`}
                               </div>
                             );
                           })}
                         </div>
                       )}
                     </div>
                   </div>
                 )}

                 {radioPeers.map(peer => (
                   <div key={peer.id} style={{ background: 'rgba(74, 144, 226, 0.1)', border: '1px solid rgba(74, 144, 226, 0.3)', padding: '12px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#4a90e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>
                           {peer.email.substring(0,1).toUpperCase()}
                        </div>
                        <div>
                           <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>{peer.email}</div>
                           <div style={{ fontSize: '11px', color: '#4ade80' }}>● Connected (Voice Live)</div>
                        </div>
                      </div>
                   </div>
                 ))}
              </div>
            </>
          )}
        </div>
      );
    }

    if (activeTab === 'GARAGE') {
      const filteredBikes = bikeSearch.length > 0 
        ? bikeDatabase.filter(b => 
            `${b.brand} ${b.name}`.toLowerCase().includes(bikeSearch.toLowerCase()) ||
            b.type.toLowerCase().includes(bikeSearch.toLowerCase())
          ).slice(0, 20)
        : [];

      return (
        <div className="glass-panel" style={{ flex: 1, padding: '24px', marginTop: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          
          {showAddBike ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '800' }}>Add Motorcycle</h2>
                <button className="glass-button" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => { setShowAddBike(false); setBikeSearch(''); }}>Cancel</button>
              </div>
              
              <div style={{ position: 'relative', marginBottom: '12px' }}>
                <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#666', pointerEvents: 'none' }} />
                <input 
                  className="glass-input" 
                  placeholder="Search motorcycle... (e.g. Ninja 250, CBR, R25)" 
                  value={bikeSearch} 
                  onChange={(e) => setBikeSearch(e.target.value)}
                  style={{ paddingLeft: '44px' }}
                  autoFocus
                />
              </div>

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {bikeSearch.length === 0 ? (
                  <div style={{ textAlign: 'center', marginTop: '40px', color: '#666' }}>
                    <Search size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                    <p style={{ fontSize: '14px' }}>Search from 100+ motorcycles worldwide</p>
                    <p style={{ fontSize: '12px', color: '#555', marginTop: '4px' }}>Honda, Yamaha, Kawasaki, Ducati, BMW, etc.</p>
                  </div>
                ) : filteredBikes.length === 0 ? (
                  <div style={{ textAlign: 'center', marginTop: '24px', color: '#666' }}>
                    <p style={{ fontSize: '14px', marginBottom: '16px' }}>Tidak ditemukan "{bikeSearch}"</p>
                    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '16px', padding: '16px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                      <p style={{ fontSize: '12px', color: '#aaa', marginBottom: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>✏️ Tambah Motor Manual</p>
                      <input className="glass-input" placeholder="Brand (contoh: Honda)" value={newBike.brand} onChange={(e) => setNewBike({...newBike, brand: e.target.value})} style={{ marginBottom: '8px', fontSize: '13px', padding: '10px 12px' }} />
                      <input className="glass-input" placeholder="Nama Motor (contoh: Beat Street)" value={newBike.name} onChange={(e) => setNewBike({...newBike, name: e.target.value})} style={{ marginBottom: '8px', fontSize: '13px', padding: '10px 12px' }} />
                      <input className="glass-input" placeholder="Tipe (contoh: Matic, Sport, Naked)" value={newBike.type} onChange={(e) => setNewBike({...newBike, type: e.target.value})} style={{ marginBottom: '12px', fontSize: '13px', padding: '10px 12px' }} />
                      <button 
                        className="glass-button primary" 
                        onClick={() => { if (newBike.brand && newBike.name) handleSaveBike(newBike); }}
                        disabled={!newBike.brand || !newBike.name}
                        style={{ width: '100%', padding: '12px', fontSize: '13px', fontWeight: '700', opacity: (!newBike.brand || !newBike.name) ? 0.4 : 1 }}
                      >
                        + Tambah ke Garage
                      </button>
                    </div>
                  </div>
                ) : (
                  filteredBikes.map((bike, i) => (
                    <div key={i} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', padding: '14px' }} onClick={() => handleSaveBike(bike)}>
                      <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {bike.img ? (
                          <img src={bike.img} alt={bike.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        ) : (
                          <Bike size={24} color="#4a90e2" />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bike.brand} {bike.name}</h3>
                        <p style={{ fontSize: '12px', color: '#888', fontWeight: '500' }}>{bike.type} • {bike.cc}cc</p>
                      </div>
                      <div style={{ color: '#4a90e2', fontSize: '12px', fontWeight: '700', flexShrink: 0 }}>+ ADD</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '800' }}>Cloud Garage</h2>
                <button className="glass-button" style={{ padding: '8px 16px', fontSize: '12px', gap: '6px', display: 'flex', alignItems: 'center' }} onClick={() => setShowAddBike(true)}>
                  <Search size={14} /> Add Bike
                </button>
              </div>

              {bikes.length === 0 ? (
                <div style={{ textAlign: 'center', marginTop: '40px', color: '#888' }}>
                  <Bike size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                  <p>Your garage is empty.</p>
                  <p style={{ fontSize: '13px', color: '#666', marginTop: '8px' }}>Search from 100+ motorcycles to add.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1 }}>
                  {bikes.map(bike => {
                    const dbBike = bikeDatabase.find(b => b.brand.toLowerCase() === (bike.brand || '').toLowerCase() && b.name.toLowerCase() === (bike.name || '').toLowerCase());
                    const imgUrl = bike.img || dbBike?.img;
                    const ccVal = bike.cc || dbBike?.cc;
                    const totalKm = rides.reduce((sum, r) => sum + (r.distance || 0), 0);
                    const oilProgressKm = Math.max(0, totalKm - lastOilChangeKm);
                    const oilPercent = Math.min(100, (oilProgressKm / 2000) * 100);
                    
                    const tuning = tuningConfigs[bike.id] || { piston: '', tb: '', injector: '' };
                    let estimatedKmL = 35; // Default for 150cc
                    
                    if (tuning.piston || tuning.tb || tuning.injector) {
                      const piston = parseFloat(tuning.piston) || 57.3;
                      const tb = parseFloat(tuning.tb) || 26;
                      const injector = parseFloat(tuning.injector) || 100;
                      
                      const volMul = Math.pow(piston / 57.3, 2);
                      const airMul = Math.pow(tb / 26, 1.5);
                      const fuelMul = injector / 100;
                      
                      let modifier = (volMul * 0.4) + (airMul * 0.3) + (fuelMul * 0.3);
                      if (modifier < 0.5) modifier = 0.5;
                      if (modifier > 4) modifier = 4;
                      estimatedKmL = 35 / modifier;
                    }
                    
                    const updateTuning = (key, val) => {
                      const updated = { ...tuningConfigs, [bike.id]: { ...tuning, [key]: val } };
                      setTuningConfigs(updated);
                      localStorage.setItem('mokat_tuning_configs', JSON.stringify(updated));
                    };

                    return (
                      <div key={bike.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: 0 }}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {imgUrl ? (
                                <img src={imgUrl} alt={bike.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                              ) : (
                                <Bike size={24} color="#4a90e2" />
                              )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bike.brand} {bike.name}</h3>
                              <p style={{ fontSize: '13px', color: '#888', fontWeight: '500' }}>{bike.type || 'Standard'}{ccVal ? ` • ${ccVal}cc` : ''}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleDeleteBike(bike.id)}
                            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '12px', padding: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' }}
                            title="Delete Motorcycle"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>

                        {/* MAINTENANCE SERVICE LIFETIME TRACKER */}
                        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '14px', padding: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: '800', color: '#4a90e2', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Wrench size={14} /> Maintenance Status
                            </span>
                            <button 
                              className="glass-button" 
                              onClick={() => handleResetOilKm(totalKm)}
                              style={{ padding: '4px 10px', fontSize: '10px', background: 'rgba(74,144,226,0.15)', color: '#4a90e2', border: '1px solid rgba(74,144,226,0.3)' }}
                            >
                              Reset Oli Mesin
                            </button>
                          </div>

                          {/* Oli Mesin Progress */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                              <span style={{ color: '#aaa' }}>🛢️ Oli Mesin (Ganti per 2.000 KM)</span>
                              <span style={{ fontWeight: '700', color: oilPercent >= 90 ? '#ef4444' : '#4ade80' }}>{oilProgressKm.toFixed(0)} / 2.000 km</span>
                            </div>
                            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', overflow: 'hidden' }}>
                              <div style={{ width: `${oilPercent}%`, height: '100%', background: oilPercent >= 90 ? '#ef4444' : 'linear-gradient(90deg, #4ade80 0%, #4a90e2 100%)', transition: 'width 0.5s ease' }}></div>
                            </div>
                          </div>

                          {/* Estimasi Konsumsi BBM & Biaya */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', padding: '8px 12px', borderRadius: '10px', marginTop: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Fuel size={14} color="#f59e0b" />
                              <span style={{ fontSize: '11px', color: '#ccc', fontWeight: '600' }}>Est. Konsumsi BBM (1:{estimatedKmL.toFixed(1)} km/L)</span>
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: '800', color: '#f59e0b' }}>{(totalKm / estimatedKmL).toFixed(1)} Liter</span>
                          </div>
                        </div>

                        {/* BORE UP / TUNING CONFIG */}
                        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '14px', padding: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div 
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                            onClick={() => setExpandedTuningBike(expandedTuningBike === bike.id ? null : bike.id)}
                          >
                            <span style={{ fontSize: '11px', fontWeight: '800', color: '#a855f7', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              ⚙️ Tuning / Bore Up Specs
                            </span>
                            <ChevronDown size={14} color="#a855f7" style={{ transform: expandedTuningBike === bike.id ? 'rotate(180deg)' : 'none', transition: '0.3s' }} />
                          </div>

                          {expandedTuningBike === bike.id && (
                            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', color: '#888', width: '60px' }}>Piston:</span>
                                <input className="glass-input" type="number" placeholder="e.g. 62" value={tuning.piston} onChange={(e) => updateTuning('piston', e.target.value)} style={{ flex: 1, padding: '6px 10px', fontSize: '12px' }} />
                                <span style={{ fontSize: '11px', color: '#888', width: '30px' }}>mm</span>
                              </div>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', color: '#888', width: '60px' }}>T. Body:</span>
                                <input className="glass-input" type="number" placeholder="e.g. 34" value={tuning.tb} onChange={(e) => updateTuning('tb', e.target.value)} style={{ flex: 1, padding: '6px 10px', fontSize: '12px' }} />
                                <span style={{ fontSize: '11px', color: '#888', width: '30px' }}>mm</span>
                              </div>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', color: '#888', width: '60px' }}>Injector:</span>
                                <input className="glass-input" type="number" placeholder="e.g. 150" value={tuning.injector} onChange={(e) => updateTuning('injector', e.target.value)} style={{ flex: 1, padding: '6px 10px', fontSize: '12px' }} />
                                <span style={{ fontSize: '11px', color: '#888', width: '30px' }}>cc/m</span>
                              </div>
                              <p style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>* Sistem akan otomatis mengkalkulasi ulang estimasi konsumsi BBM berdasarkan flow mesin.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      );
    }

    if (activeTab === 'SETTINGS') {
      const totalDistance = rides.reduce((sum, r) => sum + (r.distance || 0), 0);
      const totalTime = rides.reduce((sum, r) => sum + (r.time || 0), 0);
      const totalRides = rides.length;

      return (
        <div style={{ flex: 1, marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', paddingBottom: '20px' }}>
          
          {/* Profile Card */}
          <div className="glass-panel" style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 100%)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', fontSize: '28px', fontWeight: '900', color: '#fff' }}>
              {(displayName?.trim()?.[0] || session?.user?.email?.[0] || 'J').toUpperCase()}
            </div>
            <div style={{ textAlign: 'center', width: '100%' }}>
              <div style={{ position: 'relative', display: 'inline-block', width: '80%' }}>
                <input 
                  className="glass-input" 
                  value={displayName} 
                  onChange={(e) => handleUpdateDisplayName(e.target.value)}
                  placeholder="Enter your name..."
                  style={{ textAlign: 'center', fontSize: '18px', fontWeight: '800', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 16px', borderRadius: '16px', color: '#fff' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', color: '#888', fontSize: '13px', marginTop: '8px' }}>
                <Mail size={14} />
                {session?.user?.email || 'No email'}
              </div>

              {/* SOS EMERGENCY CONTACT INPUT */}
              <div style={{ marginTop: '16px', background: 'rgba(239,68,68,0.06)', padding: '14px', borderRadius: '16px', border: '1px solid rgba(239,68,68,0.2)' }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <AlertTriangle size={14} /> SOS Emergency Contact (WhatsApp)
                </div>
                <input 
                  className="glass-input" 
                  value={emergencyContact} 
                  onChange={(e) => {
                    setEmergencyContact(e.target.value);
                    if (session?.user?.id) {
                      localStorage.setItem('mokat_emergency_contact_' + session.user.id, e.target.value);
                    }
                    localStorage.setItem('mokat_emergency_contact', e.target.value);
                  }}
                  placeholder="e.g. 081234567890 (No. WA Kontak Darurat)"
                  style={{ textAlign: 'center', fontSize: '13px', padding: '10px', background: 'rgba(0,0,0,0.3)', borderColor: 'rgba(239,68,68,0.3)' }}
                />
              </div>

              <div style={{ fontSize: '11px', color: '#4ade80', marginTop: '8px', fontWeight: '600' }}>✓ Auto-saved to Cloud & Device</div>
            </div>
          </div>

          {/* Stats Summary */}
          <div className="glass-panel" style={{ padding: '20px 24px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '16px' }}>Your Stats</h3>
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: '900', color: '#fff' }}>{totalRides}</div>
                <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Rides</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: '900', color: '#fff' }}>{totalDistance.toFixed(1)}</div>
                <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Total KM</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: '900', color: '#fff' }}>{bikes.length}</div>
                <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Bikes</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: '900', color: '#fff' }}>{formatTime(totalTime)}</div>
                <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Total Time</div>
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="glass-panel" style={{ padding: '20px 24px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '16px' }}>Preferences</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Distance Unit */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Ruler size={18} color="#4a90e2" />
                  <span style={{ fontSize: '14px', fontWeight: '600' }}>Distance Unit</span>
                </div>
                <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '3px' }}>
                  <button onClick={() => { setDistanceUnit('km'); localStorage.setItem('mokat_distance_unit', 'km'); }} style={{ padding: '6px 14px', borderRadius: '10px', border: 'none', fontSize: '12px', fontWeight: '700', cursor: 'pointer', background: distanceUnit === 'km' ? '#4a90e2' : 'transparent', color: distanceUnit === 'km' ? '#fff' : '#888', transition: 'all 0.3s' }}>KM</button>
                  <button onClick={() => { setDistanceUnit('mi'); localStorage.setItem('mokat_distance_unit', 'mi'); }} style={{ padding: '6px 14px', borderRadius: '10px', border: 'none', fontSize: '12px', fontWeight: '700', cursor: 'pointer', background: distanceUnit === 'mi' ? '#4a90e2' : 'transparent', color: distanceUnit === 'mi' ? '#fff' : '#888', transition: 'all 0.3s' }}>Miles</button>
                </div>
              </div>

              {/* Speed Unit */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Zap size={18} color="#4a90e2" />
                  <span style={{ fontSize: '14px', fontWeight: '600' }}>Speed Unit</span>
                </div>
                <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '3px' }}>
                  <button onClick={() => { setSpeedUnit('kmh'); localStorage.setItem('mokat_speed_unit', 'kmh'); }} style={{ padding: '6px 14px', borderRadius: '10px', border: 'none', fontSize: '12px', fontWeight: '700', cursor: 'pointer', background: speedUnit === 'kmh' ? '#4a90e2' : 'transparent', color: speedUnit === 'kmh' ? '#fff' : '#888', transition: 'all 0.3s' }}>km/h</button>
                  <button onClick={() => { setSpeedUnit('mph'); localStorage.setItem('mokat_speed_unit', 'mph'); }} style={{ padding: '6px 14px', borderRadius: '10px', border: 'none', fontSize: '12px', fontWeight: '700', cursor: 'pointer', background: speedUnit === 'mph' ? '#4a90e2' : 'transparent', color: speedUnit === 'mph' ? '#fff' : '#888', transition: 'all 0.3s' }}>mph</button>
                </div>
              </div>

              {/* Dark Mode (always on, non-functional toggle) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Moon size={18} color="#4a90e2" />
                  <span style={{ fontSize: '14px', fontWeight: '600' }}>Dark Mode</span>
                </div>
                <div style={{ padding: '6px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '700', color: '#4a90e2', background: 'rgba(74,144,226,0.1)' }}>Always On</div>
              </div>
            </div>
          </div>

          {/* About */}
          <div className="glass-panel" style={{ padding: '20px 24px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '16px' }}>About</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Info size={18} color="#4a90e2" />
                  <span style={{ fontSize: '14px', fontWeight: '600' }}>Version</span>
                </div>
                <span style={{ fontSize: '13px', color: '#888', fontWeight: '600' }}>1.0.0</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Shield size={18} color="#4a90e2" />
                  <span style={{ fontSize: '14px', fontWeight: '600' }}>Account</span>
                </div>
                <span style={{ fontSize: '13px', color: '#4ade80', fontWeight: '600' }}>Active</span>
              </div>
            </div>
          </div>

          {/* Sign Out */}
          <button 
            className="glass-button danger" 
            style={{ padding: '16px', fontSize: '15px', fontWeight: '700', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', borderRadius: '20px' }}
            onClick={() => { supabase.auth.signOut(); setSession(null); }}
          >
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      );
    }
  };

   const navItems = [
    { id: 'RIDE', icon: Navigation, label: 'RIDE' },
    { id: 'ROUTES', icon: MapIcon, label: 'ROUTES' },
    { id: 'RADIO', icon: Headset, label: 'RADIO' },
    { id: 'GARAGE', icon: Bike, label: 'GARAGE' },
    { id: 'SETTINGS', icon: Settings, label: 'SETTINGS' }
  ];

  return (
    <div className="app-container" style={{ background: shareTheme === 'NEON' && shareMode ? '#000' : '' }}>
      {/* OUTER SHARE PREVIEW CONTAINER */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: shareMode ? 50 : 1
      }}>
        <div 
          ref={shareContainerRef} 
          style={{ 
            position: 'relative', 
            width: shareMode ? 'min(90vw, calc(70vh * 9 / 16))' : '100%',
            height: shareMode ? 'min(70vh, calc(90vw * 16 / 9))' : '100%',
            aspectRatio: shareMode ? '9 / 16' : 'auto',
            maxHeight: shareMode ? '70vh' : 'none',
            maxWidth: shareMode ? '100vw' : 'none',
            overflow: 'hidden', 
            borderRadius: shareMode ? '24px' : '0px',
            boxShadow: shareMode ? '0 25px 60px rgba(0,0,0,0.8)' : 'none',
            background: isTransparentBg ? 'transparent' : (themeConfigs[shareTheme]?.bg || ((shareMode && shareTheme === 'NEON') ? '#000' : '#050505')),
            pointerEvents: shareMode ? 'none' : 'auto',
            transform: 'none'
          }}
        >
          
          {/* MAP LAYER */}
          {activeTab === 'RIDE' && session && (
            <div className="map-background" style={{ 
              opacity: (shareMode && themeConfigs[shareTheme]?.hideMap) ? 0 : 1, 
              position: 'absolute',
              top: 0, bottom: 0, left: 0, right: 0
            }}>
              <MapContainer 
                ref={mapRef} 
                center={currentPosition} 
                zoom={15} 
                zoomControl={false} 
                attributionControl={false} 
                dragging={!(viewingRoute || shareMode)}
                touchZoom={!(viewingRoute || shareMode)}
                doubleClickZoom={!(viewingRoute || shareMode)}
                scrollWheelZoom={!(viewingRoute || shareMode)}
                style={{ height: '100%', width: '100%', backgroundColor: 'transparent' }}
              >
                {!(shareMode && themeConfigs[shareTheme]?.hideMap) && (
                  <TileLayer
                    url={
                      mapStyle === 'SATELLITE' 
                        ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        : mapStyle === 'STREET'
                        ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    }
                    subdomains={['a', 'b', 'c', 'd']}
                    maxZoom={19}
                    attribution=""
                    crossOrigin="anonymous"
                  />
                )}
                {viewingRoute && viewingRoute.route_path && <MapBoundsFitter path={viewingRoute.route_path} />}
                <Polyline 
                  positions={viewingRoute?.route_path || routePath} 
                  color={shareMode ? (themeConfigs[shareTheme]?.routeColor || '#4a90e2') : '#4a90e2'} 
                  weight={shareMode ? 6 : 4} 
                  opacity={1} 
                />
                {!viewingRoute && <Marker position={currentPosition} icon={bikeIcon} />}
                
                {/* LIVE GROUP RADAR MARKERS */}
                {!viewingRoute && Object.entries(groupLocations).map(([uid, loc]) => {
                   if (Date.now() - loc.updatedAt > 60000) return null; // Hide if stale > 1 min
                   const isFast = loc.speed > 80;
                   const radarHtml = `<div style="background:${isFast ? '#ef4444' : '#3b82f6'}; border:2px solid #fff; width:16px; height:16px; border-radius:50%; box-shadow: 0 0 10px ${isFast ? '#ef4444' : '#3b82f6'}; display:flex; align-items:center; justify-content:center"><span style="position:absolute; top:20px; font-size:10px; font-weight:bold; color:#fff; background:rgba(0,0,0,0.6); padding:2px 4px; border-radius:4px; white-space:nowrap">${loc.speed} km/h</span></div>`;
                   const radarIcon = L.divIcon({ html: radarHtml, className: 'radar-icon', iconSize: [16,16], iconAnchor: [8,8] });
                   return <Marker key={uid} position={[loc.lat, loc.lng]} icon={radarIcon} />;
                })}
              </MapContainer>
            </div>
          )}

          {/* CUSTOM LOGO FOR SHARE SCREENSHOT */}
          {shareMode && (
             <div style={{ position: 'absolute', top: shareTheme === 'CLASSIC' ? '40px' : 'auto', bottom: shareTheme === 'CLASSIC' ? 'auto' : '40px', left: '20px', zIndex: 60 }}>
                <img src="/logo_white.png" alt="Mokat Touring Logo" style={{ height: '24px', width: 'auto', filter: shareTheme === 'NEON' ? 'drop-shadow(0 0 10px #0f0)' : 'drop-shadow(0 2px 10px rgba(0,0,0,0.8))' }} />
             </div>
          )}

          {/* STRICT STATS OVERLAY FOR SHARE */}
          {shareMode && viewingRoute && (
            <div style={getShareStyles().wrapper}>
               <div style={getShareStyles().title}>{storyTitle || 'My Touring Ride'}</div>
               <div style={getShareStyles().date}>{new Date(viewingRoute.created_at).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
               
               <div style={getShareStyles().statRow}>
                  <div>
                     <div style={getShareStyles().statVal}>{Number(viewingRoute.distance).toFixed(1)} <span style={{fontSize:'0.5em', fontWeight:'normal'}}>km</span></div>
                     <div style={getShareStyles().statLbl}>Distance</div>
                  </div>
                  <div>
                     <div style={getShareStyles().statVal}>{Math.round(viewingRoute.top_speed || viewingRoute.avg_speed * 1.3)} <span style={{fontSize:'0.5em', fontWeight:'normal'}}>km/h</span></div>
                     <div style={getShareStyles().statLbl}>Top Speed</div>
                  </div>
                  <div>
                     <div style={getShareStyles().statVal}>{Math.round(viewingRoute.avg_speed)} <span style={{fontSize:'0.5em', fontWeight:'normal'}}>km/h</span></div>
                     <div style={getShareStyles().statLbl}>Avg Speed</div>
                  </div>
                  <div>
                     <div style={getShareStyles().statVal}>{formatTime(viewingRoute.time)}</div>
                     <div style={getShareStyles().statLbl}>Time</div>
                  </div>
               </div>

               {/* SVG Route for themes that hide the map */}
               {themeConfigs[shareTheme]?.hideMap && viewingRoute.route_path && viewingRoute.route_path.length > 1 && (() => {
                 const path = viewingRoute.route_path;
                 const lats = path.map(p => p[0]);
                 const lngs = path.map(p => p[1]);
                 const minLat = Math.min(...lats), maxLat = Math.max(...lats);
                 const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
                 const rangeLat = maxLat - minLat || 0.001;
                 const rangeLng = maxLng - minLng || 0.001;
                 const svgW = 280;
                 const svgH = 280;
                 const pad = 24;
                 const drawW = svgW - pad * 2;
                 const drawH = svgH - pad * 2;
                 const scale = Math.min(drawW / rangeLng, drawH / rangeLat);
                 const actualW = rangeLng * scale;
                 const actualH = rangeLat * scale;
                 const offsetX = (svgW - actualW) / 2;
                 const offsetY = (svgH - actualH) / 2;
                 const points = path.map(p => {
                   const x = offsetX + (p[1] - minLng) * scale;
                   const y = offsetY + (maxLat - p[0]) * scale;
                   return `${x},${y}`;
                 }).join(' ');
                 return (
                   <div style={{ 
                     marginTop: '32px', 
                     display: 'flex', 
                     justifyContent: 'center', 
                     alignItems: 'center',
                     width: '100%'
                   }}>
                     <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ filter: `drop-shadow(0 0 15px ${themeConfigs[shareTheme]?.routeColor || '#4a90e2'})` }}>
                       <polyline
                         fill="none"
                         stroke={themeConfigs[shareTheme]?.routeColor || '#4a90e2'}
                         strokeWidth="4"
                         strokeLinecap="round"
                         strokeLinejoin="round"
                         points={points}
                       />
                     </svg>
                   </div>
                 );
               })()}

            </div>
          )}

        </div>
      </div> {/* END OUTER SHARE PREVIEW CONTAINER */}


      {/* INTERACTIVE UI LAYER (Hidden during Share Mode to prevent card overlapping) */}
      {!shareMode && (
        <div className="content-layer">
          <header className="top-nav">
            <div className="avatar-initial">
              {(displayName?.trim()?.[0] || session?.user?.email?.[0] || 'J').toUpperCase()}
            </div>
            <div className="status-badge">
              <span className={`dot ${isTracking ? 'recording' : 'ready'}`}></span>
              {statusText}
            </div>
            <button className="icon-btn" onClick={handleSignOut} title="Sign Out">
              <LogOut size={20} />
            </button>
          </header>

          {renderContent()}

          <nav className="bottom-nav">
            {navItems.map((item) => (
              <div 
                key={item.id}
                className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                <item.icon size={24} />
                <span className="nav-label">{item.label}</span>
              </div>
            ))}
          </nav>
        </div>
      )}

      {/* SHARE EDITOR CONTROLS (Collapsible Drawer) */}
      {shareMode && (
        <div style={{ 
          position: 'absolute', 
          bottom: 0, left: 0, right: 0, 
          background: 'rgba(17, 17, 17, 0.95)', 
          backdropFilter: 'blur(20px)',
          zIndex: 100, 
          padding: isEditorCollapsed ? '12px 20px' : '20px', 
          borderTopLeftRadius: '24px', 
          borderTopRightRadius: '24px', 
          borderTop: '1px solid rgba(255,255,255,0.1)',
          pointerEvents: 'auto',
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          {/* HEADER BAR WITH TOGGLE COLLAPSE & CLOSE */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isEditorCollapsed ? 0 : '14px' }}>
             <div 
               onClick={() => setIsEditorCollapsed(!isEditorCollapsed)}
               style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}
             >
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>Style Editor</h3>
                <button 
                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '4px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title={isEditorCollapsed ? "Expand Editor" : "Minimize Editor"}
                >
                  {isEditorCollapsed ? <ChevronDown size={18} style={{ transform: 'rotate(180deg)' }} /> : <ChevronDown size={18} />}
                </button>
             </div>

             <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {isEditorCollapsed && (
                  <button 
                    onClick={generateShareImage} 
                    className="glass-button primary" 
                    style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {isCapturing ? 'Saving...' : <><Download size={14} /> Download SG</>}
                  </button>
                )}
                <button onClick={() => { setShareMode(false); setIsEditorCollapsed(false); }} style={{ background: 'transparent', border: 'none', color: '#888', padding: '4px', cursor: 'pointer' }}>
                  <X size={22} />
                </button>
             </div>
          </div>

          {/* EXPANDABLE BODY CONTENT */}
          {!isEditorCollapsed && (
            <>
              <div style={{ marginBottom: '12px' }}>
                 <label style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700', display: 'block', marginBottom: '4px' }}>Title Story:</label>
                 <input 
                   className="glass-input" 
                   value={storyTitle} 
                   onChange={(e) => setStoryTitle(e.target.value)} 
                   placeholder="e.g. Sunmori Lembang, Night Run, Friday Ride..." 
                   style={{ fontSize: '13px', padding: '8px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: '12px', width: '100%' }}
                 />
              </div>
              
              <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '16px', WebkitOverflowScrolling: 'touch' }}>
                 {Object.entries(themeConfigs).map(([key, cfg]) => (
                   <button key={key} onClick={() => setShareTheme(key)} className="glass-button" style={{ 
                     padding: '10px 16px', minWidth: '80px', flexShrink: 0,
                     background: shareTheme === key ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)',
                     border: shareTheme === key ? `2px solid ${cfg.color}` : '1px solid rgba(255,255,255,0.08)',
                     display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                     borderRadius: '16px', fontSize: '11px', fontWeight: '700'
                   }}>
                     <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: cfg.color, boxShadow: shareTheme === key ? `0 0 12px ${cfg.color}` : 'none' }}></span>
                     {cfg.label}
                   </button>
                 ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#aaa', fontWeight: '600' }}>Background:</span>
                    <button 
                      onClick={() => setIsTransparentBg(!isTransparentBg)} 
                      className="glass-button" 
                      style={{ padding: '4px 12px', fontSize: '11px', fontWeight: '700', background: isTransparentBg ? '#4a90e2' : 'rgba(255,255,255,0.06)', color: isTransparentBg ? '#fff' : '#aaa' }}
                    >
                      {isTransparentBg ? '✨ Transparent PNG (Sticker)' : '⬛ Solid Dark (Default)'}
                    </button>
                  </div>
               </div>

               <button onClick={generateShareImage} className="glass-button primary" style={{ width: '100%', padding: '14px', fontSize: '15px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                  {isCapturing ? 'Generating Image...' : <><Download size={18} /> Download SG</>}
               </button>
            </>
          )}
        </div>
      )}

      {/* SOS EMERGENCY ALERT MODAL */}
      {showSosModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '380px', padding: '28px 24px', textAlign: 'center', background: 'linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(0,0,0,0.9) 100%)', border: '1px solid rgba(239,68,68,0.4)', boxShadow: '0 0 50px rgba(239,68,68,0.5)' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239,68,68,0.2)', border: '2px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', animation: 'pulseGlowRed 1s infinite' }}>
              <AlertTriangle size={32} color="#ef4444" />
            </div>
            
            <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#fff', marginBottom: '8px' }}>SOS EMERGENCY!</h2>
            <p style={{ fontSize: '13px', color: '#ccc', marginBottom: '20px' }}>
              {isSosActive ? "Sinyal SOS & Lokasi GPS Darurat sedang dikirim!" : `Mengirim Lokasi GPS Darurat ke WhatsApp Kontak dalam ${sosCountdown} detik...`}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {!isSosActive && (
                <button className="glass-button" onClick={handleCancelSos} style={{ padding: '14px', fontSize: '14px', fontWeight: '800', background: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: '16px' }}>
                  BATALKAN SOS
                </button>
              )}
              {isSosActive && (
                <button className="glass-button danger" onClick={handleCancelSos} style={{ padding: '14px', fontSize: '14px', fontWeight: '800', background: '#ef4444', color: '#fff', borderRadius: '16px' }}>
                  TUTUP ALERT SOS
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PWA UPDATE BANNER */}
      {needRefresh && (
        <div style={{ position: 'fixed', bottom: '80px', left: '16px', right: '16px', background: 'rgba(59,130,246,0.95)', backdropFilter: 'blur(10px)', padding: '16px', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid rgba(255,255,255,0.2)' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#fff', marginBottom: '4px' }}>🚀 Versi Baru Tersedia!</h3>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>Update sekarang untuk mendapatkan fitur terbaru dan perbaikan sistem.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => updateServiceWorker(true)} 
              style={{ flex: 1, padding: '10px', borderRadius: '10px', background: '#fff', color: '#3b82f6', fontWeight: '800', border: 'none', fontSize: '13px' }}
            >
              Update Sekarang
            </button>
            <button 
              onClick={() => setNeedRefresh(false)} 
              style={{ padding: '10px 16px', borderRadius: '10px', background: 'rgba(0,0,0,0.2)', color: '#fff', fontWeight: '700', border: 'none', fontSize: '13px' }}
            >
              Nanti
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
