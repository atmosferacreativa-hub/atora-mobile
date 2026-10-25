export type ScormVersion = '1.2' | '2004';

export function buildScormInjectedRuntime(input: {
  attemptId: number;
  scormVersion: string;
  initialValues: Record<string, string>;
  /** Solo para pruebas e2e: fuerza un commit temprano para validar la sincronización. */
  e2eProbe?: boolean;
}): string {
  const payload = JSON.stringify({
    attemptId: input.attemptId,
    scormVersion: input.scormVersion,
    initialValues: input.initialValues,
    e2eProbe: Boolean(input.e2eProbe),
  });

  return `
    (function(){
      try {
        var cfg = ${payload};
        var attemptId = cfg.attemptId || 0;
        var version = (cfg.scormVersion || '').toString();
        var initial = cfg.initialValues || {};
        var cmi = Object.assign({}, initial);
        var buffer = {};
        var lastError = '0';
        function post(msg){
          try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch(e) {}
        }
        function flush(){
          try {
            var keys = Object.keys(buffer);
            if (!keys.length) return 'true';
            var values = {};
            keys.forEach(function(k){ values[k] = String(buffer[k]); });
            buffer = {};
            post({ type: 'scorm.commit', attemptId: attemptId, values: values });
            return 'true';
          } catch(e) { lastError = '101'; return 'false'; }
        }
        function getValue(key){
          key = String(key || '');
          return Object.prototype.hasOwnProperty.call(cmi, key) ? String(cmi[key]) : '';
        }
        function setValue(key, value){
          key = String(key || '');
          if (!key) { lastError = '201'; return 'false'; }
          var v = value === null || value === undefined ? '' : String(value);
          cmi[key] = v;
          buffer[key] = v;
          lastError = '0';
          return 'true';
        }
        function init(){
          lastError = '0';
          post({ type: 'scorm.init', attemptId: attemptId, version: version });
          // E2E: forzar un commit temprano para poder comprobar que el servidor lo recibió.
          try {
            if (cfg.e2eProbe) {
              // 'cmi.suspend_data' es ampliamente soportado (SCORM 1.2/2004) y se guarda como estado del intento.
              setValue('cmi.suspend_data', 'ATORA_E2E_COMMIT');
              flush();
            }
          } catch(e) {}
          return 'true';
        }
        function term(){ flush(); post({ type: 'scorm.terminate', attemptId: attemptId }); lastError = '0'; return 'true'; }
        function error(){ return String(lastError || '0'); }
        function errorString(code){ return String(code || '0'); }
        function diag(code){ return String(code || '0'); }

        if (version === '2004') {
          window.API_1484_11 = {
            Initialize: init,
            Terminate: term,
            Commit: flush,
            GetValue: getValue,
            SetValue: setValue,
            GetLastError: error,
            GetErrorString: errorString,
            GetDiagnostic: diag,
          };
        } else {
          window.API = {
            LMSInitialize: init,
            LMSFinish: term,
            LMSCommit: flush,
            LMSGetValue: getValue,
            LMSSetValue: setValue,
            LMSGetLastError: error,
            LMSGetErrorString: errorString,
            LMSGetDiagnostic: diag,
          };
        }
        post({ type: 'scorm.ready', attemptId: attemptId, version: version });
      } catch(e) {}
    })();
    true;
  `;
}

