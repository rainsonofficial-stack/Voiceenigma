package com.rainenterprises.voiceenigma;

import android.Manifest;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PermissionState;

import org.json.JSONException;
import org.json.JSONObject;
import org.vosk.Model;
import org.vosk.Recognizer;
import org.vosk.android.RecognitionListener;
import org.vosk.android.SpeechService;
import org.vosk.android.StorageService;

/**
 * Exposes Vosk's fully offline, continuously-streaming speech recognizer to
 * the WebView as "SpeechBridge". Unlike Android's built-in SpeechRecognizer
 * (utterance-based, always cycles off/on), Vosk's SpeechService keeps a
 * single AudioRecord session running continuously -- there is no
 * restart/reinit cycle at all while listening is active, so no speech gets
 * dropped between sessions.
 *
 * The JS-side shim (www/speech-bridge-shim.js) is unchanged -- same method
 * names (start/stop/abort) and same event names (start/partialResult/
 * finalResult/error/end) as before, so index.html's decode logic needs no
 * changes either.
 */
@CapacitorPlugin(
    name = "SpeechBridge",
    permissions = {
        @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone")
    }
)
public class SpeechBridgePlugin extends Plugin implements RecognitionListener {

    private static final String TAG = "SpeechBridge";
    private Model model;
    private SpeechService speechService;
    private PluginCall pendingStartCall;

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "micPermsCallback");
            return;
        }
        beginOrResume(call);
    }

    @PermissionCallback
    private void micPermsCallback(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            beginOrResume(call);
        } else {
            JSObject err = new JSObject();
            err.put("error", "not-allowed");
            notifyListeners("error", err);
            call.reject("Microphone permission denied");
        }
    }

    private void beginOrResume(PluginCall call) {
        if (speechService != null) {
            // Model already loaded and service exists -- just resume listening.
            speechService.startListening(this);
            notifyListeners("start", new JSObject());
            call.resolve();
            return;
        }

        if (model != null) {
            startSpeechService(call);
            return;
        }

        // First call: unpack the bundled model from assets/model-en-us into
        // internal storage, then start. Only happens once per app install.
        pendingStartCall = call;
        StorageService.unpack(getContext(), "model-en-us", "model",
            (unpackedModel) -> {
                model = unpackedModel;
                startSpeechService(pendingStartCall);
            },
            (exception) -> {
                Log.e(TAG, "Failed to unpack Vosk model", exception);
                JSObject err = new JSObject();
                err.put("error", "model-load-failed");
                err.put("detail", String.valueOf(exception.getMessage()));
                notifyListeners("error", err);
                // IMPORTANT: resolve (not reject) and emit 'end' so the JS side's
                // existing onend-triggered backoff retry actually fires. Rejecting
                // here made the JS shim collapse this into a permanent 'not-allowed'
                // failure with no retry, which is why the mic never came on.
                if (pendingStartCall != null) {
                    pendingStartCall.resolve();
                }
                notifyListeners("end", new JSObject());
            });
    }

    private void startSpeechService(PluginCall call) {
        try {
            Recognizer rec = new Recognizer(model, 16000.0f);
            speechService = new SpeechService(rec, 16000.0f);
            speechService.startListening(this);
            notifyListeners("start", new JSObject());
            if (call != null) call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "Failed to start Vosk SpeechService", e);
            JSObject err = new JSObject();
            err.put("error", "unknown");
            err.put("detail", String.valueOf(e.getMessage()));
            notifyListeners("error", err);
            // Same reasoning as above: resolve + emit 'end' so JS retries instead
            // of silently stalling.
            if (call != null) call.resolve();
            notifyListeners("end", new JSObject());
        }
    }

    @Override
    public void onPartialResult(String hypothesis) {
        String text = extractField(hypothesis, "partial");
        if (text == null || text.trim().isEmpty()) return;
        JSObject data = new JSObject();
        data.put("transcript", text);
        data.put("isFinal", false);
        notifyListeners("partialResult", data);
    }

    @Override
    public void onResult(String hypothesis) {
        String text = extractField(hypothesis, "text");
        if (text == null || text.trim().isEmpty()) return;
        JSObject data = new JSObject();
        data.put("transcript", text);
        data.put("isFinal", true);
        notifyListeners("finalResult", data);
    }

    @Override
    public void onFinalResult(String hypothesis) {
        // Fired when stop()/cancel() flushes the last buffered utterance.
        String text = extractField(hypothesis, "text");
        if (text != null && !text.trim().isEmpty()) {
            JSObject data = new JSObject();
            data.put("transcript", text);
            data.put("isFinal", true);
            notifyListeners("finalResult", data);
        }
    }

    @Override
    public void onError(Exception exception) {
        Log.e(TAG, "Vosk recognition error", exception);
        JSObject data = new JSObject();
        data.put("error", "unknown");
        data.put("detail", String.valueOf(exception.getMessage()));
        notifyListeners("error", data);
        // Same fix as the startup paths: emit 'end' so the JS side's existing
        // retry logic restarts listening instead of silently stalling.
        notifyListeners("end", new JSObject());
    }

    @Override
    public void onTimeout() {
        Log.w(TAG, "Vosk recognition timeout (unexpected -- no timeout is configured)");
    }

    private String extractField(String json, String field) {
        try {
            JSONObject obj = new JSONObject(json);
            return obj.optString(field, "");
        } catch (JSONException e) {
            return null;
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (speechService != null) {
            speechService.stop();
        }
        notifyListeners("end", new JSObject());
        call.resolve();
    }

    @PluginMethod
    public void abort(PluginCall call) {
        if (speechService != null) {
            speechService.cancel();
        }
        notifyListeners("end", new JSObject());
        call.resolve();
    }
}
