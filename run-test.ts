import { runTransformPipeline } from './src/transform';
import { formatReportAsText } from './src/transform/pre-upload-report';
import { previewCSV } from './src/transform/generate-import-file';

async function main() {
  console.log('=== Running ADP to Intacct Transform Pipeline ===\n');

  const result = await runTransformPipeline(
    './downloads/payroll-gl/sample-payroll.csv',
    {
      verbose: true,
      outputDir: './exports/intacct-ready',
      entryType: 'payroll',
    }
  );

  console.log('\n--- PARSE RESULT ---');
  console.log(`Success: ${result.parseResult.success}`);
  console.log(`Parsed rows: ${result.parseResult.parsedRows}`);
  console.log(`Error rows: ${result.parseResult.errorRows}`);
  console.log(`Warnings: ${result.parseResult.warnings.length}`);
  if (result.parseResult.errors.length > 0) {
    console.log('Parse errors:');
    result.parseResult.errors.forEach((e) => console.log(`  [${e.code}] ${e.message}`));
  }

  console.log('\n--- MAPPING RESULT ---');
  console.log(`Success: ${result.mappingResult.success}`);
  console.log(`Journal entries: ${result.mappingResult.entries.length}`);
  console.log(`Mapped lines: ${result.mappingResult.stats.mappedEntries}`);
  console.log(`Unmapped accounts: ${result.mappingResult.stats.unmappedAccounts.join(', ') || 'none'}`);
  console.log(`Unmapped departments: ${result.mappingResult.stats.unmappedDepartments.join(', ') || 'none'}`);
  if (result.mappingResult.warnings.length > 0) {
    console.log('Mapping warnings:');
    result.mappingResult.warnings.forEach((w) => console.log(`  [${w.code}] ${w.message}`));
  }

  console.log('\n--- VALIDATION RESULT ---');
  console.log(`Valid: ${result.validationResult.isValid}`);
  console.log(`Can proceed: ${result.validationResult.canProceed}`);
  console.log(`Total debits: $${result.validationResult.totalDebits.toFixed(2)}`);
  console.log(`Total credits: $${result.validationResult.totalCredits.toFixed(2)}`);
  console.log(`Net difference: $${result.validationResult.netDifference.toFixed(2)}`);

  console.log('\n--- PRE-UPLOAD REPORT ---');
  console.log(formatReportAsText(result.report));

  if (result.generationResult) {
    console.log('\n--- GENERATION RESULT ---');
    console.log(`Success: ${result.generationResult.success}`);
    console.log(`File: ${result.generationResult.filePath}`);
    console.log(`Rows: ${result.generationResult.rowCount}`);
    console.log(`Size: ${result.generationResult.fileSizeBytes} bytes`);
    console.log(`Checksum: ${result.generationResult.checksum || 'n/a'}`);

    console.log('\n--- CSV PREVIEW ---');
    console.log(previewCSV(result.mappingResult.entries));
  }

  console.log('\n=== Pipeline complete ===');
  console.log(`Overall success: ${result.success}`);
}

main().catch((err) => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});
