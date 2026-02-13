import { svelteTesting } from '@testing-library/svelte/vite';
import { mergeConfig } from 'vite';
import { defineConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
	viteConfig,
	defineConfig({
		plugins: [svelteTesting()],
		test: {
			environment: 'jsdom',
			include: ['src/**/*.{test,spec}.{js,ts}'],
			setupFiles: ['./src/test/setup.ts'],
			coverage: {
				provider: 'v8',
				reporter: ['text', 'html'],
				thresholds: {
					lines: 80,
					functions: 80,
					statements: 80,
					branches: 70
				}
			}
		}
	})
);
