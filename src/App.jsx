import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Map as MapIcon, User, Activity, Navigation, ChevronRight, Zap, Bike, LogOut, LocateFixed, Camera, LayoutTemplate, X, Download, Headset, Mic, MicOff, PhoneOff, Search, Settings, Mail, Ruler, Moon, Info, Shield, ChevronDown, Trash2 } from 'lucide-react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import html2canvas from 'html2canvas';
import { Peer } from 'peerjs';
import 'leaflet/dist/leaflet.css';
import './index.css';
import { supabase } from './supabaseClient';
import bikeDatabase from './bikeDatabase';

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

function MapBoundsFitter({ path, isShareMode, shareTheme }) {
  const map = useMap();
  useEffect(() => {
    if (path && path.length > 0) {
      // Force Leaflet to recalculate container size in case 'top' changed
      const timer = setTimeout(() => {
        map.invalidateSize();
        const bounds = L.latLngBounds(path);
        let pTL = [40, 40];
        let pBR = [40, 40];
        
        if (isShareMode) {
           pBR = [40, 100]; // General bottom padding
        }
        
        map.fitBounds(bounds, { 
          paddingTopLeft: pTL,
          paddingBottomRight: pBR
        });
      }, 50);
      
      return () => clearTimeout(timer);
    }
  }, [path, map, isShareMode, shareTheme]);
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

  // Auth State
  const [session, setSession] = useState(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  // App State
  const [activeTab, setActiveTab] = useState('RIDE');
  const [isTracking, setIsTracking] = useState(false);
  const [speed, setSpeed] = useState(0); 
  const [distance, setDistance] = useState(0); 
  const [time, setTime] = useState(0); 
  const [statusText, setStatusText] = useState("Locating...");
  
  // Share Export State
  const [shareMode, setShareMode] = useState(false);
  const [shareTheme, setShareTheme] = useState('CLASSIC'); // CLASSIC, NEON, MINIMAL
  const [isTransparentBg, setIsTransparentBg] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  
  const [currentPosition, setCurrentPosition] = useState([-6.2088, 106.8456]); 
  const [routePath, setRoutePath] = useState([]); 

  // Cloud State
  const [bikes, setBikes] = useState([]);
  const [rides, setRides] = useState([]);
  const [showAddBike, setShowAddBike] = useState(false);
  const [newBike, setNewBike] = useState({ brand: '', name: '', type: '' });
  const [bikeSearch, setBikeSearch] = useState('');
  const [viewingRoute, setViewingRoute] = useState(null);

  // Settings State
  const [displayName, setDisplayName] = useState('');
  const [distanceUnit, setDistanceUnit] = useState('km'); // km or mi
  const [speedUnit, setSpeedUnit] = useState('kmh'); // kmh or mph

  // Radio State
  const [inRadio, setInRadio] = useState(false);
  const [radioStatus, setRadioStatus] = useState("Offline");
  const [radioPeers, setRadioPeers] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [audioInputs, setAudioInputs] = useState([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState('');
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

  const fetchCloudData = async () => {
    const { data: bikeData } = await supabase.from('motorcycles').select('*').order('created_at', { ascending: false });
    if (bikeData) setBikes(bikeData);

    const { data: rideData } = await supabase.from('rides').select('*').order('created_at', { ascending: false });
    if (rideData) setRides(rideData);
  };

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
            // Logged in successfully!
          } else {
            alert("Batas pengiriman email server penuh. Silakan langsung pindah ke menu 'Sign In' dan masukkan email/password kamu!");
            setIsLoginMode(true);
          }
        } else {
          alert(error.message);
        }
      } else {
        if (data?.session) {
          // Logged in immediately
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

  const handleCenterMap = () => {
    if (mapRef.current && currentPosition) {
      mapRef.current.flyTo(currentPosition, 16, { animate: true, duration: 1 });
    }
  };

  const generateShareImage = async () => {
    if (!shareContainerRef.current) return;
    setIsCapturing(true);
    
    setTimeout(async () => {
      try {
        const bgColor = isTransparentBg ? null : (themeConfigs[shareTheme]?.bg || '#050505');
        const canvas = await html2canvas(shareContainerRef.current, {
        useCORS: true,
        scale: 2,
        backgroundColor: bgColor,
        logging: false
      });
        
        const image = canvas.toDataURL("image/png");
        
        const a = document.createElement('a');
        a.href = image;
        a.download = `mokat-story-${shareTheme.toLowerCase()}-${new Date().getTime()}.png`;
        a.click();
        
      } catch (err) {
        console.error("Failed to generate image:", err);
        alert("Gagal memproses gambar. Pastikan peta sudah selesai loading.");
      } finally {
        setIsCapturing(false);
      }
    }, 500);
  };

  const startTracking = () => {
    if (!navigator.geolocation) {
      alert("Geolocation tidak didukung");
      return;
    }
    setViewingRoute(null);
    setIsTracking(true);
    setStatusText("Recording...");
    setRoutePath([]);
    setDistance(0);
    setTime(0);

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
          setSpeed(Math.round(gpsSpeed * 3.6));
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
    
    if (distance > 0 || time > 2) {
      setStatusText("Saving Ride...");
      const avgSpeed = distance > 0 && time > 0 ? (distance / (time / 3600)) : 0;
      const newRide = {
        user_id: session.user.id,
        distance: distance,
        time: time,
        avg_speed: avgSpeed,
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
    const { error } = await supabase.from('motorcycles').delete().eq('id', bikeId);
    if (!error) {
      setBikes(bikes.filter(b => b.id !== bikeId));
    } else {
      console.error("Failed to delete bike:", error);
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
        setRadioStatus("Online in Intercom Room");

        const channel = supabase.channel('radio_room', {
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
      setRadioStatus("Failed to access Microphone");
      alert("Gagal mengakses mikrofon. Pastikan izin mic diberikan di browser.");
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
    callsRef.current = {};
    setRadioPeers([]);
    setInRadio(false);
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
        wrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: '40px 20px', background: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.8) 50%, transparent 100%)', zIndex: 50 },
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
      wrapper: { position: 'absolute', top: '8%', left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#fff', zIndex: 50 },
      title: { display: 'none' },
      date: { display: 'none' },
      statRow: { display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', textAlign: 'center' },
      statVal: { fontSize: '44px', fontWeight: '900', textShadow: '0 4px 20px rgba(0,0,0,0.8)' },
      statLbl: { fontSize: '12px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '2px', marginTop: '2px', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }
    };
  };

  const renderContent = () => {
    if (activeTab === 'RIDE') {
      return (
        <>
          {/* VIEWING ROUTE HEADER */}
          {viewingRoute && !shareMode && (
             <div className="glass-panel" style={{ padding: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

          <div className="dashboard-spacer"></div>

          {/* LOCATE BUTTON - Hide during export & share mode */}
          {!viewingRoute && !shareMode && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
              <button 
                className="glass-button" 
                onClick={handleCenterMap}
                style={{ width: '44px', height: '44px', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)' }}
              >
                <LocateFixed size={20} color="#4a90e2" />
              </button>
            </div>
          )}

        {!viewingRoute && !shareMode && (
          <div className="action-area">
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
              <div className="stat-value">{viewingRoute ? Math.round(viewingRoute.avg_speed) : speed}<span>km/h</span></div>
              <div className="stat-label">{viewingRoute ? 'Avg Spd' : 'Speed'}</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{(viewingRoute ? viewingRoute.distance : distance).toFixed(1)}<span>km</span></div>
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
                onClick={() => {
                  setViewingRoute(ride);
                  setRoutePath(ride.route_path || []);
                  setActiveTab('RIDE');
                }}
                style={{ cursor: 'pointer' }}
              >
                <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '6px', color: '#fff' }}>Ride on {new Date(ride.created_at).toLocaleDateString()}</h3>
                <p style={{ fontSize: '13px', color: '#888', marginBottom: '16px', fontWeight: '500' }}>{Number(ride.distance).toFixed(2)} km • {formatTime(ride.time)}</p>
                <div style={{ display: 'flex', alignItems: 'center', color: '#4a90e2', fontSize: '13px', fontWeight: '700' }}>
                  View on Map <ChevronRight size={16} />
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
          </div>

          {!inRadio ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button className="glass-button primary" onClick={joinRadio} style={{ padding: '16px', fontSize: '16px', fontWeight: 'bold' }}>
                Connect to Room
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

                 {/* Microphone Device Picker for Laptops/Desktops */}
                 {audioInputs.length > 1 && (
                   <div style={{ background: 'rgba(255,255,255,0.04)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                     <label style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700', display: 'block', marginBottom: '6px' }}>Select Laptop Microphone:</label>
                     <select 
                       className="glass-input" 
                       value={selectedAudioInput} 
                       onChange={(e) => switchMicrophone(e.target.value)}
                       style={{ fontSize: '13px', padding: '8px', background: 'rgba(0,0,0,0.5)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
                     >
                       {audioInputs.map((mic, idx) => (
                         <option key={mic.deviceId || idx} value={mic.deviceId} style={{ background: '#111', color: '#fff' }}>
                           {mic.label || `Microphone ${idx + 1}`}
                         </option>
                       ))}
                     </select>
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

    if (activeTab === 'STATS') {
      const totalKm = rides.reduce((acc, r) => acc + Number(r.distance), 0);
      const totalTime = rides.reduce((acc, r) => acc + Number(r.time), 0);
      
      return (
        <div className="glass-panel" style={{ flex: 1, padding: '24px', marginTop: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '24px' }}>My Statistics</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div className="glass-card" style={{ textAlign: 'center' }}>
              <Zap size={28} color="#f59e0b" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: '28px', fontWeight: '900', letterSpacing: '-1px' }}>{totalKm.toFixed(1)}</div>
              <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', marginTop: '4px', fontWeight: '700' }}>Total KM</div>
            </div>
            <div className="glass-card" style={{ textAlign: 'center' }}>
              <Activity size={28} color="#10b981" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: '28px', fontWeight: '900', letterSpacing: '-1px' }}>{rides.length}</div>
              <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', marginTop: '4px', fontWeight: '700' }}>Total Rides</div>
            </div>
          </div>
          
          <div className="glass-card" style={{ textAlign: 'center' }}>
             <div style={{ fontSize: '32px', fontWeight: '900', letterSpacing: '-1px' }}>{formatTime(totalTime)}</div>
             <div style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', marginTop: '4px', fontWeight: '700' }}>Time in Saddle</div>
          </div>
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
                  <div style={{ textAlign: 'center', marginTop: '40px', color: '#666' }}>
                    <p style={{ fontSize: '14px' }}>No results for "{bikeSearch}"</p>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1 }}>
                  {bikes.map(bike => {
                    const dbBike = bikeDatabase.find(b => b.brand.toLowerCase() === (bike.brand || '').toLowerCase() && b.name.toLowerCase() === (bike.name || '').toLowerCase());
                    const imgUrl = bike.img || dbBike?.img;
                    const ccVal = bike.cc || dbBike?.cc;
                    return (
                      <div key={bike.id} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'space-between' }}>
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
              <div style={{ fontSize: '11px', color: '#4ade80', marginTop: '4px', fontWeight: '600' }}>✓ Auto-saved to Cloud & Device</div>
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
                  <button onClick={() => setDistanceUnit('km')} style={{ padding: '6px 14px', borderRadius: '10px', border: 'none', fontSize: '12px', fontWeight: '700', cursor: 'pointer', background: distanceUnit === 'km' ? '#4a90e2' : 'transparent', color: distanceUnit === 'km' ? '#fff' : '#888', transition: 'all 0.3s' }}>KM</button>
                  <button onClick={() => setDistanceUnit('mi')} style={{ padding: '6px 14px', borderRadius: '10px', border: 'none', fontSize: '12px', fontWeight: '700', cursor: 'pointer', background: distanceUnit === 'mi' ? '#4a90e2' : 'transparent', color: distanceUnit === 'mi' ? '#fff' : '#888', transition: 'all 0.3s' }}>Miles</button>
                </div>
              </div>

              {/* Speed Unit */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Zap size={18} color="#4a90e2" />
                  <span style={{ fontSize: '14px', fontWeight: '600' }}>Speed Unit</span>
                </div>
                <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '3px' }}>
                  <button onClick={() => setSpeedUnit('kmh')} style={{ padding: '6px 14px', borderRadius: '10px', border: 'none', fontSize: '12px', fontWeight: '700', cursor: 'pointer', background: speedUnit === 'kmh' ? '#4a90e2' : 'transparent', color: speedUnit === 'kmh' ? '#fff' : '#888', transition: 'all 0.3s' }}>km/h</button>
                  <button onClick={() => setSpeedUnit('mph')} style={{ padding: '6px 14px', borderRadius: '10px', border: 'none', fontSize: '12px', fontWeight: '700', cursor: 'pointer', background: speedUnit === 'mph' ? '#4a90e2' : 'transparent', color: speedUnit === 'mph' ? '#fff' : '#888', transition: 'all 0.3s' }}>mph</button>
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
      
      {/* 
        This is the DOM node we will screenshot. 
      */}
      <div 
        ref={shareContainerRef} 
        style={{ 
          position: 'absolute', 
          top: (shareMode && !isCapturing) ? '38%' : 0, 
          left: 0, 
          right: shareMode ? 'auto' : 0, 
          bottom: shareMode ? 'auto' : 0, 
          width: '100%',
          aspectRatio: shareMode ? '9/16' : 'auto',
          height: shareMode ? 'auto' : '100%',
          overflow: 'hidden', 
          background: isTransparentBg ? 'transparent' : (themeConfigs[shareTheme]?.bg || ((shareMode && shareTheme === 'NEON') ? '#000' : 'transparent')),
          transform: (shareMode && !isCapturing) ? 'translateY(-50%) scale(0.65)' : 'none',
          transformOrigin: 'center center',
          transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          pointerEvents: shareMode ? 'none' : 'auto' // Prevent map dragging during share preview
        }}
      >
        
        {/* MAP LAYER */}
        {activeTab === 'RIDE' && session && (
          <div className="map-background" style={{ 
            opacity: (shareMode && themeConfigs[shareTheme]?.hideMap) ? 0 : 1, 
            position: 'absolute',
            top: 0, bottom: 0, left: 0, right: 0
          }}>
            <MapContainer ref={mapRef} center={currentPosition} zoom={15} zoomControl={false} attributionControl={false} style={{ height: '100%', width: '100%', backgroundColor: 'transparent' }}>
              {!(shareMode && themeConfigs[shareTheme]?.hideMap) && (
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution=""
                  className="dark-map-tiles"
                />
              )}
              {viewingRoute && viewingRoute.route_path && <MapBoundsFitter path={viewingRoute.route_path} isShareMode={shareMode} shareTheme={shareTheme} />}
              <Polyline 
                positions={routePath} 
                color={shareMode ? (themeConfigs[shareTheme]?.routeColor || '#4a90e2') : '#4a90e2'} 
                weight={shareMode ? 6 : 4} 
                opacity={1} 
              />
              {!viewingRoute && <Marker position={currentPosition} icon={bikeIcon} />}
            </MapContainer>
          </div>
        )}

        {/* CUSTOM LOGO FOR SHARE SCREENSHOT */}
        {shareMode && (
           <div style={{ position: 'absolute', bottom: '40px', left: '20px', zIndex: 60 }}>
              <img src="/logo_white.png" alt="Mokat Touring Logo" style={{ height: '24px', width: 'auto', filter: shareTheme === 'NEON' ? 'drop-shadow(0 0 10px #0f0)' : 'drop-shadow(0 2px 10px rgba(0,0,0,0.8))' }} />
           </div>
        )}

        {/* STRICT STATS OVERLAY FOR SHARE */}
        {shareMode && viewingRoute && (
          <div style={getShareStyles().wrapper}>
             <div style={getShareStyles().title}>Afternoon Ride</div>
             <div style={getShareStyles().date}>{new Date(viewingRoute.created_at).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
             
             <div style={getShareStyles().statRow}>
                <div>
                   <div style={getShareStyles().statVal}>{Number(viewingRoute.distance).toFixed(1)} <span style={{fontSize:'0.5em', fontWeight:'normal'}}>km</span></div>
                   <div style={getShareStyles().statLbl}>Distance</div>
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
               const svgW = 200, svgH = 200;
               const pad = 20;
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
                   <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
                     <polyline points={points} fill="none" stroke={themeConfigs[shareTheme]?.routeColor || '#fc4c02'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                   </svg>
                 </div>
               );
             })()}
          </div>
        )}

      </div> {/* END SHARE CONTAINER */}


      {/* INTERACTIVE UI LAYER (Will NOT be captured by html2canvas) */}
      <div className="content-layer" style={{ pointerEvents: shareMode ? 'none' : 'auto' }}>
        
        {/* Hide Top Nav during Share Mode */}
        {!shareMode && (
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
        )}

        {renderContent()}

        {/* Hide Bottom Nav during Share Mode */}
        {!shareMode && (
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
        )}
      </div>

      {/* SHARE EDITOR CONTROLS (Appears above everything when shareMode is active) */}
      {shareMode && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#111', zIndex: 100, padding: '20px', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', pointerEvents: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
             <h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>Style Editor</h3>
             <button onClick={() => setShareMode(false)} style={{ background: 'transparent', border: 'none', color: '#fff', padding: '4px' }}>
               <X size={24} />
             </button>
          </div>
          
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '20px', WebkitOverflowScrolling: 'touch' }}>
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

           <button onClick={generateShareImage} className="glass-button primary" style={{ width: '100%', padding: '16px', fontSize: '16px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', gap: '8px' }}>
              {isCapturing ? 'Generating Image...' : <><Download size={20} /> Download SG</>}
           </button>
        </div>
      )}

    </div>
  );
}

export default App;
