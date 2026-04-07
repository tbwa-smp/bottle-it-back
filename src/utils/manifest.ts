import { defineManifest } from '@crxjs/vite-plugin';
import { CONTENT_SCRIPT_MATCHES } from './sites';

export default defineManifest({
  manifest_version: 3,
  name: 'AI Water Tracker',
  version: '0.1.0',
  description:
    'Tracks activity across major AI websites and estimates water consumption from visits, prompts, and active time.',
  permissions: ['storage'],
  host_permissions: CONTENT_SCRIPT_MATCHES,
  background: {
    service_worker: 'src/background.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: CONTENT_SCRIPT_MATCHES,
      js: ['src/content.ts'],
      run_at: 'document_idle',
    },
  ],
});
