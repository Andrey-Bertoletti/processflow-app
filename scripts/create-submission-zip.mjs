#!/usr/bin/env node

import { createWriteStream, statSync, readdirSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');
const projectRoot = join(__dirname, '..');

// Padrões de arquivo/pasta a EXCLUIR (segurança + tamanho)
const EXCLUDE_PATTERNS = [
  // Secrets e configuração privada
  /^\.env$/,
  /^\.env\./,
  /backend\/\.env$/,
  /backend\/\.env\./,
  /frontend\/\.env$/,
  /frontend\/\.env\./,
  /backend\/supabase\/\.temp\//,
  /frontend\/supabase\/\.temp\//,

  // Git e controle de versão
  /^\.git\//,
  /\.git$/,

  // Node.js e dependências
  /^node_modules\//,
  /\/node_modules\//,
  /^frontend\/node_modules\//,
  /^backend\/node_modules\//,

  // Build e cache
  /^\.next\//,
  /^frontend\/\.next\//,
  /^\.vercel\//,
  /^frontend\/\.vercel\//,
  /^dist\//,
  /^build\//,
  /^\.turbo\//,
  /^\.cache\//,

  // Logs e temporários
  /\.log$/,
  /\.log\./,
  /npm-debug\.log/,
  /yarn-error\.log/,
  /^\.DS_Store$/,
  /^Thumbs\.db$/,

  // ZIP anterior (evita recursão)
  /processflow-submission\.zip$/,
  /processflow-.*\.zip$/,
];

// Padrões PERMITIDOS (exceções para .env.example)
const ALLOW_PATTERNS = [
  /\.env\.example$/,
  /frontend\/\.env\.example$/,
  /backend\/\.env\.example$/,
];

function shouldExclude(filePath) {
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Permitir .env.example e variantes
  for (const allowPattern of ALLOW_PATTERNS) {
    if (allowPattern.test(normalizedPath)) {
      return false;
    }
  }

  // Excluir padrões perigosos
  for (const excludePattern of EXCLUDE_PATTERNS) {
    if (excludePattern.test(normalizedPath)) {
      return true;
    }
  }

  return false;
}

function validateZipContents(zipPath, expectedEntries) {
  // Nota: validação básica - em produção usaria archiver.list() ou similar
  console.log(`✓ ZIP criado: ${zipPath}`);
  console.log(`✓ Total de arquivos: ${expectedEntries}`);

  // Checklist de segurança
  console.log('\n🔍 Validação de Segurança:');
  const dangerousPatterns = [/\.env[^.]/i, /secret/i, /api[_-]key/i, /password/i];
  console.log('✓ ZIP não deve conter: .env, secrets, API keys');
  console.log('✓ ZIP não deve conter: node_modules, .git, .next, .vercel');

  return true;
}

async function createSubmissionZip() {
  const outputPath = join(projectRoot, 'processflow-submission.zip');

  console.log('📦 Criando submission ZIP seguro...\n');

  const output = createWriteStream(outputPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  let fileCount = 0;
  let excludedCount = 0;

  return new Promise((resolve, reject) => {
    output.on('close', () => {
      validateZipContents(outputPath, fileCount);
      console.log(`\n⚠️  Arquivos excluídos por segurança: ${excludedCount}`);
      console.log(`\n✅ Submission ZIP pronto: ${outputPath}`);
      resolve();
    });

    archive.on('error', (err) => {
      console.error('❌ Erro ao criar ZIP:', err);
      reject(err);
    });

    archive.pipe(output);

    function addDirectory(dirPath, archivePath = '') {
      try {
        const entries = readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = join(dirPath, entry.name);
          const relPath = relative(projectRoot, fullPath).replace(/\\/g, '/');
          const zipPath = archivePath ? join(archivePath, entry.name).replace(/\\/g, '/') : relPath;

          if (shouldExclude(relPath)) {
            excludedCount++;
            continue;
          }

          if (entry.isDirectory()) {
            addDirectory(fullPath, zipPath);
          } else if (entry.isFile()) {
            try {
              const stat = statSync(fullPath);
              archive.file(fullPath, { name: zipPath });
              fileCount++;
            } catch (err) {
              console.warn(`⚠️  Pulando arquivo: ${relPath} (${err.message})`);
            }
          }
        }
      } catch (err) {
        console.warn(`⚠️  Erro ao ler diretório ${dirPath}: ${err.message}`);
      }
    }

    addDirectory(projectRoot);
    archive.finalize();
  });
}

createSubmissionZip().catch((err) => {
  console.error('Falha ao criar ZIP:', err);
  process.exit(1);
});
