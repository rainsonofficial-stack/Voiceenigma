/**
 * speech-bridge-shim.js
 *
 * Replaces window.SpeechRecognition / window.webkitSpeechRecognition with a
 * version backed by Android's native SpeechRecognizer (via the SpeechBridge
 * Capacitor plugin), instead of the browser/WebView speech API — which is
 * unreliable or unavailable inside a plain WebView.
 *
 * IMPORTANT: load this BEFORE index.html's main <script> block, so that
 * APP.initVoiceRecognition() picks up this version of SpeechRecognition.
 *
 * The event shapes (onresult, onend, onerror) match the standard Web Speech
 * API closely enough that your existing APP.initVoiceRecognition() logic
 * (onend backoff restart, onresult stitching, watchdog) needs ZERO changes.
 */
(function () {
    if (!window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.SpeechBridge) {
        console.warn('[speech-bridge-shim] Native SpeechBridge plugin not found. ' +
            'Falling back to whatever browser SpeechRecognition exists (may not work in WebView).');
        return;
    }

    const Native = window.Capacitor.Plugins.SpeechBridge;

    function NativeSpeechRecognition() {
        this.continuous = true;
        this.interimResults = true;
        this.lang = 'en-US';
        this.readyState = 'inactive';
        this.onstart = null;
        this.onresult = null;
        this.onend = null;
        this.onerror = null;
        this._resultIndex = 0;
        this._handles = [];
    }

    NativeSpeechRecognition.prototype._wire = function () {
        const self = this;
        this._handles.push(Native.addListener('start', function () {
            self.readyState = 'listening';
            if (self.onstart) self.onstart();
        }));
        this._handles.push(Native.addListener('partialResult', function (data) {
            self._emit(data.transcript, false);
        }));
        this._handles.push(Native.addListener('finalResult', function (data) {
            self._emit(data.transcript, true);
        }));
        this._handles.push(Native.addListener('end', function () {
            self.readyState = 'inactive';
            self._unwire();
            if (self.onend) self.onend();
        }));
        this._handles.push(Native.addListener('error', function (data) {
            if (self.onerror) self.onerror({ error: data.error });
        }));
    };

    NativeSpeechRecognition.prototype._unwire = function () {
        this._handles.forEach(function (h) { try { h.remove(); } catch (e) {} });
        this._handles = [];
    };

    // Builds an event object shaped like the standard SpeechRecognitionEvent,
    // matching what index.html's onresult handler expects:
    //   event.resultIndex, event.results[i].isFinal, event.results[i][0].transcript
    NativeSpeechRecognition.prototype._emit = function (transcript, isFinal) {
        if (!this.onresult) return;
        const idx = this._resultIndex;
        const alt = [{ transcript: transcript, confidence: 1 }];
        alt.isFinal = isFinal;
        const results = { length: idx + 1 };
        results[idx] = alt;
        this.onresult({ resultIndex: idx, results: results });
        if (isFinal) this._resultIndex++;
    };

    NativeSpeechRecognition.prototype.start = function () {
        if (this.readyState === 'listening') {
            const e = new Error('already listening');
            e.name = 'InvalidStateError';
            throw e;
        }
        this._wire();
        const self = this;
        Native.start({ lang: this.lang }).catch(function () {
            self._unwire();
            self.readyState = 'inactive';
            if (self.onerror) self.onerror({ error: 'not-allowed' });
        });
    };

    NativeSpeechRecognition.prototype.stop = function () {
        Native.stop();
    };

    NativeSpeechRecognition.prototype.abort = function () {
        Native.abort();
    };

    window.SpeechRecognition = NativeSpeechRecognition;
    window.webkitSpeechRecognition = NativeSpeechRecognition;
})();

