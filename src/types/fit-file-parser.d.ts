declare module 'fit-file-parser' {
  interface FitParserOptions {
    force?: boolean;
    speedUnit?: string;
    lengthUnit?: string;
    temperatureUnit?: string;
    elapsedRecordField?: boolean;
    mode?: string;
  }

  type FitParserCallback = (error: Error | undefined, data: any) => void;

  class FitParser {
    constructor(options?: FitParserOptions);
    parse(buffer: ArrayBuffer | Buffer, callback: FitParserCallback): void;
    activity?: any;
    records?: any[];
    laps?: any[];
    sessions?: any[];
  }

  export default FitParser;
}
