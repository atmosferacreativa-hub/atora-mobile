import * as vm from 'vm';
import { buildScormInjectedRuntime } from '../runtime';

function runInjected(scormVersion: string, params?: { e2eProbe?: boolean }) {
  const messages: any[] = [];
  const window: any = {
    ReactNativeWebView: {
      postMessage: (raw: string) => messages.push(JSON.parse(raw)),
    },
  };

  const context = vm.createContext({ window, JSON, Object, String });
  vm.runInContext(buildScormInjectedRuntime({
    attemptId: 123,
    scormVersion,
    initialValues: { 'cmi.foo': 'bar' },
    e2eProbe: Boolean(params?.e2eProbe),
  }), context);
  return { window: (context as any).window as any, messages };
}

describe('SCORM injected runtime', () => {
  it('SCORM 1.2: Initialize / GetValue / SetValue / Commit / Terminate + errores', () => {
    const { window, messages } = runInjected('1.2');

    expect(messages.some((m) => m.type === 'scorm.ready' && m.attemptId === 123 && m.version === '1.2')).toBe(true);
    expect(typeof window.API?.LMSInitialize).toBe('function');

    expect(window.API.LMSInitialize('')).toBe('true');
    expect(messages.some((m) => m.type === 'scorm.init' && m.attemptId === 123 && m.version === '1.2')).toBe(true);

    expect(window.API.LMSGetValue('cmi.foo')).toBe('bar');
    expect(window.API.LMSSetValue('cmi.core.lesson_status', 'completed')).toBe('true');
    expect(window.API.LMSCommit('')).toBe('true');
    expect(messages.some((m) => m.type === 'scorm.commit' && m.values?.['cmi.core.lesson_status'] === 'completed')).toBe(true);

    expect(window.API.LMSFinish('')).toBe('true');
    expect(messages.some((m) => m.type === 'scorm.terminate' && m.attemptId === 123)).toBe(true);

    expect(window.API.LMSSetValue('', 'x')).toBe('false');
    expect(window.API.LMSGetLastError()).toBe('201');
  });

  it('SCORM 2004: Initialize / GetValue / SetValue / Commit / Terminate + errores', () => {
    const { window, messages } = runInjected('2004');

    expect(messages.some((m) => m.type === 'scorm.ready' && m.attemptId === 123 && m.version === '2004')).toBe(true);
    expect(typeof window.API_1484_11?.Initialize).toBe('function');

    expect(window.API_1484_11.Initialize('')).toBe('true');
    expect(messages.some((m) => m.type === 'scorm.init' && m.attemptId === 123 && m.version === '2004')).toBe(true);

    expect(window.API_1484_11.GetValue('cmi.foo')).toBe('bar');
    expect(window.API_1484_11.SetValue('cmi.completion_status', 'completed')).toBe('true');
    expect(window.API_1484_11.Commit('')).toBe('true');
    expect(messages.some((m) => m.type === 'scorm.commit' && m.values?.['cmi.completion_status'] === 'completed')).toBe(true);

    expect(window.API_1484_11.Terminate('')).toBe('true');
    expect(messages.some((m) => m.type === 'scorm.terminate' && m.attemptId === 123)).toBe(true);

    expect(window.API_1484_11.SetValue('', 'x')).toBe('false');
    expect(window.API_1484_11.GetLastError()).toBe('201');
  });

  it('E2E probe: Initialize fuerza un commit temprano con un marcador', () => {
    const { window, messages } = runInjected('1.2', { e2eProbe: true });

    expect(window.API.LMSInitialize('')).toBe('true');
    expect(messages.some((m) => m.type === 'scorm.commit' && m.values?.['cmi.location'] === 'ATORA_E2E_COMMIT')).toBe(true);
  });
});

