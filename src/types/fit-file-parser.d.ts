declare module 'fit-file-parser' {
  interface FitParserOptions {
    force?: boolean;
    speedUnit?: string;
    lengthUnit?: string;
    temperatureUnit?: string;
    elapsedRecordField?: boolean;
    mode?: string;
  }

  class FitParser {
    constructor(options?: FitParserOptions);
    parse(buffer: ArrayBuffer | Buffer): void;
    activity?: any;
    records?: any[];
    laps?: any[];
    sessions?: any[];
  }

  export default FitParser;
}
