package com.rainenterprises.voiceenigma;

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SpeechBridgePlugin.class);
        super.onCreate(savedInstanceState);
        enableFullScreen();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            enableFullScreen();
        }
    }

    private void enableFullScreen() {
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        final View decorView = getWindow().getDecorView();
        final int uiOptions =
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_FULLSCREEN;
        decorView.setSystemUiVisibility(uiOptions);

        // The status/nav bar can briefly reappear if the user swipes from
        // an edge -- re-hide it automatically once they're done.
        decorView.setOnSystemUiVisibilityChangeListener(visibility -> {
            if ((visibility & View.SYSTEM_UI_FLAG_FULLSCREEN) == 0) {
                decorView.setSystemUiVisibility(uiOptions);
            }
        });
    }
}
