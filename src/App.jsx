import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Map as MapIcon, User, Activity, Navigation, ChevronRight, Zap, Bike, LogOut, LocateFixed, Camera, LayoutTemplate, X, Download, Headset, Mic, MicOff, PhoneOff } from 'lucide-react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import html2canvas from 'html2canvas';
import { Peer } from 'peerjs';
import 'leaflet/dist/leaflet.css';
import './index.css';
import { supabase } from './supabaseClient';

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

function MapBoundsFitter({ path, isShareMode }) {
  const map = useMap();
  useEffect(() => {
    if (path && path.length > 0) {
      const bounds = L.latLngBounds(path);
      // Auto-center the route perfectly, especially when entering share mode
      map.fitBounds(bounds, { 
        paddingTopLeft: [40, 40],
        paddingBottomRight: [40, 160] // Extra padding at bottom to account for stats UI
      });
    }
  }, [path, map, isShareMode]);
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
  const [isCapturing, setIsCapturing] = useState(false);
  
  const [currentPosition, setCurrentPosition] = useState([-6.2088, 106.8456]); 
  const [routePath, setRoutePath] = useState([]); 

  // Cloud State
  const [bikes, setBikes] = useState([]);
  const [rides, setRides] = useState([]);
  const [showAddBike, setShowAddBike] = useState(false);
  const [newBike, setNewBike] = useState({ brand: '', name: '', type: '' });
  const [viewingRoute, setViewingRoute] = useState(null);

  // Radio State
  const [inRadio, setInRadio] = useState(false);
  const [radioPeers, setRadioPeers] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
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
      if (error) alert(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
      if (error) alert(error.message);
      else alert("Akun berhasil dibuat! Silakan cek email jika diminta konfirmasi, atau langsung login.");
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
        const canvas = await html2canvas(shareContainerRef.current, {
          useCORS: true,
          allowTaint: true,
          backgroundColor: shareTheme === 'NEON' ? '#000000' : '#050505',
          scale: 2 
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

  const handleSaveBike = async () => {
    if (!newBike.name || !newBike.brand) return;
    const newBikeData = {
      user_id: session.user.id,
      brand: newBike.brand,
      name: newBike.name,
      type: newBike.type
    };
    const { data, error } = await supabase.from('motorcycles').insert([newBikeData]).select();
    if (!error && data) {
      setBikes([data[0], ...bikes]);
      setNewBike({ brand: '', name: '', type: '' });
      setShowAddBike(false);
    } else {
      console.error("Failed to save bike:", error);
    }
  };

  const joinRadio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      
      const peer = new Peer();
      peerInstanceRef.current = peer;
      
      peer.on('open', (id) => {
        setInRadio(true);
        const channel = supabase.channel('radio_room', {
          config: { presence: { key: session.user.id } }
        });
        radioChannelRef.current = channel;

        channel.on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          for (const key in state) {
            const presence = state[key][0];
            if (presence.peerId && presence.peerId !== id) {
              // Lowest peer ID initiates the call to avoid duplicate connections
              if (!callsRef.current[presence.peerId] && id > presence.peerId) {
                const call = peer.call(presence.peerId, stream);
                setupCallEvents(call, presence.email);
              }
            }
          }
        });

        channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({ user_id: session.user.id, peerId: id, email: session.user.email });
          }
        });
      });

      peer.on('call', (call) => {
        call.answer(localStreamRef.current);
        const state = radioChannelRef.current?.presenceState() || {};
        let callerEmail = "Rider";
        for (const key in state) {
          if (state[key][0].peerId === call.peer) callerEmail = state[key][0].email;
        }
        setupCallEvents(call, callerEmail);
      });

    } catch (err) {
      console.error(err);
      alert("Gagal mengakses mikrofon. Pastikan izin mic diberikan di browser.");
    }
  };

  const setupCallEvents = (call, callerEmail) => {
    callsRef.current[call.peer] = call;
    
    call.on('stream', (remoteStream) => {
      if (document.getElementById(`audio-${call.peer}`)) return; // Already exists
      const audio = document.createElement('audio');
      audio.srcObject = remoteStream;
      audio.autoplay = true;
      audio.id = `audio-${call.peer}`;
      document.body.appendChild(audio);
      
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
      <div className="app-container auth-bg" style={{ justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
         <div className="app-container-overlay" style={{position:'absolute', top:0, left:0, right:0, bottom:0, background:'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(5,5,5,1) 100%)', zIndex:0}}></div>
         <div className="glass-panel" style={{ padding: '40px 32px', width: '100%', maxWidth: '400px', zIndex: 1, borderRadius: '32px' }}>
            <h1 style={{ textAlign: 'center', marginBottom: '12px', fontSize: '28px', fontWeight: '900', letterSpacing: '-1px' }}>Mokat Touring</h1>
            <p style={{ textAlign: 'center', color: '#aaa', marginBottom: '40px', fontSize: '15px' }}>Log in to access your cloud garage & routes.</p>
            
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
  const getShareStyles = () => {
    if (shareTheme === 'CLASSIC') {
      return {
        wrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: '40px 20px', background: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.8) 50%, rgba(0,0,0,0) 100%)', zIndex: 50 },
        title: { fontSize: '28px', fontWeight: 'bold', color: '#fff', marginBottom: '4px' },
        date: { fontSize: '14px', color: '#aaa', marginBottom: '24px' },
        statRow: { display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '16px' },
        statVal: { fontSize: '24px', fontWeight: 'bold', color: '#fff' },
        statLbl: { fontSize: '12px', color: '#888', textTransform: 'uppercase' }
      };
    }
    if (shareTheme === 'NEON') {
      return {
        wrapper: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, background: '#000', padding: '40px 20px', zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' },
        title: { fontSize: '32px', fontWeight: '900', color: '#0f0', textShadow: '0 0 10px #0f0', marginBottom: '4px' },
        date: { fontSize: '14px', color: '#0a0', marginBottom: '40px' },
        statRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', background: 'rgba(0,255,0,0.05)', padding: '20px', borderRadius: '12px', border: '1px solid #0f0' },
        statVal: { fontSize: '22px', fontWeight: 'bold', color: '#0f0', textShadow: '0 0 5px #0f0' },
        statLbl: { fontSize: '11px', color: '#0a0', textTransform: 'uppercase' }
      };
    }
    if (shareTheme === 'MINIMAL') {
      return {
        wrapper: { position: 'absolute', top: '40px', left: '20px', right: '20px', background: 'rgba(255,255,255,0.95)', padding: '24px', borderRadius: '24px', zIndex: 50, boxShadow: '0 20px 40px rgba(0,0,0,0.5)' },
        title: { fontSize: '24px', fontWeight: '800', color: '#000', marginBottom: '4px' },
        date: { fontSize: '12px', color: '#666', marginBottom: '20px' },
        statRow: { display: 'flex', justifyContent: 'space-between' },
        statVal: { fontSize: '20px', fontWeight: '800', color: '#000' },
        statLbl: { fontSize: '10px', color: '#888', textTransform: 'uppercase', fontWeight: '600' }
      };
    }
    if (shareTheme === 'STRAVA_DARK') {
      return {
        wrapper: { position: 'absolute', bottom: '120px', left: 0, right: 0, padding: '0 40px', zIndex: 50 },
        title: { display: 'none' },
        date: { display: 'none' },
        statRow: { display: 'flex', justifyContent: 'space-between', borderTop: 'none', paddingTop: 0 },
        statVal: { fontSize: '36px', fontWeight: '900', color: '#fff', textShadow: '0 2px 10px rgba(0,0,0,0.8)' },
        statLbl: { fontSize: '12px', color: '#aaa', textTransform: 'uppercase', fontWeight: 'bold' }
      };
    }
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
              <div className="btn-inner" style={{ color: isTracking ? '#ef4444' : '#000' }}>
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
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
             <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: inRadio ? 'rgba(74, 222, 128, 0.2)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: inRadio ? '0 0 20px rgba(74, 222, 128, 0.4)' : 'none', transition: 'all 0.3s' }}>
                <Headset size={40} color={inRadio ? '#4ade80' : '#888'} />
             </div>
             <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>Live Intercom</h2>
             <p style={{ color: '#888', fontSize: '13px', marginTop: '4px' }}>Ngobrol bareng teman pas riding, jarak tak terbatas.</p>
          </div>

          {!inRadio ? (
            <button className="glass-button primary" onClick={joinRadio} style={{ padding: '16px', fontSize: '16px', fontWeight: 'bold' }}>
              Connect to Room
            </button>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
                 <button className="glass-button" onClick={toggleMute} style={{ flex: 1, padding: '16px', background: isMuted ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.1)', color: isMuted ? '#ef4444' : '#fff' }}>
                    {isMuted ? <MicOff size={24} style={{margin:'0 auto'}} /> : <Mic size={24} style={{margin:'0 auto'}} />}
                 </button>
                 <button className="glass-button" onClick={leaveRadio} style={{ flex: 1, padding: '16px', background: '#ef4444', color: '#fff', border: 'none' }}>
                    <PhoneOff size={24} style={{margin:'0 auto'}} />
                 </button>
              </div>

              <h3 style={{ fontSize: '14px', color: '#888', marginBottom: '12px' }}>Active Riders ({radioPeers.length + 1})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                 <div style={{ background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.3)', padding: '12px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 'bold' }}>
                       {session.user.email.substring(0,2).toUpperCase()}
                    </div>
                    <div>
                       <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#4ade80' }}>You {isMuted && '(Muted)'}</div>
                    </div>
                 </div>

                 {radioPeers.map(peer => (
                   <div key={peer.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#4a90e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>
                         {peer.email.substring(0,2).toUpperCase()}
                      </div>
                      <div>
                         <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{peer.email.split('@')[0]}</div>
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
      return (
        <div className="glass-panel" style={{ flex: 1, padding: '24px', marginTop: '20px', display: 'flex', flexDirection: 'column' }}>
          
          {showAddBike ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Add Motorcycle</h2>
              <input 
                className="glass-input" 
                placeholder="Brand (e.g. Yamaha, Honda)" 
                value={newBike.brand} 
                onChange={(e) => setNewBike({...newBike, brand: e.target.value})} 
              />
              <input 
                className="glass-input" 
                placeholder="Model Name (e.g. R25, CBR150R)" 
                value={newBike.name} 
                onChange={(e) => setNewBike({...newBike, name: e.target.value})} 
              />
              <input 
                className="glass-input" 
                placeholder="Type (Sport, Matic, Cruiser)" 
                value={newBike.type} 
                onChange={(e) => setNewBike({...newBike, type: e.target.value})} 
              />
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button className="glass-button" style={{ flex: 1, padding: '12px' }} onClick={() => setShowAddBike(false)}>Cancel</button>
                <button className="glass-button primary" style={{ flex: 1, padding: '12px' }} onClick={handleSaveBike}>Save</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '600' }}>Cloud Garage</h2>
                <button className="glass-button" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setShowAddBike(true)}>
                  + Add
                </button>
              </div>

              {bikes.length === 0 ? (
                <div style={{ textAlign: 'center', marginTop: '40px', color: '#888' }}>
                  <Bike size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                  <p>Your garage is empty.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {bikes.map(bike => (
                    <div key={bike.id} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Bike size={24} color="#4a90e2" />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#fff' }}>{bike.brand} {bike.name}</h3>
                        <p style={{ fontSize: '13px', color: '#888', fontWeight: '500' }}>{bike.type || 'Standard'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      );
    }
  };

  const navItems = [
    { id: 'RIDE', icon: Navigation, label: 'RIDE' },
    { id: 'ROUTES', icon: MapIcon, label: 'ROUTES' },
    { id: 'RADIO', icon: Headset, label: 'RADIO' },
    { id: 'STATS', icon: Activity, label: 'STATS' },
    { id: 'GARAGE', icon: User, label: 'GARAGE' }
  ];

  return (
    <div className="app-container auth-bg" style={{ background: shareTheme === 'NEON' && shareMode ? '#000' : '' }}>
      
      {/* 
        This is the DOM node we will screenshot. 
      */}
      <div 
        ref={shareContainerRef} 
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          overflow: 'hidden', 
          background: (shareTheme === 'NEON' || shareTheme === 'STRAVA_DARK') ? '#000' : 'transparent',
          transform: (shareMode && !isCapturing) ? 'scale(0.8) translateY(-5%)' : 'none',
          transformOrigin: 'top center',
          transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          pointerEvents: shareMode ? 'none' : 'auto' // Prevent map dragging during share preview
        }}
      >
        
        {/* MAP LAYER */}
        {activeTab === 'RIDE' && session && (
          <div className="map-background" style={{ opacity: 1 }}>
            <MapContainer ref={mapRef} center={currentPosition} zoom={15} zoomControl={false} attributionControl={false} style={{ height: '100%', width: '100%', backgroundColor: (shareTheme === 'NEON' || shareTheme === 'STRAVA_DARK') ? '#000' : '#050505' }}>
              {!(shareMode && (shareTheme === 'NEON' || shareTheme === 'STRAVA_DARK')) && (
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution=""
                  className="dark-map-tiles"
                />
              )}
              {viewingRoute && viewingRoute.route_path && <MapBoundsFitter path={viewingRoute.route_path} isShareMode={shareMode} />}
              <Polyline 
                positions={routePath} 
                color={shareMode && shareTheme === 'NEON' ? '#0f0' : (shareMode && shareTheme === 'STRAVA_DARK' ? '#fc4c02' : '#4a90e2')} 
                weight={shareMode ? 6 : 4} 
                opacity={1} 
              />
              {!viewingRoute && <Marker position={currentPosition} icon={bikeIcon} />}
            </MapContainer>
          </div>
        )}

        {/* CUSTOM LOGO FOR SHARE SCREENSHOT */}
        {shareMode && (
           <div style={{ position: 'absolute', bottom: shareTheme==='STRAVA_DARK' ? '40px' : 'auto', top: shareTheme==='STRAVA_DARK' ? 'auto' : (shareTheme==='MINIMAL' ? '160px' : '40px'), left: shareTheme==='STRAVA_DARK' ? '40px' : '20px', zIndex: 60 }}>
              <img src="/logo.png" alt="Mokat Touring Logo" style={{ height: shareTheme === 'STRAVA_DARK' ? '24px' : '40px', width: 'auto', filter: `brightness(0) invert(1) ${shareTheme==='NEON' ? 'drop-shadow(0 0 10px #0f0)' : 'drop-shadow(0 2px 10px rgba(0,0,0,0.8))'}` }} />
           </div>
        )}

        {/* STRICT STATS OVERLAY FOR SHARE */}
        {shareMode && viewingRoute && (
          <div style={getShareStyles().wrapper}>
             <div style={getShareStyles().title}>Afternoon Ride</div>
             <div style={getShareStyles().date}>{new Date(viewingRoute.created_at).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
             
             <div style={getShareStyles().statRow}>
                <div>
                   <div style={getShareStyles().statVal}>{Number(viewingRoute.distance).toFixed(1)} km</div>
                   <div style={getShareStyles().statLbl}>Distance</div>
                </div>
                <div>
                   <div style={getShareStyles().statVal}>{Math.round(viewingRoute.avg_speed)} km/h</div>
                   <div style={getShareStyles().statLbl}>Avg Speed</div>
                </div>
                <div>
                   <div style={getShareStyles().statVal}>{formatTime(viewingRoute.time)}</div>
                   <div style={getShareStyles().statLbl}>Time</div>
                </div>
             </div>
          </div>
        )}

      </div> {/* END SHARE CONTAINER */}


      {/* INTERACTIVE UI LAYER (Will NOT be captured by html2canvas) */}
      <div className="content-layer" style={{ pointerEvents: shareMode ? 'none' : 'none' }}>
        
        {/* Hide Top Nav during Share Mode */}
        {!shareMode && (
          <header className="top-nav">
            <div className="profile-pic" />
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
          
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '20px' }}>
             <button onClick={() => setShareTheme('STRAVA_DARK')} className="glass-button" style={{ flex: 1, padding: '12px', minWidth: '100px', background: shareTheme === 'STRAVA_DARK' ? '#4a90e2' : 'rgba(255,255,255,0.1)' }}>Pro</button>
             <button onClick={() => setShareTheme('CLASSIC')} className="glass-button" style={{ flex: 1, padding: '12px', minWidth: '100px', background: shareTheme === 'CLASSIC' ? '#4a90e2' : 'rgba(255,255,255,0.1)' }}>Classic</button>
             <button onClick={() => setShareTheme('NEON')} className="glass-button" style={{ flex: 1, padding: '12px', minWidth: '100px', background: shareTheme === 'NEON' ? '#4a90e2' : 'rgba(255,255,255,0.1)' }}>Neon</button>
             <button onClick={() => setShareTheme('MINIMAL')} className="glass-button" style={{ flex: 1, padding: '12px', minWidth: '100px', background: shareTheme === 'MINIMAL' ? '#4a90e2' : 'rgba(255,255,255,0.1)' }}>Minimal</button>
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
