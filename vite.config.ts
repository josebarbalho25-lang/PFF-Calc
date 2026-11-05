/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { servidorDePdf } from './scripts/servidorDePdf.ts';

const RAIZ = fileURLToPath(new URL('.', import.meta.url));

/*
  ⚠️ PORTAS 5190 E 5191. A 5173 é a do A-PORT e a 5180–5182 são da calculadora
  NBR 8800: com dois abertos, o segundo a subir pegaria outra porta calado e o
  atalho do ABRIR.bat abriria o programa errado. A 5192 é a bancada de teste.
*/
export default defineConfig({
  plugins: [react(), servidorDePdf(RAIZ)],
  server: { port: 5190, strictPort: true, open: false },
  preview: { port: 5191, strictPort: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 1100 },
  test: { exclude: [...configDefaults.exclude, '.claude/**', 'oraculos/**'] },
});
