package com.mokat.touring;

import android.content.Intent;
import android.os.Build;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "RadioService")
public class RadioServicePlugin extends Plugin {

    @PluginMethod()
    public void startService(PluginCall call) {
        String roomCode = call.getString("roomCode", "Radio");
        
        Intent serviceIntent = new Intent(getContext(), RadioForegroundService.class);
        serviceIntent.putExtra("roomCode", roomCode);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(serviceIntent);
        } else {
            getContext().startService(serviceIntent);
        }
        
        call.resolve();
    }

    @PluginMethod()
    public void stopService(PluginCall call) {
        Intent serviceIntent = new Intent(getContext(), RadioForegroundService.class);
        getContext().stopService(serviceIntent);
        call.resolve();
    }
}
