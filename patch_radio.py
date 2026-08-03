import re

with open('src/App.jsx', 'r') as f:
    content = f.read()

# 1. Add Agora imports
if 'import { AgoraRadio }' not in content:
    content = content.replace(
        "import { supabase } from './supabaseClient';",
        "import { supabase } from './supabaseClient';\nimport { AgoraRadio } from './AgoraRadioPlugin';\nimport { generateAgoraToken } from './agoraToken';"
    )

# 2. Add agoraAppId and agoraAppCertificate state/constants
agora_consts = """
  const AGORA_APP_ID = "09671cbe777d40a199d330097b84fdb9";
  const AGORA_CERT = "8816ab36282644e09ad6e154f373ab68";
"""
if 'AGORA_APP_ID' not in content:
    content = content.replace("const [activeRoomCode, setActiveRoomCode] = useState('');", "const [activeRoomCode, setActiveRoomCode] = useState('');" + agora_consts)

# 3. Add Agora listeners in a useEffect
agora_listeners = """
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const u1 = AgoraRadio.addListener('onUserJoined', (info) => {
        setRadioPeers(prev => {
          if (prev.find(p => p.id === info.uid)) return prev;
          return [...prev, { id: info.uid, email: 'Rider ' + info.uid }];
        });
      });
      const u2 = AgoraRadio.addListener('onUserOffline', (info) => {
        setRadioPeers(prev => prev.filter(p => p.id !== info.uid));
      });
      return () => {
        if(u1) u1.remove();
        if(u2) u2.remove();
      };
    }
  }, []);
"""
if 'AgoraRadio.addListener' not in content:
    content = content.replace("useEffect(() => {\n    supabase.auth.getSession()", agora_listeners + "\n  useEffect(() => {\n    supabase.auth.getSession()")

# 4. Replace joinRadio
join_radio_old = """  const joinRadio = async () => {
    if (!roomCode.trim()) {
      setRoomCode('MOKAT-PUBLIC');
    }
    setRadioStatus("Requesting Microphone...");
    
    try {
      if (Capacitor.isNativePlatform()) {
        const tempAudio = document.createElement('audio');
        tempAudio.play().catch(()=>{});
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const tempCtx = new AudioContext();
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
        alert("Akses Mikrofon diblokir oleh browser! 🔒\\n\\nCara memperbaiki:\\n1. Klik ikon Gembok 🔒 di kiri atas URL (samping ridinginaja.vercel.app)\\n2. Pilih 'Site settings' (Setelan Situs)\\n3. Ubah izin Microphone (Mikrofon) menjadi 'Allow' (Izinkan)\\n4. Refresh halaman ini.");
      } else {
        alert("Gagal mengakses mikrofon: " + err.message);
      }
    }
  };"""

join_radio_new = """  const joinRadio = async () => {
    if (!roomCode.trim()) {
      setRoomCode('MOKAT-PUBLIC');
    }
    const targetRoom = roomCode.trim().toUpperCase() || 'MOKAT-PUBLIC';
    setRadioStatus("Connecting to Native Agora Server...");
    
    try {
      if (Capacitor.isNativePlatform()) {
        const uid = Math.floor(Math.random() * 1000000);
        const token = generateAgoraToken(AGORA_APP_ID, AGORA_CERT, targetRoom, uid);
        await AgoraRadio.initialize({ appId: AGORA_APP_ID });
        await AgoraRadio.joinChannel({ channelName: targetRoom, token, uid });
        
        setInRadio(true);
        setActiveRoomCode(targetRoom);
        setRadioStatus(`Native Online [${targetRoom}]`);
        setIsMuted(false);
        RadioService.startService({ roomCode: targetRoom }).catch(() => {});
        
        // Connect to supabase for Live Radar only
        const channel = supabase.channel(`radio_room_${targetRoom}`);
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
        channel.subscribe();
        radioChannelRef.current = channel;
      } else {
        alert("WebRTC Native (Agora) is only available on the Android APK! Please use the APK for background voice chat.");
      }
    } catch (err) {
      console.error(err);
      setInRadio(false);
      setRadioStatus("Failed to access Microphone");
      alert("Agora Native Error: " + err.message);
    }
  };"""

content = content.replace(join_radio_old, join_radio_new)

leave_radio_old = """  const leaveRadio = () => {
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
    setRadioStatus("Disconnected");
  };"""

leave_radio_new = """  const leaveRadio = () => {
    if (radioChannelRef.current) {
      radioChannelRef.current.unsubscribe();
      radioChannelRef.current = null;
    }
    if (Capacitor.isNativePlatform()) {
      AgoraRadio.leaveChannel().catch(()=>{});
      RadioService.stopService().catch(() => {});
    }
    setRadioPeers([]);
    setInRadio(false);
    setActiveRoomCode('');
    setRadioStatus("Disconnected");
  };"""
content = content.replace(leave_radio_old, leave_radio_new)

toggle_mute_old = """  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
        setIsMuted(!track.enabled);
      });
    }
  };"""

toggle_mute_new = """  const toggleMute = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    if (Capacitor.isNativePlatform()) {
      AgoraRadio.muteMic({ muted: newState }).catch(()=>{});
    }
  };"""
content = content.replace(toggle_mute_old, toggle_mute_new)

with open('src/App.jsx', 'w') as f:
    f.write(content)

print("Patch applied")
