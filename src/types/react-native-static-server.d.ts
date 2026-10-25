declare module 'react-native-static-server' {
  type Options = {
    localOnly?: boolean;
    keepAlive?: boolean;
  };

  export default class StaticServer {
    constructor(port?: number | Options, root?: string | Options, options?: Options);
    start(): Promise<string>;
    stop(): Promise<void>;
    isRunning(): Promise<boolean>;
  }
}

