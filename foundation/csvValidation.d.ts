export type IedCsvRow = {
    switchName: string;
    portName: string;
    iedName: string;
    receivingPortName: string;
};
export type SwitchLinkCsvRow = {
    sourceSwitch: string;
    sourcePort: string;
    targetSwitch: string;
    targetPort: string;
};
export type CsvValidationResult<T> = {
    rows: T[];
    errors: string[];
};
export declare function validateIedCsv(input: string): CsvValidationResult<IedCsvRow>;
export declare function validateSwitchLinksCsv(input: string): CsvValidationResult<SwitchLinkCsvRow>;
export declare function validateCrossDatasets(iedRows: IedCsvRow[], switchLinkRows: SwitchLinkCsvRow[]): string[];
