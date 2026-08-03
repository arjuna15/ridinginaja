package com.mokat.touring;

import android.util.Log;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import io.agora.rtc2.Constants;
import io.agora.rtc2.IRtcEngineEventHandler;
import io.agora.rtc2.RtcEngine;
import io.agora.rtc2.RtcEngineConfig;
import io.agora.rtc2.ChannelMediaOptions;

@CapacitorPlugin(name = "AgoraRadio")
public class AgoraPlugin extends Plugin {
    private RtcEngine mRtcEngine;
    private final String TAG = "AgoraPlugin";

    private final IRtcEngineEventHandler mRtcEventHandler = new IRtcEngineEventHandler() {
        @Override
        public void onJoinChannelSuccess(String channel, int uid, int elapsed) {
            Log.i(TAG, "Join channel success, uid: " + (uid & 0xFFFFFFFFL));
            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("uid", uid);
            notifyListeners("onJoinChannelSuccess", ret);
        }

        @Override
        public void onUserJoined(int uid, int elapsed) {
            Log.i(TAG, "User joined: " + (uid & 0xFFFFFFFFL));
            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("uid", uid);
            notifyListeners("onUserJoined", ret);
        }

        @Override
        public void onUserOffline(int uid, int reason) {
            Log.i(TAG, "User offline: " + (uid & 0xFFFFFFFFL));
            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("uid", uid);
            notifyListeners("onUserOffline", ret);
        }
    };

    @PluginMethod()
    public void initialize(PluginCall call) {
        String appId = call.getString("appId");
        if (appId == null || appId.isEmpty()) {
            call.reject("App ID is required");
            return;
        }

        try {
            RtcEngineConfig config = new RtcEngineConfig();
            config.mContext = getContext();
            config.mAppId = appId;
            config.mEventHandler = mRtcEventHandler;
            mRtcEngine = RtcEngine.create(config);
            // Enable audio module
            mRtcEngine.enableAudio();
            mRtcEngine.setChannelProfile(Constants.CHANNEL_PROFILE_COMMUNICATION);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to initialize Agora", e);
        }
    }

    @PluginMethod()
    public void joinChannel(PluginCall call) {
        if (mRtcEngine == null) {
            call.reject("Agora not initialized");
            return;
        }
        String channelName = call.getString("channelName");
        String token = call.getString("token", null);
        int uid = call.getInt("uid", 0);

        ChannelMediaOptions options = new ChannelMediaOptions();
        options.autoSubscribeAudio = true;
        options.publishMicrophoneTrack = true;
        options.clientRoleType = Constants.CLIENT_ROLE_BROADCASTER;

        mRtcEngine.joinChannel(token, channelName, uid, options);
        call.resolve();
    }

    @PluginMethod()
    public void leaveChannel(PluginCall call) {
        if (mRtcEngine != null) {
            mRtcEngine.leaveChannel();
        }
        call.resolve();
    }

    @PluginMethod()
    public void muteMic(PluginCall call) {
        if (mRtcEngine != null) {
            boolean muted = call.getBoolean("muted", false);
            mRtcEngine.muteLocalAudioStream(muted);
        }
        call.resolve();
    }

    @PluginMethod()
    public void setSpeaker(PluginCall call) {
        if (mRtcEngine != null) {
            boolean speaker = call.getBoolean("speaker", true);
            mRtcEngine.setEnableSpeakerphone(speaker);
        }
        call.resolve();
    }
}
