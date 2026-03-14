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

const splitCsvLine = (line: string) =>
  line.split(',').map(value => value.trim());

export function validateIedCsv(input: string): CsvValidationResult<IedCsvRow> {
  const rows: IedCsvRow[] = [];
  const errors: string[] = [];
  const switchPorts = new Set<string>();
  const iedPorts = new Set<string>();

  input
    .trim()
    .split('\n')
    .map(line => line.trim())
    .forEach((line, index) => {
      if (line === '') return;
      const fields = splitCsvLine(line);
      if (fields.length !== 4) {
        errors.push(
          `IED data line ${index + 1} must have 4 values, found ${
            fields.length
          }.`
        );
        return;
      }

      const [switchName, portName, iedName, receivingPortName] = fields;
      rows.push({ switchName, portName, iedName, receivingPortName });

      if (switchName !== '' && portName !== '') {
        const switchKey = `${switchName}::${portName}`;
        if (switchPorts.has(switchKey)) {
          errors.push(
            `Switch port ${switchName} ${portName} is used more than once.`
          );
        }
        switchPorts.add(switchKey);
      }

      if (iedName !== '' && receivingPortName !== '') {
        const iedKey = `${iedName}::${receivingPortName}`;
        if (iedPorts.has(iedKey)) {
          errors.push(
            `IED port ${iedName} ${receivingPortName} is duplicated.`
          );
        }
        iedPorts.add(iedKey);
      }
    });

  return { rows, errors };
}

export function validateSwitchLinksCsv(
  input: string
): CsvValidationResult<SwitchLinkCsvRow> {
  const rows: SwitchLinkCsvRow[] = [];
  const errors: string[] = [];
  const switchPorts = new Set<string>();

  input
    .trim()
    .split('\n')
    .map(line => line.trim())
    .forEach((line, index) => {
      if (line === '') return;
      const fields = splitCsvLine(line);
      if (fields.length !== 4) {
        errors.push(
          `Switch link line ${index + 1} must have 4 values, found ${
            fields.length
          }.`
        );
        return;
      }

      const [sourceSwitch, sourcePort, targetSwitch, targetPort] = fields;
      rows.push({ sourceSwitch, sourcePort, targetSwitch, targetPort });

      if (sourceSwitch !== '' && sourcePort !== '') {
        const sourceKey = `${sourceSwitch}::${sourcePort}`;
        if (switchPorts.has(sourceKey)) {
          errors.push(
            `Switch port ${sourceSwitch} ${sourcePort} is used more than once.`
          );
        }
        switchPorts.add(sourceKey);
      }

      if (targetSwitch !== '' && targetPort !== '') {
        const targetKey = `${targetSwitch}::${targetPort}`;
        if (switchPorts.has(targetKey)) {
          errors.push(
            `Switch port ${targetSwitch} ${targetPort} is used more than once.`
          );
        }
        switchPorts.add(targetKey);
      }
    });

  return { rows, errors };
}

export function validateCrossDatasets(
  iedRows: IedCsvRow[],
  switchLinkRows: SwitchLinkCsvRow[]
): string[] {
  const errors: string[] = [];
  const iedPorts = new Set<string>();

  // Collect all switch ports from IED data
  iedRows.forEach(row => {
    if (row.switchName !== '' && row.portName !== '') {
      iedPorts.add(`${row.switchName}::${row.portName}`);
    }
  });

  // Check if any switch link port conflicts with IED ports
  switchLinkRows.forEach(row => {
    if (row.sourceSwitch !== '' && row.sourcePort !== '') {
      const sourceKey = `${row.sourceSwitch}::${row.sourcePort}`;
      if (iedPorts.has(sourceKey)) {
        errors.push(
          `Switch port ${row.sourceSwitch} ${row.sourcePort} is used in both IED and Switch Link data.`
        );
      }
    }

    if (row.targetSwitch !== '' && row.targetPort !== '') {
      const targetKey = `${row.targetSwitch}::${row.targetPort}`;
      if (iedPorts.has(targetKey)) {
        errors.push(
          `Switch port ${row.targetSwitch} ${row.targetPort} is used in both IED and Switch Link data.`
        );
      }
    }
  });

  return errors;
}
