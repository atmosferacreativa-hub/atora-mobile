export type ScormVersion = '1.2' | '2004';

export function buildScormInjectedRuntime(input: {
  attemptId: number;
  scormVersion: string;
  initialValues: Record<string, string>;
}): string {
  const payload = JSON.stringify({
    attemptId: input.attemptId,
    scormVersion: input.scormVersion,
    initialValues: input.initialValues,
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
        function init(){ lastError = '0'; post({ type: 'scorm.init', attemptId: attemptId, version: version }); return 'true'; }
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

