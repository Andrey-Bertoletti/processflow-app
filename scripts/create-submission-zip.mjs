#!/usr/bin/env node

import { createWriteStream } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');
const projectRoot = join(__dirname, '..');

// ==========================================
// CONFIGURAÇÃO DE SEGURANÇA
// ==========================================

const FORBIDDEN_PATTERNS = [
  // Secrets e Configuração (exceto .example)
  /\.env$/,
  /\.env\.(?!example$)[^/]+$/,
  
  // Node.js e Dependências
  /(^|\/)node_modules($|\/)/,
  
  // Build e Cache
  /(^|\/)\.next($|\/)/,
  /(^|\/)\.vercel($|\/)/,
  /(^|\/)dist($|\/)/,
  /(^|\/)build($|\/)/,
  
  // Controle de Versão
  /(^|\/)\.git($|\/)/,
  
  // Temporários do Supabase
  /\.temp($|\/)/,
  
  // Logs e Lixo
  /\.log$/,
  /npm-debug\.log/,
  /\.DS_Store$/,
  /Thumbs\.db$/,
  /processflow-submission\.zip$/
];

const ALLOW_PATTERNS = [
  /\.env(\.[^/]+)?\.example$/,
];

function isForbidden(filePath) {
  const normalizedPath = filePath.replace(/\\/g, '/');
  
  // 1. Verificar se é permitido (exceção prioritária)
  for (const allow of ALLOW_PATTERNS) {
    if (allow.test(normalizedPath)) return false;
  }
  
  // 2. Verificar se é proibido
  for (const forbidden of FORBIDDEN_PATTERNS) {
    if (forbidden.test(normalizedPath)) return true;
  }
  
  return false;
}

// ==========================================
// PROCESSO DE COMPACTAÇÃO
// ==========================================

async function createSubmissionZip() {
  const outputPath = join(projectRoot, 'processflow-submission.zip');
  console.log('📦 Iniciando criação do ZIP de submissão...\n');

  const output = createWriteStream(outputPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  const includedFiles = [];

  return new Promise((resolve, reject) => {
    output.on('close', () => {
      console.log(`\n✅ ZIP criado com sucesso: ${outputPath}`);
      console.log(`📊 Total de arquivos: ${includedFiles.length}`);
      
      // Validação Final de Segurança
      console.log('🔍 Executando auditoria final de segurança...');
      for (const file of includedFiles) {
        if (isForbidden(file)) {
          console.error(`\n❌ ERRO CRÍTICO: Arquivo proibido detectado no ZIP: ${file}`);
          process.exit(1);
        }
      }
      console.log('✓ Auditoria concluída: Nenhum segredo detectado.');
      resolve();
    });

    archive.on('error', (err) => {
      console.error('❌ Erro no Archiver:', err);
      reject(err);
    });

    // Avisar se algum arquivo entrar que não deveria (via stream)
    archive.on('entry', (entry) => {
      if (isForbidden(entry.name)) {
        console.error(`\n❌ VIOLAÇÃO DE SEGURANÇA: Tentativa de incluir arquivo proibido: ${entry.name}`);
        archive.abort();
        reject(new Error(`Forbidden file entry: ${entry.name}`));
      }
    });

    archive.pipe(output);

    function listTrackedFiles() {
      try {
        const out = execSync('git ls-files -z', {
          cwd: projectRoot,
          stdio: ['ignore', 'pipe', 'ignore'],
        });
        return out
          .toString('utf8')
          .split('\0')
          .map((p) => p.trim())
          .filter(Boolean)
          .map((p) => p.replace(/\\/g, '/'));
      } catch {
        return null;
      }
    }

    try {
      const tracked = listTrackedFiles();
      if (!tracked) {
        throw new Error(
          'Não foi possível listar arquivos versionados via git. Execute este script dentro de um repositório git.',
        );
      }

      // Fail-fast: se algo proibido estiver versionado, não permite criar ZIP.
      const forbiddenTracked = tracked.filter((p) => isForbidden(p));
      if (forbiddenTracked.length > 0) {
        const sample = forbiddenTracked.slice(0, 20).join('\n  - ');
        throw new Error(
          `Arquivos proibidos detectados no conjunto versionado (git). Remova-os do versionamento antes da submissão:\n  - ${sample}`,
        );
      }

      // Inclui APENAS arquivos versionados (git), evitando vazamento de artefatos locais/untracked.
      for (const relPath of tracked) {
        const fullPath = join(projectRoot, relPath);
        archive.file(fullPath, { name: relPath });
        includedFiles.push(relPath);
      }

      archive.finalize();
    } catch (err) {
      reject(err);
    }
  });
}

createSubmissionZip().catch((err) => {
  console.error('\n💥 Falha catastrófica ao criar o ZIP:', err.message);
  process.exit(1);
});
