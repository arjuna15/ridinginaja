import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Map as MapIcon, User, Activity, Navigation, ChevronRight, Zap, Bike, LogOut, LocateFixed, Camera } from 'lucide-react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import html2canvas from 'html2canvas';
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

function MapBoundsFitter({ path }) {
  const map = useMap();
  useEffect(() => {
    if (path && path.length > 0) {
      const bounds = L.latLngBounds(path);
      map.fitBounds(bounds, { padding: [40, 40] });
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
  const shareContainerRef = useRef(null); // Reference for taking screenshot

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
  const [isExporting, setIsExporting] = useState(false);
  
  const [currentPosition, setCurrentPosition] = useState([-6.2088, 106.8456]); 
  const [routePath, setRoutePath] = useState([]); 

  // Cloud State
  const [bikes, setBikes] = useState([]);
  const [rides, setRides] = useState([]);
  const [showAddBike, setShowAddBike] = useState(false);
  const [newBike, setNewBike] = useState({ brand: '', name: '', type: '' });
  const [viewingRoute, setViewingRoute] = useState(null);

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
    setIsExporting(true);
    
    // Give it a tiny delay to hide the UI elements cleanly before screenshot
    setTimeout(async () => {
      try {
        const canvas = await html2canvas(shareContainerRef.current, {
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#050505',
          scale: 2 // High resolution
        });
        
        const image = canvas.toDataURL("image/png");
        
        // Create an invisible link to trigger download
        const a = document.createElement('a');
        a.href = image;
        a.download = `mokat-ride-${new Date().getTime()}.png`;
        a.click();
        
      } catch (err) {
        console.error("Failed to generate image:", err);
        alert("Gagal men-generate gambar SG. Pastikan peta sudah ter-load sepenuhnya.");
      } finally {
        setIsExporting(false);
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

  if (!session) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center', padding: '20px', backgroundImage: 'url(/map-bg.jpg)', backgroundSize: 'cover' }}>
         <div className="app-container-overlay" style={{position:'absolute', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.8)', zIndex:0}}></div>
         <div className="glass-panel" style={{ padding: '32px', width: '100%', maxWidth: '400px', zIndex: 1 }}>
            <h1 style={{ textAlign: 'center', marginBottom: '8px', fontSize: '24px', fontWeight: 'bold' }}>Mokat Touring</h1>
            <p style={{ textAlign: 'center', color: '#888', marginBottom: '32px', fontSize: '14px' }}>Log in to access your cloud garage & routes.</p>
            
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

  const renderContent = () => {
    if (activeTab === 'RIDE') {
      return (
        <>
          <div className="dashboard-spacer"></div>
          
          {/* Watermark Logo (Only visible during export) */}
          {isExporting && (
             <div style={{ position: 'absolute', top: '40px', left: '20px', zIndex: 50, color: '#fff', fontSize: '24px', fontWeight: 'bold', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>
                MOKAT<span style={{color: '#4a90e2'}}>TOURING</span>
             </div>
          )}

          {/* LOCATE BUTTON - Hide during export */}
          {!viewingRoute && !isExporting && (
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

          {/* VIEWING ROUTE HEADER - Hide during export */}
          {viewingRoute && !isExporting && (
             <div className="glass-panel" style={{ padding: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div>
                 <p style={{fontSize: '12px', color: '#888'}}>Viewing Saved Route</p>
                 <p style={{fontSize: '14px', fontWeight: 'bold'}}>{new Date(viewingRoute.created_at).toLocaleDateString()}</p>
               </div>
               
               <div style={{ display: 'flex', gap: '8px' }}>
                 <button className="glass-button primary" style={{padding: '6px 12px', fontSize: '12px', background: '#4a90e2', color: '#fff'}} onClick={generateShareImage}>
                   <Camera size={14} style={{ marginRight: '4px' }} /> Share SG
                 </button>
                 <button className="glass-button" style={{padding: '6px 12px', fontSize: '12px'}} onClick={() => {
                   setViewingRoute(null);
                   setRoutePath([]);
                   handleCenterMap();
                 }}>Close</button>
               </div>
             </div>
          )}

          {/* STATS PANEL */}
          <div className="stats-panel glass-panel" style={{ 
            marginBottom: isExporting ? '40px' : '24px', 
            background: isExporting ? 'rgba(0,0,0,0.8)' : undefined // Darker background for export readability
          }}>
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

          {!viewingRoute && !isExporting && (
            <div className="action-area">
              <div className="btn-start" onClick={isTracking ? stopTracking : startTracking}>
                <div className="btn-inner" style={{ color: isTracking ? '#ef4444' : '#000' }}>
                  {isTracking ? <Square size={24} fill="currentColor" /> : <Play size={28} fill="currentColor" style={{ marginLeft: '4px' }} />}
                </div>
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
                onClick={() => {
                  setViewingRoute(ride);
                  setRoutePath(ride.route_path || []);
                  setActiveTab('RIDE');
                }}
                style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}
              >
                <h3 style={{ fontSize: '15px', marginBottom: '4px', color: '#fff' }}>Ride on {new Date(ride.created_at).toLocaleDateString()}</h3>
                <p style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>{Number(ride.distance).toFixed(2)} km • {formatTime(ride.time)}</p>
                <div style={{ display: 'flex', alignItems: 'center', color: '#4a90e2', fontSize: '13px', fontWeight: '500' }}>
                  View on Map <ChevronRight size={16} />
                </div>
              </div>
            ))
          )}
        </div>
      );
    }

    if (activeTab === 'STATS') {
      const totalKm = rides.reduce((acc, r) => acc + Number(r.distance), 0);
      const totalTime = rides.reduce((acc, r) => acc + Number(r.time), 0);
      
      return (
        <div className="glass-panel" style={{ flex: 1, padding: '24px', marginTop: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '24px' }}>My Statistics</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '16px', textAlign: 'center' }}>
              <Zap size={24} color="#f59e0b" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontSize: '24px', fontWeight: '700' }}>{totalKm.toFixed(1)}</div>
              <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', marginTop: '4px' }}>Total KM</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '16px', textAlign: 'center' }}>
              <Activity size={24} color="#10b981" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontSize: '24px', fontWeight: '700' }}>{rides.length}</div>
              <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', marginTop: '4px' }}>Total Rides</div>
            </div>
          </div>
          
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '16px', textAlign: 'center' }}>
             <div style={{ fontSize: '24px', fontWeight: '700' }}>{formatTime(totalTime)}</div>
             <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', marginTop: '4px' }}>Time in Saddle</div>
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
                    <div key={bike.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Bike size={20} color="#4a90e2" />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#fff' }}>{bike.brand} {bike.name}</h3>
                        <p style={{ fontSize: '12px', color: '#888' }}>{bike.type || 'Standard'}</p>
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
    { id: 'STATS', icon: Activity, label: 'STATS' },
    { id: 'GARAGE', icon: User, label: 'GARAGE' }
  ];

  return (
    <div className="app-container" ref={shareContainerRef}>
      
      {/* Map is only visible on the RIDE tab */}
      {activeTab === 'RIDE' && session && (
        <div className="map-background">
          <MapContainer ref={mapRef} center={currentPosition} zoom={15} zoomControl={false} style={{ height: '100%', width: '100%', backgroundColor: '#050505' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap'
              className="dark-map-tiles"
            />
            {viewingRoute && viewingRoute.route_path && <MapBoundsFitter path={viewingRoute.route_path} />}
            <Polyline positions={routePath} color="#4a90e2" weight={4} opacity={0.8} />
            {!viewingRoute && <Marker position={currentPosition} icon={bikeIcon} />}
          </MapContainer>
        </div>
      )}

      <div className="content-layer">
        
        {/* Hide Top Nav during Export for cleaner screenshot */}
        {!isExporting && (
          <header className="top-nav">
            <div className="profile-pic" />
            <div className="status-badge">
              <span className="dot" style={{ backgroundColor: isTracking ? '#ef4444' : '#4ade80', boxShadow: isTracking ? '0 0 8px #ef4444' : '0 0 8px #4ade80' }}></span>
              {statusText}
            </div>
            <button className="icon-btn" onClick={handleSignOut} title="Sign Out">
              <LogOut size={20} />
            </button>
          </header>
        )}

        {renderContent()}

        {/* Hide Bottom Nav during Export */}
        {!isExporting && (
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
    </div>
  );
}

export default App;
